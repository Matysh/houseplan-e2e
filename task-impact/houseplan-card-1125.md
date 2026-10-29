# #1125 — итоговая оценка E2E

Вердикт: **надо**. Порядок инициализации настоящего HA и предварительно
загруженных custom-card ресурсов — интеграционный риск, которого не доказывает
демо без HA. Новых функций, данных или намеренных pixel changes нет.

## Принятый материал

- CODE: https://github.com/Matysh/houseplan-card/issues/1125#issuecomment-6500531098.
- Автоматический S8: https://github.com/Matysh/houseplan-card/issues/1125#issuecomment-6500540624.
- Accepted dev: 43a6f672983f9d24e62e45cc12d5d7f5275bc240.
- Функциональная сборка проверена на source
  fd95d11f71c988a376e9a07c42ca45b6f969f816, fingerprint
  527fc27195497b6844cc955ac7cd6b9aaf891a804fa9ca053f5953bc9bb2ab74,
  manifest167831d9a7d00b42416b9bc127685f9591a6bc858cf28f574fcf52685b8b3c84.
  Последующие ledger/inventory/review изменения не меняют539 compiler inputs
  или75 готовых runtime-файлов; равенство проверено отдельно.

## Доказанная причина и граница доказательств

Исходный [HA40860469554](https://github.com/Matysh/houseplan-e2e/actions/runs/40860469554)
содержит настоящий Illegal constructor HpDialog: первая dirty ZIP попытка
FAIL32.556s, повторная PASS14.223s. Успешный retry не отменяет первую ошибку.

Пассивный baseline [40864765011](https://github.com/Matysh/houseplan-e2e/actions/runs/40864765011)
прошёл7/7 и не воспроизвёл дефект. Контролируемый
[negative40865674089](https://github.com/Matysh/houseplan-e2e/actions/runs/40865674089)
задержал только запрос настоящего app-модуля HA на600ms, не меняя его байты,
factories или registry: все8 попыток четырёх import cases дали тот же HpDialog
stack. HpDialog регистрировался до HA shim, а после замены registry текущий
public get('hp-dialog') возвращал undefined. Это воспроизведённый timing input,
а не утверждение о точном историческом сетевом расписании редкой первой ошибки.

Тот же companion8dc03e02 и тот же600ms input на исправленном sourcefd95:
[positive40872299778](https://github.com/Matysh/houseplan-e2e/actions/runs/40872299778)
—7/7PASS(3setup+4transfer),0skip/0flaky/0constructor errors. Все8 наблюдённых
Documents определяют HpDialog после shim и native home-assistant; public
registry сохраняет класс. First-run и upgrade jobs тоже GREEN. Артефакт
e2e-106-journeys-ha-stable ID12896771680, SHA256
43b38a32d7536980e6b11ce48a9dd281f2cf3ae340add0a24c4b3f08fdd117aa;
фактический HA2026.10.4 и frontend identity прочитаны из квитанции.
Это **адресный прогон**, не полный journeys или окончательный beta gate.

## Постоянное изменение companion выполнено

Новый tests/ha-bootstrap.admin.spec.mjs повторяет холодный/повторный вход,
задерживает только исходный HA app request и обычными действиями открывает
Settings/Maintenance и предпросмотр настоящего ZIP. Constructor errors
запрещены; открытие импорта закрывает Settings, Cancel закрывает предпросмотр,
config/layout и ревизии остаются прежними.
Контроль положительного изменения масштаба/камеры из #1120 не затронут.

Этот case впервые исполняется на beta.4: известная beta.3 и старше получают
явный version skip, который не считается доказательством. Диагностические
workflow selectors, пассивные sampler и временные notification настройки в
основной набор не переносятся. Сохранена только безопасная квитанция actual HA
version/установленного frontend, без auth/config.

Перед публикацией обязателен полный прогон точного конечного beta.4 кандидата
с исполнением этого case и всех пяти #1112 static cases. Его результат
фиксируется в задачах и release evidence; source-positive выше его не заменяет.

## Первая полная beta.4 проверка и исправление фикстуры

[Полный HA40914798383](https://github.com/Matysh/houseplan-e2e/actions/runs/40914798383)
на source9ac47094bfa6b70f31db6490b53101248c81c90a и companionc2a2091:
journeys70PASS/5FAIL/0skip/0flaky; first-run4/4PASS, upgrade3/3PASS.
Фактический HA2026.10.4, frontenddb22631f8dffce327662c122343d4c921f036b08d153a1b63c45a9e9ddaeb125.

Новый bootstrap case в обеих попытках дошёл до настоящего ZIP-предпросмотра,
проверил его содержимое и закрыл Cancel. Затем ошибочно искал текст Cancel
у кнопки закрытия родительских Settings и исчерпал90s. Это не положительный
результат всего case: второй вход и конечные проверки ещё не исполнялись.
Остальные четыре отказа относятся к Static и отдельно записаны в #1112.

Продуктовый src/hp-dialog.ts799–801 объявляет `data-hp="dialog-cancel"` у
крестика с aria-label Close и иконкой; general-settings-dialog.ts99–100
использует этот hp-dialog и обычный hp-close. У крестика нет текста Cancel.
Исправлена только фикстура закрытия: тот же публичный hook, `.first().click()`
вместо фильтра по отсутствующему тексту. Это соответствует уже имеющемуся
`cancelIn()` в tests/lib/hooks.mjs. Задержка настоящего app600ms, два входа,
реальный ZIP, запрет Illegal constructor и полное равенство config/layout/rev
сохранены; skip/timeout/бюджеты не менялись.

Финальный полный HA на точном source08b154115ff815062cfc0221f39f7e53545dbe45
после публикации исправленного companion пока PENDING; первоначальный RED
и его артефакт12916247130 с SHA256
77c5fff1a344d20c3612e2cfa7bf28bc61d111cccc5696726116cbda08a213da сохранены.

Совместные проверки исправленных фикстур: `npm run test:unit`58/58PASS,
`npm run contract:lint`47filesPASS, `npx playwright test --list`78tests/31files.
Эти проверки не исполняют настоящий HA и не заменяют предстоящий полный прогон.

## Уточнение жизненного цикла Settings после повторной полной проверки

[Полный HA40918985876](https://github.com/Matysh/houseplan-e2e/actions/runs/40918985876)
на source08b154115ff815062cfc0221f39f7e53545dbe45/companion2ed6d1c:
journeys73PASS/2FAIL. Текстовый фильтр был снят, но bootstrap снова исчерпал90s
на дополнительном клике по уже отсутствующим Settings. Предыдущее объяснение
про видимый родительский крестик было неполным: кнопка существует у самого
компонента, однако родительских Settings в этот момент уже нет.

Прямая причина в исходном жизненном цикле: general-settings-dialog.ts264–268
вызывает leaveFor/import, а houseplan-editor-runtime.ts9303–9308 перед
открытием preview присваивает `_settingsDialog = null`. После Cancel
импорта Settings автоматически не возвращаются. Продукт здесь не менялся.

Фикстура теперь явно проверяет, что Settings скрыты после появления preview
и остаются скрыты после Cancel; лишний клик удалён. Реальный Settings до этого
обязательно виден в openMaintenance; сам preview, оба холодных входа, два
настоящих задержанных app-запроса, отсутствие Illegal constructor и полное
равенство config/layout/rev по-прежнему обязательны. Этот исправленный полный
case пока PENDING; оба прежних RED остаются сохранёнными.
