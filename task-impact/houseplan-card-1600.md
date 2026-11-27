# houseplan-card #1600 — core compatibility contract

Решение: новые HA E2E не требуются.

Задача фиксирует публичный контракт ядра/версий и чтение исторических архивов; не меняет endpoint, редактор, HA restore или пользовательские journeys. Четыре synthetic native plan-transfer/full-backup ZIP созданы реальными exporters pinned stable 1.86.0/1.86.1 и читаются текущим pure core conformance, включая installed wheel/sdist без HA. Release behavioral fixtures проверяют отказ publish при внутренних расхождениях wheel METADATA/distribution.json, HACS manifest.json и standalone manifest даже при обновлённых внешних хешах. Full-backup pure parsing не объявляется доказательством HA restore durability.

Существующие HA backup/transfer journeys сохраняют собственное назначение. Нового браузерного или HA сценария для package/version metadata нет.
