# Task impact #1167

Вердикт: **надо**.

Задача: https://github.com/Matysh/houseplan-card/issues/1167.
Дата: 2026-11-02. Целевая линия 1.84.0, model11; это не команда выпуска беты.

Перед следующей бетой расширить существующие реальные HA journeys/upgrade, используя обычный UI и настоящий сервер:

1. Legacy model10: первый structural edit (Draw либо node move) автоматически получает model11 на всех этажах; Save→GET→reload→restart сохраняет точный граф. Metadata-only Save до этого не запускает перенос. Исходная config/layout пара экспортируется через migration-source selector и совпадает с исходником, повторная запись её не заменяет.
2. Draw с endpoint/on-edge/T/X и закрытием комнаты, активные и законченные Undo/Redo: shared node IDs и зависимости сохраняются после GET/reload. Resize общей комнаты сохраняет существующую detach семантику соседа. Отмена не пишет.
3. Opening на физическом run из нескольких atomic children: drag/nudge через шов меняет anchor/tq без потери физического проёма, чужие отдельные carriers не подхватываются. Save/reload и Undo сохраняют точное положение.
4. Optimize прежних #1061/#1166 планов: корректный Save, Undo/Redo, второй Optimize без записи. Повторное обычное сохранение не переставляет значения/IDs.
5. Copy, current11 full/space/plan-only JSON/ZIP import/export и portable recovery: exact graph/hosts, remapped IDs, layout и неизвестные совместимые поля сохраняются. До/после рестарта не появляется projection-only authority.
6. Реальный transport крупной записи >4MiB: authenticated HTTP upload→compact WS commit→GET/restart, CAS conflict и viewer/permission revoke. Стандартный HA WS лимит не меняется. Старый projection-only writer после migration получает понятный отказ без записи.

Математические допуски, перестановки, рациональные arithmetic/DAG и fault injection остаются адресными TS/Python/HA-harness тестами продукта. Native synthetic-browser проверки не объявляются доказательством durable HA. Пользовательский HA не менять; частные данные не публиковать.

Это запись воздействия для предбета-пакета, а не заявление, что перечисленные Docker E2E journeys уже исполнены. В самой #1167 выполняются адресные native-editor проверки и реальные HA pytest Store/HTTP/WebSocket сценарии.
