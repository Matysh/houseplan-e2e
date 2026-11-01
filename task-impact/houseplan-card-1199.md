# #1199 — HA E2E: не надо новых или изменённых продуктовых сценариев

Источник: https://github.com/Matysh/houseplan-card/issues/1199.

Исправлен сам isolated HA lab adapter в houseplan-card/process-next: стабильный явный loopback порт на срок жизни контейнера, узкий retry bind collision, проверка ownership перед cleanup и initial/final endpoint evidence. Продуктовые UI/API/данные/права, число и ожидания HA13 остаются прежними. Менять companion-сценарии под отказ окружения не требуется: existing restart/upgrade должны пройти без роста timeout и с тем же origin.

S6 исходной задачи — 18/18 адресных unit-проверок; локального Docker нет. Реальный HA13/restart/upgrade остаётся обязательной проверкой нового release candidate C. Эта запись не объявляет их пройденными и не заменяет исходный красный beta B report.