# #1220 — HA E2E: надо

Источник: https://github.com/Matysh/houseplan-card/issues/1220.
Принятый product SHA: 3496405aa3b8c626dcea67ae8cdb86b47b7df3e0.

В реальной панели HA создать пространство и нарисовать отрезок при обычных
обновлениях состояний с прежними connection/user. Во время ожидаемого ACK
должен появиться новый snapshot hass. При необходимости задержать доставку
только настоящего серверного ACK, не подменяя ответ и не вмешиваясь в private
product props. Проверить серверную истину, одну запись/один объект, принятую
revision, продолжение следующего действия, отсутствие ложного context-changed
и сохранность после reload.

В существующих journeys копирования/истории устройств, позиции/контактной
группы и Optimize проверить, что обычный live state update не выдаёт отказ
уже сохранённому действию. Проверки настоящей смены authority/account и
A→B→A, upload/dispatch/ACK retirement остаются самостоятельными адресными
негативными проверками; обычный snapshot нельзя считать новой authority.

В продукте прошли новые unit, существующие authority/history/transport
проверки и native create-space → draw-wall → reload на recording boundary.
Это не заменяет реальный HA journey: он ещё не выполнен. Учесть вместе с
https://github.com/Matysh/houseplan-card/issues/1225 перед бетой. Нового UI,
hooks, persisted schema или разрешения на выпуск эта запись не добавляет.
