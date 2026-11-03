# #1237 — HA E2E: надо

Источник: https://github.com/Matysh/houseplan-card/issues/1237.
Принятый product SHA: d3db9729b6d43cd3ecdeff2a18f518a2c8dfd2f4.

Восстановить first-space.admin: новое пространство без изображения, настоящие
Draw/L/X жесты. Точка сетки54/95 должна иметь exact wire ["l","54","95"], включая
первую точку и near-axis продолжение цепочки. Читать настоящий server config/get
ответ; DOM cx/cy и kernel replay сами по себе не являются извлечённым wire.
Проверить точные ID/узлы после Undo/Redo, reload и export/import. Отдельный off-grid
rational сохраняет точное исходное представление, без nearest/tolerance oracle.

В принятом ревью отмечена непроверенная граница: `snapToGrid` может сохранить
исходный float в пределах своего near-node допуска. Проверить реальные native
точки при разных zoom/pan и около54/95 на ±1ulp, сохраняя exact oracle. Авторский
recording smoke подтвердил основной свидетель и L/Undo/Redo, но не утверждает
покрытие всех вариантов этого near-node пути.

Native recording-wire smoke и unit остаются быстрым контролем; они не заменяют
HA persistence/export journey. Этот real HA сценарий ещё не выполнен; учесть
в #1225 перед следующей разрешённой бетой.
