# Влияние Houseplan #1093 на e2e

- Исходная задача: https://github.com/Matysh/houseplan-card/issues/1093
- Дата проверки: 2026-10-28.
- Вердикт: **надо** — явное требование принятого ТЗ.
- Причина: новые границы ожидания Save, сохранение актуальности скрытого этажа и независимые действия после отказа записи должны работать с настоящим HA, его WebSocket и DOM. Внутренние time/counter gates продукта не заменяют эти пользовательские пути.
- Реализация тестов: tests/selective-invalidation.admin.spec.mjs; финальная проверка на реальном HA выполнена на точном кандидате беты, результаты ниже.

## Реализованные сценарии

1. **Save ACK:** настоящее native-сохранение названия пространства; HA принимает запись, но транспортная фикстура удерживает его подлинный ответ. Независимый config/get уже показывает сохранённое название, форма остаётся открытой, Save отключён, ложного «сохранено» нет. После доставки того же ACK форма закрывается; reload/reopen показывает серверное значение. Проверяется один config/set.
2. **Save error → независимая Copy/history:** ровно у одного настоящего config/set фикстура заменяет expected_rev на предыдущую ревизию. Реальный backend возвращает conflict; ответ не выдумывается. Пока отказ удерживается, форма занята; после доставки доступна и показывает ошибку, серверный title не изменён. Native Escape/Discard закрывает черновик. Без перезагрузки, успешного промежуточного Save или сброса очереди выполняются Copy → Move → Delete → Undo3 → Redo3. Проверяются тот же copy ID, полные настройки копии, точные позиции в парном config/layout, сохранность оригинала и результат после reload.
3. **hidden-floor update → show:** при показе другого этажа настоящая HA-служба меняет состояние лампы. Скрытого маркера нет в DOM; native-переключение на его этаж показывает последнее состояние, как и последующая перезагрузка. Состояние лампы и seed-документы восстанавливаются.

tests/lib/held-config-reply.mjs работает на границе Playwright WebSocketRoute. Весь обмен с настоящим HA продолжается; только выбранный result задерживается. Другие команды, события, пакетные сообщения и соединения не подменяются. Auth-токены не попадают в журнал фикстуры. test/held-config-reply.test.mjs проверяет эти ограничения, реальный error payload и однократное освобождение результата.

Существующие tests/settings.admin.spec.mjs и tests/editor-devices.admin.spec.mjs сохранены: их положительные Save/reload, позиционный Undo/Redo и Copy дополняются, а не заменяются. Это проверка корректности, не дубль миллисекундных бюджетов #1093 и не проверка геометрических алгоритмов.

## Проверки и завершение перед бетой

Подготовительные проверки: npm run contract:lint; npm run test:unit; npx playwright test tests/selective-invalidation.admin.spec.mjs --project=admin --list. Они не запускают HA и не подтверждают native-сценарии.

После S8 #1093 и фиксации финального кандидата:
1. npm run contract:sync -- --ref=<точный SHA>; npm run contract:lint.
2. На изолированном HA с тем же ref: npx playwright test tests/selective-invalidation.admin.spec.mjs --project=admin.
3. Полная матрица e2e.yml на том же SHA: journeys, first-run, upgrade. Зафиксировать здесь SHA, URL прогона, непустые результаты всех трёх новых сценариев и просмотренные evidence-кадры. Пропуск из-за старого контракта не является PASS кандидата.

## Финальный результат · 2026-10-28

**PASS**: [E2E 40643409036](https://github.com/Matysh/houseplan-e2e/actions/runs/40643409036), продукт `09bda8dbee8b50577bfc4affc332b8cda914f5b4`, тестовый репозиторий `1121adf147322c520344529bd1d8b444d30dfdf8`, HA `stable`. Git tree входной интеграции `custom_components/houseplan`: `b3a9b0644bceb7608e97fec32069eba0b90cb3b0`. Установщик во всех трёх jobs зафиксировал точный target и версию `1.83.0-beta.3`; сборка воспроизвела committed frontend побайтно. Отдельный runtime digest всего установленного backend каталогом workflow не публикуется; Git tree здесь идентифицирует исходный материал.

Команда запуска: `gh workflow run e2e.yml --repo Matysh/houseplan-e2e --ref main -f houseplan_ref=09bda8dbee8b50577bfc4affc332b8cda914f5b4 -f upgrade_from=stable -f ha_version=stable`. Перед фиксацией результата `npm run contract:sync -- --ref=09bda8dbee8b50577bfc4affc332b8cda914f5b4` не дал diff, `npm run contract:lint` — 34 файла PASS.

Полная матрица: journeys **50/50 PASS** (6.1 мин), first-run **4/4 PASS** (14.0 с), upgrade **3/3 PASS** (1.2 мин), всего **57 PASS**, без skipped/flaky/failed тестов. Upgrade действительно установил release asset `v1.82.0`, затем точный target. Три новых сценария входят в 50 journeys и не прибавляются к 57 повторно:

| Сценарий #1093 | Фактический результат |
|---|---|
| Save ждёт подлинный HA ACK, закрывается и переживает reload | PASS, 6.5 с |
| Подлинный Save conflict сохраняет server truth; затем Copy → Move → Delete → Undo3 → Redo3 | PASS, 13.8 с |
| Изменение HA на скрытом этаже показывается актуальным после перехода | PASS, 7.4 с |

Просмотрены все восемь PNG из [evidence-92-journeys-ha-stable](https://github.com/Matysh/houseplan-e2e/actions/runs/40643409036/artifacts/12797201367), каталог `raw/admin/selective-invalidation/`:

- `save-real-ack-held` / `save-real-ack-reloaded`: открытая форма с ожидающим Save; после reload сохранённое имя и подпись All changes saved.
- `save-real-refusal`: реальная ошибка conflict видна, черновик остаётся и Save снова доступен.
- `copy-after-refused-save`: рядом с исходным термостатом появилась копия, показан Copy created.
- `copy-move-delete-history-replayed` / `history-final-reloaded`: после повтора удаления копии остаётся исходный маркер; после reload план целиком виден.
- `inactive-floor-source-updated` / `inactive-floor-shown-latest`: сначала First Floor без маркера другого этажа; затем Ground Floor с включёнными лампами и светом.

Кадры согласуются с утверждениями тестов; точность серверных config/layout и очереди ACK доказана assertions, а не изображениями. Это E2E evidence, не принятие продуктовых golden baselines. [Отчёт journeys](https://github.com/Matysh/houseplan-e2e/actions/runs/40643409036/artifacts/12797291192).

Ранний диагностический `40639997133` на `3fda00b9` дал отдельные 57 PASS; прогон `40642256924` на заменённом `3a56c29f` отменён и не считается PASS. Финальное доказательство — только `40643409036` на указанном exact target и исходном тестовом SHA. Blocked #1091/#1103 и их процесс/продукт этим изменением не реализуются.
