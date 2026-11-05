# #1296 — real HA: исполнено адресно

Источник: https://github.com/Matysh/houseplan-card/issues/1296 .
Product — точный опубликованный v1.84.0-beta.5, source a4dd940c1190ee62581c187fa500db3c73f66d1c,
ZIP SHA256 ec36f4646787976255bdd09adc8d49c32dfbf3bd2f0936e0c64d9ddb7ea6b173.
HA 2026.10.4; один полный profile deletion/new-ID/read-only journey, setup 3/3.

Прежний sizeDialog отпускает нативную мышь через 3100ms, хотя браузер может
позже доставить 3000ms callback. Исправлен только helper: ждать видимого dialog,
сохраняя pointer down, отпускать в finally и при успехе, и при ошибке.
Обычный expect сохраняет прежний timeout. Ни приватного открытия, ни retry,
ни повышения timeout, ни изменения продуктового runtime.

В собственной копии лабораторного теста публичный window.setTimeout для delay===3000
доставляется через 3600ms; остальные таймеры неизменны. Это детерминированная
проверка класса гонки, а не доказательство точной временной шкалы исходного CI.
Все assertions исходного journey сохранены: удалённые/новые ID, 100/100 и250/200,
locked controls, read-only и серверные записи. Старый helper: business0/1,
setup3/3, failure на kiosk dialog toBeVisible; исправленный: business1/1, setup3/3.
Без skip и автоматических retry. Контейнеры mES68H / 3y9QB7 удалены адаптером.
Локальные raw reports: root output/issue-1296/{old-hold,fixed-hold}/labs/*/artifacts/results.json.
Contract lint: 57 files PASS. Полный stable-профиль заново не запускался.

Space Undo readiness уже исправлен 1736049f9f98bdf16ac2ab57de2916f0c9310fbb:
пустое Annex проверяется по ready/stage и точной config/layout паре после reload,
затем выбирается исходный непустой этаж. Адресный real HA space PASS ранее получен
на том же ZIP (setup3/3, общий диагностический business2/3, третий отказ был Resize).
Это не новый продуктовый дефект и не второй заново исполненный space journey.

Результат: S8 root fb04ca0fb54e1671bf5384ca404da67bccde0970, ревью41957899723 принято.
Executable companion ceec9aec155585096880863a076aaf9d2e81a0da; root содержит отчёт и полный diff helper.
