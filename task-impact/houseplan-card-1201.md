# #1201 — HA E2E: не надо

Источник: https://github.com/Matysh/houseplan-card/issues/1201.

Отрицательный metadata pattern в unit-тесте планировщика собирается как данные и не выглядит ложным input glob. Смысл assertion и проверки реальных source/consumer сохранены. Product UI/API, геометрия, хранение и реальные HA-пути не затронуты; новых HA-сценариев не требуется. S6 syntax/catalog прошёл без продуктовой сборки и warm retry.