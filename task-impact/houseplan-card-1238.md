# #1238 — HA E2E: надо

Источник: https://github.com/Matysh/houseplan-card/issues/1238.
Принятый product SHA: 0c030e70016f34ee103ce9a0e15a312915edb09f.

Доработать существующий transfer full/space journey #1225: валидный current model11
graph с hosted opening, смещённой только проекцией opening и сохранённым host/tq.
Preview выполняет безопасный repair без записи; согласие → Apply → reload → Undo
сохраняют graph authority, ширину и настройки opening, парную атомарность и source.
Нужен также явный legacy10 контроль. Не добавлять raw room/partition overlays
поверх неизменённого current graph: это самостоятельная ошибка dirty fixture.

Неоднозначность, повреждённый/inconsistent tq, structural corruption и неподтверждённый
graph должны оставаться безопасным отказом. Исправление не удаляет graph и не
переутверждает остальные проекции. Два адресных backend HA-harness случая проверяют
реальный WS Apply/reload/Undo; внешний browser journey с ZIP ещё не выполнен.
Учесть в #1225 перед разрешённой бетой.
