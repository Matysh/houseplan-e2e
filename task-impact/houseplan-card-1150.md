# Task impact #1150

Вердикт: **не надо**.

Задача: https://github.com/Matysh/houseplan-card/issues/1150.
Материал: issue/1150-ui-kit-editors, база dev `30bed4e3090a3911a7da9239522da11c967a821b`, product fingerprint `ae8783af23e029a65b8f13ed3ade54f66f1c4a1ac384fffe7b52d21d3ef74ef0`.

Компактные кнопки, поля Properties, лотки, палитры и редкие формы получают общие владельцы оформления. Новый путь browser → HA write → reload → persistence не добавлен. Обработчики выбора, истории, файлов, подтверждения, отмены и прав сохранены; публичные data-hp/data-field, accessible names и форматы записей не меняются.

Прочитаны действующие tests/editor-plan.admin.spec.mjs, editor-decor.admin.spec.mjs и editor-devices.admin.spec.mjs: существующие сценарии проверяют реальные действия редакторов, запись на сервере и результат после reload. Properties использует прежний field properties-size и прежний panel hook. Подложки, собственные изображения и мебель сохраняют прежние upload/selection/persistence seams. tests/support.admin.spec.mjs использует support-message, support-attach, support-preview, support-preview-text и support-download, проверяя подготовленный сервером пакет и скачанный JSON; эти hooks и операции сохранены, сообщение не отправляется.

Новые проверки размеров, общих состояний, переноса длинной подписи, двух строк инструментов на узком экране и вложенного цвета относятся к продуктовому репозиторию: существующие смоки и demo/ui-lab/editor-kit-audit.mjs на genuine pinned HA components и синтетических данных. Выбор объекта через API в этой фикстуре — подготовка кадра, а не доказательство нативного выбора мышью. Оно не заменяет продуктовые smokes и настоящие E2E.

Фактических правок E2E для накопления перед первой бетой 1.84 нет. Эта оценка не объявляет live E2E выполненным: обязательный предрелизный прогон на настоящем HA остаётся частью выпуска.
