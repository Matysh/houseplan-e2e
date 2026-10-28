# houseplan-card #1101

Вердикт: **не надо**.

Изменение переносит CPU-подготовку `houseplan/space/delete` в executor без изменения внешнего WS, ревизий, хранилища, UI или сценария пользователя. Наблюдаемый контракт остаётся покрыт существующими real-HA WS tests удаления и парной записи. Новый HA-harness тест на реальной migrated large-house фикстуре непосредственно проверяет worker-thread выполнение candidate/schema/canonical функций и удержание write_lock; второй удерживает executor await и проверяет конфликт конкурирующего config/set. Browser E2E не даст дополнительного oracle владения потоком/блокировкой, а его дублирование через тот же WS не усилит эти доказательства.

До правки large-house test RED (`_space_delete_target ran on the event loop`). После: `python -m pytest tests_backend -k space_delete -q` PASS29, старые ожидания не менялись. Новые browser/E2E harness steps не нужны. Исходный task source be371e5ec6ea22f9af224100d8ebbe4bdd463796.

Принято и влито автоматически: bb09148f2cabc5aa71b457a6389a4371bafb9bb1 (dev), sourcebe371e5ec6ea22f9af224100d8ebbe4bdd463796. CODEr1 GREENH0M0: https://github.com/Matysh/houseplan-card/issues/1101#issuecomment-6465899360 ; процесс40666813631SUCCESS; exactCI40664483608GREEN. Liveissue1101S8-merged подтверждён. Сами E2E/harness изменения не выполнялись.
