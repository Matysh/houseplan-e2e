# #1098 — E2E verdict: не надо

Approved source: `44d20c6f1b71d683593ab220d3a7f1bc4dc643da`.
Accepted S8 dev: `4bb5eb42626f4efe72a20744746b8b2dc820ebc0`.
CODE r1 GREEN, High 0 / Medium 0: [6473384009](https://github.com/Matysh/houseplan-card/issues/1098#issuecomment-6473384009); auto-merge [6473392120](https://github.com/Matysh/houseplan-card/issues/1098#issuecomment-6473392120).

Изменение ограничено preview лестницы/вершины LED и ключами браузерных кэшей.
Существующие writer-команды, права, wire payloads, события/revisions, persisted
геометрия и правила канонизации сохранены. Лестница применяет тот же allow-list
скаляров до optimistic paint, а не впервые на ACK; unknown fields сохраняются.
Дополнительный интеграционный E2E-сценарий не нужен: unit проверяет реальный runtime
и свежие DemandSpaceModels/clean-floor значения; trusted native smoke проверяет
capture, 30 moves, cancel/history и canonical persisted readback, отдельный smoke —
ACK/площадь/подложку. Canonical CI на точном approved source:46smokes PASS и4strict
Golden byte-identical/0pixels. Full before/after large-house work counters опубликованы.

Тестовый E2E harness не менялся.