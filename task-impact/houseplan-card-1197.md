## #1197 — HA E2E: не надо

Источник: https://github.com/Matysh/houseplan-card/issues/1197

Добавлены только отсутствовавшие DE/FR подписи двух существующих Copy checkboxes; взаимодействие, hooks, сохранение и права не меняются. Остальной diff адаптирует retained Node checks к принятым #1184/#1105 контрактам: no-remeasure, scoped header stylesheet, mixed bundle ownership/manifest/retry checks остаются. Нового HA сценария или изменения его ожидаемой серверной семантики не требуется. Строгие locale keyset/placeholders и полные четыре адресных Node-файла проверяются в S6 этой задачи. Исходный CI B FAIL сохранён, адресный успех не заменяет полный beta report.
