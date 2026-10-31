# Task impact #1171

Вердикт: **не надо**.

Задача: https://github.com/Matysh/houseplan-card/issues/1171.
Авторский материал: `26c78835f`, база dev `33707db7a`; SPEC r2 зелёный.

Исправляется чтение существующих room-wall/partition/legacy проёмов в Static:
общая проекция символа, кладки, тоннеля и кадра. Формат config/layout, host/ID,
API, запись, авторизация, загрузка интеграции и подключение dashboard не меняются.
Существующий show_borders по-прежнему скрывает границы вместе с символами;
нового hide_openings нет. Карточка остаётся пассивной.

Швы настоящего HA уже принадлежат `tests/static-sync.admin.spec.mjs` и
`tests/lib/static-sync.mjs`: два экземпляра Static принимают ACK/конфигурацию
на общей связи, после native drag и переключения владельца соединения.
`tests/dashboard.admin.spec.mjs` проверяет реальные dashboard layouts.
Эти сценарии не доказывают геометрию створки или выреза, и здесь такой PASS не
заявляется. Точная геометрия — ответственность продуктовой пирамиды, согласно README.

В основном репозитории новый `smoke_static_wall_openings.mjs` исполняет настоящие
full/space custom elements, config events, состояния/flip/invert, перемещение,
удаление/повторное создание, rehost и смену этажа с одинаковыми IDs. Он проверяет
реальные SVG cuts/tunnels, frame360/780px, диагональ/quarter-turn и native click/tap
без HA действий. Pure renderer/cache tests дополнительно меняют конфигурацию
в том же объекте. Три новых Golden кадра снимают сам `houseplan-space-card`.
Они synthetic/offline и не являются прогоном на живом Home Assistant.

Новый HA transport/persistence journey не появился; дублировать математические
и пиксельные проверки в companion не требуется. Фактических правок E2E для
накопления перед бетой нет. Live HA E2E, релиз и изменение стенда не запускались.
