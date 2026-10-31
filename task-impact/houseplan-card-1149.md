# Task impact #1149

Вердикт: **не надо**.

Задача: https://github.com/Matysh/houseplan-card/issues/1149.
Материал: issue/1149-ui-kit-settings, база origin/dev5f1258a3a, product fingerprint `b02023b9fbd69749bab7b7b60f6ffc004f8adbd1ac674aada90f2fc1131a0914`.

Пакет переводит содержимое настроек на общие поля/действия/тумблер/поверхность поповера. Нового шва browser → HA write → reload → persistence нет: все data-hp/data-field, native IDs сводной, accessible names, сохранение/отмена/права и формат конфигурации сохранены. Демо предпросмотра по-прежнему локальное и не вызывает сервисов.

Прочитаны действующие сценарии: tests/summary.admin.spec.mjs использует accessible name Panel title, Value name, Delete и существующие confirm/summary hooks, проверяя конфигурацию на сервере и после reload; tests/lib/panel-profiles.mjs и panel-profiles.viewer.spec.mjs используют external-screen hooks и проверяют существующий конструктор/сохранение и права; editor-devices.admin.spec.mjs покрывает существующие путешествия настройки устройства. Изменённые CSS-классы не являются их контрактом. Удалённый controls киоска не возвращён.

Проверки размеров44px, форматов/alpha/invalid color, переключений, disabled, native focus/close и отсутствия сервисов из предпросмотра принадлежат адресным smoke и pinned HA UI Lab основного репозитория. Репозиторный demo/ui-lab/settings-content-audit.mjs воспроизводит14 состояний ×6 профилей на синтетических данных. Это не результат запуска live E2E на настоящем HA.

Фактических правок E2E для накопления перед первой бетой1.84 нет. Сам предрелизный прогон E2E остаётся отдельным обязательством выпуска. #1150 требует собственной оценки, особенно если изменит публичные hooks или доступные имена редакторов.
