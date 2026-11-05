# #1295 — HA E2E: не надо

Источник: https://github.com/Matysh/houseplan-card/issues/1295 .
S8 dev4d5bb045134cc1e9bb7ce858baf3229dbd381428; ревью41960177313 принято.
Изменены runner/catalog/cache identity и synthetic timing verdicts, продуктовый
runtime/HA protocol не менялись. Нового real HA пути нет; дополнительный HA
journey ради запускателя не нужен. Обычный release HA набор остаётся обязательным.

Финальный S6:11/11 (3 reused,8 passed),53 адресных Node PASS,151 critical reused.
Пять настоящих browser-профилей (history0/history320/inactive/visible/connected) PASS.
CI41958797300 на предыдущем b36d98d7:9/9, четыре исходных профиля реально PASS.

Исходные FAIL полного beta.5 stable-аудита41920312716 и exclusive CI41957439627
на EPYC7763 сохранены. Парный41956366937 на одной EPYC9V74 подтвердил влияние
конкурирующей нагрузки. Общий процесс изолирует всё семейство и показывает
абсолютные превышения диагностически согласно PROCESS.md; численные лимиты
не повышены, исторические строгие verdicts не переписаны. Неполные/невалидные
измерения, native persisted/single-write и функциональные ошибки остаются FAIL.
Это не результат повторного полного stable-профиля.