# #1298 — HA E2E: не надо

Источник: https://github.com/Matysh/houseplan-card/issues/1298 .
S8: 0701ada7e3614933bd232899d4c67b6a6bfc6f99, show, независимое ревью принято.
S6: 6/6 (4 reused, 2 passed), 72 адресных Node PASS, 151 critical reused.

Только test/commit-physical-geometry.test.mjs и его characterization helper:
после #1258 общий отказ удаления проверяется через angle, а разрешённый length
проверяется отдельно. Historical паспорт сохранён; изменены два текущих toast.
Все frozen guards остаются на construction/validation и rollback. Успешное
legacy adoption — намеренный writer вне construction-only контракта #1099;
продуктового дефекта или потери маркеров здесь не обнаружено.

Runtime, Python, протокол HA и PNG не меняются, нового HA пути нет.
В beta.6 CI1 41960782624 все 13 business HA и 7 setup уже PASS; отказали только
четыре устаревшие characterization-проверки. Новый кандидат наследует применимые
проверки по обычной identity, без дополнительного HA прогона ради тестовой правки.
Незавершённый CI2 здесь не объявляется PASS; итог выпуска хранится отдельно.