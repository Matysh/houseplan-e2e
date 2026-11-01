## #1193 — HA E2E: не надо

Источник: https://github.com/Matysh/houseplan-card/issues/1193

Изменяются только синтетический browser/Golden icon fixture и его общая подготовка/происхождение. Реальный Home Assistant загружает собственные MDI; UI продукта, данные, права и HA-пути не меняются. Регрессия проверяется в самой задаче: обновление карты при bundle-sync, исключение локальных outputs, реальные mdiPalette и SVG path настоящего synthetic HaIcon, checksum в capture provenance. Новых/изменённых реальных HA E2E сценариев не требуется. Визуальные кадры, затронутые исправленной icon fixture, переснимает release coordinator; эталоны автоматически не принимаются.
