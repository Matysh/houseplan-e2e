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
запрещены; Cancel закрывает обе формы, config/layout и ревизии остаются прежними.
Контроль положительного изменения масштаба/камеры из #1120 не затронут.

Этот case впервые исполняется на beta.4: известная beta.3 и старше получают
явный version skip, который не считается доказательством. Диагностические
workflow selectors, пассивные sampler и временные notification настройки в
основной набор не переносятся. Сохранена только безопасная квитанция actual HA
version/установленного frontend, без auth/config.

Перед публикацией обязателен полный прогон точного конечного beta.4 кандидата
с исполнением этого case и всех пяти #1112 static cases. Его результат
фиксируется в задачах и release evidence; source-positive выше его не заменяет.
