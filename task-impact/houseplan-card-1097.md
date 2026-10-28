# houseplan-card #1097

Вердикт: **не надо**.

Оптимизация меняет только transient preview перетаскивания проёма и работу локальных кэшей. Persisted openings[], прежние commit validation/rollback, права и протокол сохраняются. Trusted native wall/partition drag, отмена, отказ записи, реальные физические producer counters, сохранение тёплых соседних этажей и точный readback уже покрывают изменение. Дополнительный HA E2E journey не даёт нового oracle для локальной перерезки; E2E harness в этой задаче не менялся.

На окончательном материале исполнены 32 smoke и 3 strict Golden (равный PNG SHA256, 0pixel/ratio). Для трёх opening-placement кадров дополнительно подтверждено побайтное равенство принятой #1098 и кандидата; их унаследованное расхождение с глобальным индексом отражено отдельно в задаче и не объявлено global GREEN. Глобальные эталоны не принимались.

Approved source: `9386c7ace890f0f7c729bed1f9675a60306ebf02`.
Accepted dev: `a054526cb676f9957f1b7a7387aad860b454594a`.
[CODE r2 GREEN H0/M0](https://github.com/Matysh/houseplan-card/issues/1097#issuecomment-6475633351); [автоматическое S8](https://github.com/Matysh/houseplan-card/issues/1097#issuecomment-6475646640). R1 Medium о дублированных строках changelog исправлен только документацией. Exact canonical CI40729647602 SUCCESS, artifact12834528944/proof12835072298. LiveS8 и source/build corpus equality с accepted dev подтверждены.
