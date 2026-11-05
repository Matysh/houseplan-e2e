# #1293 — HA E2E: не надо

Источник: https://github.com/Matysh/houseplan-card/issues/1293 .
S8 dev cef7c01a5610be2675165d2ca310cd981e7645c9, ревью41955814649 принято.
Только smoke ждёт фактический server config/get и ACK defaults перед cold remount.
Продуктовый runtime/фасад и визуальные эталоны не менялись; нового real HA пути нет.
S6 6/6 PASS. Потери defaults не подтвердилось: старый smoke преждевременно
принимал truthy Promise от async waitForFunction за завершённое ожидание.