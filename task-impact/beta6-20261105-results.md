# Полный stable-профиль опубликованной beta.6 — 2026-11-05

**Прогон завершён, но целиком не пройден: 4 отказа — три browser smoke и один HA journey.**
Адресные повторения и диагностика не заменяют исходный красный результат. Подтверждённой причины всех четырёх отказов пока нет; называть их четырьмя продуктовыми багами нельзя.

[Бета 1.84.0-beta.6](https://github.com/Matysh/houseplan-card/releases/tag/v1.84.0-beta.6) опубликована.
[Полный stable-аудит](https://github.com/Matysh/houseplan-card/actions/runs/41964857128) выполнялся **после публикации**.
Стабильный релиз этой командой не публиковался.

## Проверенный материал и выпуск

- Tag: `v1.84.0-beta.6`; commit `15dd2852876f3f95a8c10295b53cfca9a19df600`.
- Аннотированный tag object: `98362625873ad35b871a9ec061c1dc80a0851e08`.
- Публичный ZIP: 2 043 412 байт; SHA-256 `a358da2ee9ca8538d27f486d9254b67c05256fa4f4bdb1243d49e7e341ea36e2`.
- Публичный JS: SHA-256 `cc085f55d35aba035905b35c8837d829c0ab46bf4c4d18f04e061ed414e1a379`.
- ZIP/JS скачаны из публичного release и совпали с проверенным CI-пакетом. ZIP полного аудита также имеет **тот же SHA-256**; это проверка опубликованных байтов, а не только номера версии.
- Companion: `7e72d572703d59e51a8cefe911064ed3e58e23f2`; HA 2026.10.4; обновление с v1.83.1; Chromium 151.0.7922.34, Playwright 1.62.0.
- Набор беты [CI2](https://github.com/Matysh/houseplan-card/actions/runs/41963627462): 34/34 успешных шагов (7 passed, 27 reused). Применимые результаты исходного CI1 зачтены по identity; ZIP до/после тестовой правки #1298 одинаков.
- Пакетное ship-ревью принято; для нового неизменного кандидата зачтены 43 прежних результата без нового вызова модели.
- #1295 и #1297 достигли S8; найденная до публикации тестовая несовместимость #1298 исправлена и принята независимым ревью. Все вошедшие новые S8 закрыты выпуском. Возврат опубликованного кода в dev завершён служебной #1299; dev `a137f4e50531cf5caa432a52f14a4d154aace5e3`.

## Итог полного набора

Runner: `20261105T040021728-ce274fe0`; materialClean=true.
04:00:21–05:10:11 UTC, 69 мин 49 сек. Все 550 запланированных шагов получили результат:
**515 passed + 29 reused + 4 failed + 2 not-required**.

| Область | Итог | Как получен |
|---|---|---|
| Node | 4624 PASS, 1 SKIP, 0 FAIL | 11 применимых групп зачтены из проверок беты |
| Backend | 2950 PASS, 1 SKIP, 0 FAIL | Применимый набор беты зачтён; coverage threshold проверен в stable |
| Browser smoke | 520/523 успешно, 3 FAIL | 507 реально прошли + 13 зачтены |
| Golden | 326/326 PASS | 251 кадр проверен в этом прогоне + 75 зачтённых; новых эталонов не принимали |
| HA business | 88/89 PASS, 1 FAIL | 13 зачтены из беты; остаток 75/76, ноль skip/unexecuted |
| HA setup | 10/10 PASS | 7 зачтены, 3 выполнены для остатка |
| Внешние конвертеры | 3/3 PASS | Выполненная отдельная диагностика |
| Backend coverage | 90.5% по CLI при пороге 87.2% | XML: 18032/19936 строк, line-rate=0.9045 |

Два not-required — пустые остатки HA first-run и upgrade: их случаи уже вошли в бету.
Node skip — отсутствующий приватный #281 fixture; backend skip — приватный #280 fixture (CI использует анонимизированный контракт). Эти пропуски не выданы за выполненные кейсы.

Первый этаж Resize −3 → Keep room-f → Resize +1 → Keep room-b и остальные адресные #1264 HA случаи прошли. Прошёл также profile deletion/new-ID/read-only, исправленный в #1296. Прежние snap/chain/weather/decor отказы beta.5 не повторились.

## Четыре отказа и адресная диагностика

### 1. Optimize: узкий блок повторной проверки — #1300

[Задача #1300](https://github.com/Matysh/houseplan-card/issues/1300).
`smoke_optimize_unverified`: `layout_retry_light_ru_360` и `layout_retry_dark_ru_360` FALSE; остальные 34 утверждения чтения/Copy/Close/Retry, keyboard и zero-write прошли.

Неизменённый последовательный повтор на точном публичном frontend воспроизвёл light FALSE, dark PASS.
В отдельном инструментированном запуске assertions/runtime не менялись; он не воспроизвёл FALSE. Измерены surface 0..360, body 360/360, block 332/332 и высота обеих кнопок 44 px. После paint размеры те же. Скриншоты сохранены.

Вывод: нестабильность воспроизведена, но конкретный неверный размер в исходный момент FALSE пока не записан. Гипотеза — готовность layout после viewport/media change; постоянный CSS-дефект и конкретное исправление не доказаны. Повторный PASS не закрывает исходный FAIL.

### 2–3. Первые Zigbee hover/layout — #1301

[Задача #1301](https://github.com/Matysh/houseplan-card/issues/1301).

- `smoke_zigbee_led_topology`: только первое `icon hover draws confirmed route to LED` получило 0 вместо 1. В CI point `(1206.833679,287.693878)` для `d_lamp`, hoverOwner=null, actualHit — polygon комнаты. Остальные route/LED/geometry/touch/pen assertions прошли.
- `smoke_zigbee_tooltip_layout`: только `z2m_flat_light_unplaced` FALSE; остальные режимы/темы/проекции, old-placement negative control, clamp, pointer transparency и взаимодействия прошли. Числового CI witness первого FALSE в загруженном артефакте нет.

Оба исходных smoke прошли один последовательный адресный повтор на точном публичном JS **без правки кода**. Это доказывает вариацию исхода, но не продуктовый фикс. Гипотеза — координаты/paint первого hover во время смены камеры/отображения; причинная связь пока не подтверждена. Нативный hit комнаты в CI сохранён как факт, а не назван отсутствующим Zigbee-маршрутом.

### 4. Real HA Static handoff — #1302

[Задача #1302](https://github.com/Matysh/houseplan-card/issues/1302).
`static-sync.admin.spec.mjs`: `held old reads cannot replace newer events, and a real connection handoff drops the old revision high-water`.
После fixture-owned handoff двух Static-host helper подтвердил authenticated=true; на строке 277 `wire.heldReads(2)` получил 0 вместо >=2 за 20 сек. Первый race до handoff прошёл; проверки ниже места отказа в этом CI не выполнены.

Один адресный полный повтор в собственной HA 2026.10.4: business 1/1, setup 3/3, 0 skip/retry. Тестовый файл не менялся; в копии lab helper добавлен только finally-log безопасных wire-метаданных.
В повторе A удержал реальные config/layout replies; B имел connections=2, holdConnection=2 и оба настоящих config/get и layout/get pending. Затем все исходные assertions прошли. Исходная причина нуля в CI (выбор fixture connection либо продуктовый authority/store) не установлена; повтор не считается исправлением.
Лаборатория `hp-e2e-journeys-8NlkgR` собственная, контейнер очищен адаптером. Пользовательский HA не менялся.

## Производительность и ограничения сравнения

Пять реальных профилей #1295 (`history0`, `history320`, `inactive`, `visible`, `connected`) прошли без функциональных/измерительных ошибок **и без превышений прежних абсолютных потолков**. Selective серии: 80/80/40/40 samples; connected strict budget pass=true и executionPass=true. Поэтому четыре оставшихся отказа не относятся к этим бюджетам.

Сопоставимого опубликованного measurement последнего stable нет: primary comparison явно missing, requiresDecision=false. Это не зелёное относительное сравнение. Старый фиксированный anchor остаётся диагностикой; его размеры/время не выданы за сопоставимую новую базу. Наблюдённые значения и CPU/условия сохранены в metrics/measurement артефактах.

Адресные повторы выполнялись на WSL, Node 22.23.2; CI — Node 22.23.4. Browser/payload закреплены, условия CPU не объявляются одинаковыми. Локальный PASS не отменяет исходный CI FAIL.

## Доказательства

- `stable-summary.json`, `publication-summary.json` рядом с этим отчётом.
- Raw: `output/beta6-20261105/stable-ci1/process-next/.state/runs/20261105T040021728-ce274fe0/`.
- Full HA: `stable-ci1/artifacts/process-next-e2e-labs/hp-e2e-journeys-n2Upe8/artifacts/results.json`; опубликованный CI содержит trace/video/скриншот одного HA-отказа.
- Диагностика: `diagnostics/browser-repeats.json`, `*-repeat.log`, `optimize-rects.log`, `optimize-retry-{light,dark}.png`, `diagnostics/ha-static/{summary.json,commands.log,labs/.../artifacts/results.json}`.
- Принятые #1295/#1297 и дополнительная #1298 завершены; оставшиеся наблюдения заведены как #1300–#1302 и не помечены продуктовым исправлением или пройденным stable.