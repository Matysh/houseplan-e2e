# houseplan-card #1111

Вердикт: **не надо**.

Изменение оптимизирует in-memory приём уже полученного hass, не меняет WS,
события, сохранённый конфиг/layout, авторизацию и сценарии пользователя.
Корпус реальных getter/intake методов сравнивает инкрементальную проекцию с
полной, отдельно проверяет disabled/parent/authoritative, смену connection/user,
возврат из скрытого документа/маршрута и отсутствие спроса ripple. Существующие
browser smokes сохраняют значения/цвета/ripple, батареи, радар, пылесосы,
live text и recovery; добавлен наблюдаемый случай ripple на другом этаже.
CPU before/after не выдаётся за сетевую или paint latency. Дополнительный
HA E2E не добавляет oracle числа решений или кэш-перестроений; существующие
HA journeys остаются. Сами тесты/harness companion не менялись.

Принято: source7dd01ccbc58e0267044e9de7cc4a7650872990ac; devf00d02d13737077d3d7f331f537c721bc57448f4. CODEr1 GREEN H0/M0 [6467968651](https://github.com/Matysh/houseplan-card/issues/1111#issuecomment-6467968651), auto6467976566. Low unused seam counters не меняет E2E verdict/контракт. ExactCI40677970564/40677970553/40677970495 SUCCESS; browser27/27 fresh, artifact12812595174. LiveS8 подтверждён.
