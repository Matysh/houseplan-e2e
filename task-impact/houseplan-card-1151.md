# #1151 — влияние на E2E после S8

Вердикт: **не надо**.

Задача: https://github.com/Matysh/houseplan-card/issues/1151.
Авторский материал:1f3f73f64df058182da626ea1588990f97279f04.
Точный task CI: https://github.com/Matysh/houseplan-card/actions/runs/41010780900 — SUCCESS.

Одна строка CSS задаёт уже существующий16px отступ пустому результату каталога устройств вместо неопределённого токена. Фильтрация, состав/действия каталога, HA transport, права, data-hp и сохранённые документы не меняются. Реальный unmatched-search oracle в существующем product smoke_device_inbox проверяет computed padding desktop/390px, отсутствие overflow и прежние config/layout/rev.

Это product layout oracle, нового HA шва/путешествия нет. Существующие editor-devices/settings/read-only journeys остаются прежними. Companion не использует несуществующий --sp-8 и не требует нулевого отступа, обновлять ожидания не требуется.

Накопленных правок E2E нет. Итоговый полный HA E2E запускается на точном beta candidate после обеих задач; задача сама по себе не доказывает этот будущий результат.
Автоматический S8: https://github.com/Matysh/houseplan-card/issues/1151#issuecomment-6517482185.
Принятый dev:1f3f73f64df058182da626ea1588990f97279f04 (тот же проверенный материал).
Ship route: https://github.com/Matysh/houseplan-card/issues/1151#issuecomment-6517477905.
Пакетное ship-ревью и full candidate CI остаются обязательными перед beta.
Пакетное ship-ревью41021315095 остановлено execution audit: один Grep из33 не имеет journal decision (65 calls/64 journal rows, expected allowed,0 permission denials). Сертификат diagnostic-only не даёт допустимого SHIP-вердикта. Код остаётся S8, но выпуск заблокирован до решения владельца о единственном штатном повторе с прежними защитами. Run: https://github.com/Matysh/houseplan-card/actions/runs/41021315095.
