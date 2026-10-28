# Task impact #1114

Вердикт: не надо.

Изменение ограничено B/C: версия visual metadata, построение bounded selected Golden-плана, строгая проверка результатов и receipt identity. Runtime, HA WS/config/services/permissions и persisted пользовательская конфигурация не изменяются. Прямые ordinary API/planner/worker/receipt tests воспроизводят отказ старой API и silent skip старого schema-1 reader, проверяют zero-diff/SHA/error/child/partial/epoch/full/conflict boundaries. Read-only реальные scopes #1097/#1098 формируют6/4 selected unchanged сцены. Это не browser execution и не full HA validation; сами потребители обязаны пройти свежие captures/CI после принятого ребейза.

Нового сценария HA E2E не предлагается: внешний HA journey не затронут, такой сценарий не добавит oracle для декларации/receipt/результата worker. Действующие продуктовые smokes/Golden/full beta политика сохраняются. Accepted SHA: dev86c6c7eab555e50e417d6d6fdeb2c3b8b27eb4fb; sourcee5cc24c0fa5674e9b23298a1f307cb3971dc27aa. CODEr1 GREEN H0/M0 [6471661629](https://github.com/Matysh/houseplan-card/issues/1114#issuecomment-6471661629), auto6471671486. ProtectedValidate40703310680 GREEN; normal hook273s0failed, exact-head docs40701715984/tooling40701716398 GREEN. LiveS8 and accepted helper diff equality verified.
