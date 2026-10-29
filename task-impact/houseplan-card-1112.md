# E2E verdict for houseplan-card #1112

Вердикт: **надо**.

The shared static-card config store now filters config/layout revision echoes, coalesces event bursts over 200ms and reads only the changed snapshot half. Unit tests cover the store and a held-response race. The native synthetic smoke covers five trusted full-card drags and explicitly buffers their ACKed layout notifications into one network burst before delivering them to two static cards. It proves one shared layout/get, zero config/get, current revisions and painted server positions. It does not assert that five independent drags separated by more than200ms cause one read.

A real HA dashboard run should prove:

1. Full card and two houseplan-space-card elements share an authenticated connection; a real layout/update changes the correct marker on both static cards after the ACK.
2. A burst of current layout revisions causes at most one shared layout/get and no config/get, while equal/older config/layout events cause neither reads nor visual rollback.
3. A new config revision refreshes current configuration/capabilities; layout-only updates preserve the configuration half. A revisionless legacy event still refreshes current data.
4. Virtual-light events keep their immediate behavior and their state survives a following layout-only refresh.
5. A layout event received during a held config/layout read cannot let the older response overwrite the new snapshot. A forced refresh to a new connection with lower revisions must retire old revision high-water even when an old connection event arrives while the new read is held; a later low current revision must still refresh.

Implementation and execution of companion E2E stay in the next beta preparation, not this source task. No HA harness/test code was changed here.

Accepted: source43ee3364ea4e58668279a2faf68254c4afc1f63a; devccc62ef113c53f6de4c97e3b09ca7c1b56be9a81. CODE r1 GREEN H0/M0: https://github.com/Matysh/houseplan-card/issues/1112#issuecomment-6466727640 . Auto-merge:6466735777; exact CI40670479506 SUCCESS. Native7/7 was independently re-executed by the reviewer on final SHA.

## Подготовка реализации перед beta.4 — 29.10.2026

Пять путешествий подготовлены в `tests/static-sync.admin.spec.mjs`, transport/HA
fixture в `tests/lib/static-sync.mjs`; четыре обычных fixture/privacy/gate unit —
в `test/static-sync.test.mjs`. Локальные syntax/contract-lint/unit4/4 и обнаружение
пяти Playwright тестов прошли. Это **не PASS настоящего HA/браузера**: исполнение
ожидает точного beta.4 кандидата в GitHub Actions. На beta.3 сценарии честно
пропускаются; такой skip не является доказательством новой функциональности.

Пятый сценарий — публичная передача того же owned host с A на отдельное реально
аутентифицированное соединение B. Ответы HA остаются настоящими; пока GET B
удержаны, B ещё не подписан на события, поэтому проверяется реальная доставка
старому A и отсутствие выдуманной доставки B. Это не автоматический reconnect
фронтенда HA. Финальный кандидат/CI URL и фактические результаты будут записаны
после выполнения, до публикации беты.
