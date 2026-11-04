# beta.5 — фактическое исполнение 05.11.2026

Houseplan `v1.84.0-beta.5`, source `a4dd940c1190ee62581c187fa500db3c73f66d1c`.
ZIP SHA-256 `ec36f4646787976255bdd09adc8d49c32dfbf3bd2f0936e0c64d9ddb7ea6b173`.
Companion в обоих CI: `080bbbe5d793a10fd9388104874dbbc884edbe6f`, HA 2026.10.4.

- [Фиксированная beta](https://github.com/Matysh/houseplan-card/actions/runs/41916469593): journeys 10/10, first-run 2/2, upgrade 1/1; без HA skip.
- [Полный stable-профиль на опубликованном теге](https://github.com/Matysh/houseplan-card/actions/runs/41920312716): остаток journeys 73/76, без skip; два других остатка пусты. Конвертеры 3/3.
- Это не зелёный stable: помимо трёх HA случаев упали девять browser smoke. Все 326 golden, Node/backend и порог backend coverage прошли.

Добавленный first-run исполнил реальный Draw диагональной опоры и точного T,
серверное сохранение/export/reload и no-op Optimize без новых config/layout revisions.
Device journey исполнил Delete/Undo/Redo виртуальной копии с проверкой серверной пары.
Room journey в остатке stable исполнил перемещение подписи Sauna и Delete/Undo/Redo.

Space journey успешно проверил удаление пустого Annex и точное восстановление config/layout,
затем ошибочно потребовал комнаты на выбранном восстановленном пустом пространстве после reload.
В тесте исправлен только этот precondition: проверяются ready/stage и полная сохранённая пара,
потом выбирается исходный непустой этаж и проверяется его отрисовка. Остальные assertions сохранены.
Адресный локальный повтор на том же ZIP в собственном HA 2026.10.4: space PASS,
profile-deletion PASS без изменения его кода, first-floor Resize FAIL; setup 3/3, business 2/3,
без skip и автоматических retries. Лаборатория `hp-e2e-journeys-mFkuly`, контейнер удалён адаптером.
Это адресная диагностика, не замена исходного полного красного CI-отчёта.

Неустранённый Resize: `regressions-beta4-extra.admin.spec.mjs`, первый drag `room-b`, edge 0,
steps -3 не даёт наблюдаемого изменения server config за 20 секунд. Повтор подтвердил отказ.
`panel-profiles.viewer.spec.mjs` падал при ожидании kiosk scale dialog для нового профиля;
адресный повтор неизменного сценария прошёл. Это нестабильный результат, не подтверждённое исправление.

Исходные task-impact планы шире реально добавленного HA набора. Перенос тела/двери,
все варианты швов, legacy отчёт Optimize, физические tombstones и оба непустых режима
удаления пространства не объявляются выполненными browser cases. Адресные unit/backend
доказательства и оставшийся browser-план сохраняются раздельно.