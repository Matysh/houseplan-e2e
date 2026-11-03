# #1222 — HA E2E: надо

Источник: https://github.com/Matysh/houseplan-card/issues/1222.
Принятый product SHA: d1425dcbcc0989e71c7db9c6648313ccd5bff6c1.

В настоящем HA на legacy-плане через Background editor создать цепочку из двух
линий. Нативные Undo/Redo должны давать 2 → 1 → 2 с теми же ID, координатами,
стилем и порядком; активный anchor остаётся корректным. Проверить Escape,
историю завершённой цепочки, style/delete и multiselect Redo, затем reload.
До первой structural операции физический носитель и версия модели не должны
меняться вследствие только декора. Сверять принятые config/revision и UI;
не заменять серверные записи заглушкой или private product props.

Адресные unit/native synthetic проверки исправления прошли в продукте. Они
не доказывают HA durability/ACL. Реальный journey ещё не выполнен; учесть при
актуализации https://github.com/Matysh/houseplan-card/issues/1225 перед бетой.
Эта запись не меняет фиксированную beta-выборку и не разрешает выпуск.
