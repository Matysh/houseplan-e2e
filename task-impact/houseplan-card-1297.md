# #1297 — HA E2E: не надо

Источник: https://github.com/Matysh/houseplan-card/issues/1297 .
S8 dev0e2f92ff0387f747c65922d1184b780160e9cd1d, S6 6/6 PASS.
Изменён только synthetic smoke_external_screens: после native pointerdown
ждать видимый kiosk dialog, затем pointerup в finally. Все существующие
assertions профилей, read-only, масштабов, подписок и fallback сохранены.
Продуктовый runtime и contract не менялись. Аналогичный real HA helper уже
исправлен и проверен в #1296; повторять тот HA прогон ради корневого smoke не нужно.
Новых browser-тестов или фиктивного HA PASS это изменение не создаёт.