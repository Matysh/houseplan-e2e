# #1132 — влияние на E2E после S8

Вердикт: **надо** — обновить существующие HA-проверки панели/профилей под согласованный UI1132. Новый независимый journey не требуется.

Подготовлена адресная правка:44px close после beta.5, прямые доступные действия на узком реальном HA host, отсутствие header-menu; удалённое controls поле проверяется как отсутствующее, сохранение — false. Старый hpcontrols=1 не возвращает кнопки; summary contents сохраняются. Local-only summary/ACL проверяется в обычном View вместо удалённого kiosk входа. Старые версии сохраняют свои прежние expectations через installed version, не считаются доказательством нового контракта.

Продукт принят в S8: [CODE r1 H0/M0](https://github.com/Matysh/houseplan-card/issues/1132#issuecomment-6512551904), reviewed material `a7196f76bedd639dd554c1d8943d56e2840fc455`, dev `328200f01edd9b5293c593862da5d64c01813968`. [Canonical CI40982832507](https://github.com/Matysh/houseplan-card/actions/runs/40982832507) зелёный. Первый публичный контракт — будущая **1.83.0-beta.5**.

Адресные изменения E2E готовы к публикации: версия маршрутизирует старые и новые ожидания, удалённое поле controls проверяется как отсутствующее; в новом профиле сохраняется false. В киоске проверяются отсутствие кнопок и сохранённое содержимое сводки; неизменённые local-only/ACL действия проверяются в обычном View. Порог Properties не меняется.

Локальные unit, lint контракта и discovery не заменяют настоящий HA. До beta запустить полный E2E на точном финальном beta.5 candidate; результат и SHA записать в issue. Для стабильного выпуска сохраняется отдельный обязательный E2E точного stable candidate.

Предрелизный [HA E2E41037348444](https://github.com/Matysh/houseplan-e2e/actions/runs/41037348444) на точном `ce403073fa4bc25f40020b83a1021a7c8ad887bb`: 69 journeys PASS, 6 FAIL на общем setup `zoomInVisible`. Кнопка зума скрыта штатным compact header даже при viewport1800px. Первый запуск и upgrade PASS.

Helper сохраняет assertions видимых native buttons; для compact header нового panel contract использует реальное колесо мыши над планом и проверяет увеличение SVG-масштаба через `getScreenCTM`. Крестик активного редактора обязан оставаться видимым. Нет force-click, записей в частную камеру, skip или ослабления config/layout/Undo/Copy/group oracles. Отдельные header journeys не меняются. Нужен повтор полного реального HA E2E точного кандидата; новый PASS пока не объявлен.
