# #1120 — итоговая оценка E2E

Вердикт: **надо**. Настоящие narrow/sidebar lifecycle HA и открытие его drawer
не доказываются лабораторным hass mock. Влияние на URL/profile kiosk, соседние
редакторы и реальные ha-icon также проверяется на установленном продукте.

## Принятый материал

- [CODE r2 GREEN, H0/M0](https://github.com/Matysh/houseplan-card/issues/1120#issuecomment-6496117789).
- [Автоматический S8](https://github.com/Matysh/houseplan-card/issues/1120#issuecomment-6496125691).
- Авторский source63056d5e48ed4a618a12d1e6621520f817afbafb; accepted
  dev32cdf439a6cc03eb0f354c2eec63972a60b8d912.
- Runtime совпадает с проверенным source775ef9ee5df6ad3e545d70d9ad22173892c3d0f2:
  fingerprint84b458a5727d200b95022163615e7aa7335b78faaf029f365fa9acdcb186454e,
  manifest SHA256333972167bb4bfd6c68e25e87c6c01bbf0a4138776ec01b8c5de5372b71dcaa7.
  C-only исправление текущего TOUCH-SUPPORT и материалы ревью runtime не меняют.

## Изменения companion выполнены

- Обычная панель проверяет настоящий HA narrow и browser preference switch,
  открывает реальный drawer; отдельный public event witness меняет sidebar без
  замены card/URL. Lovelace не получает меню Houseplan.
- Общий kiosk oracle следует принятому #1120 отсутствию обеих шапок. Сохраняются
  URL order/priority, ACL, dirty guards, stale-cache authority, native leave,
  старый held Save ACK и mounted-card/camera/IO assertions.
- Настоящие touch-свайпы начинаются с края и выбирают существующего соседа по
  painted room IDs и серверному roster. Fixed-floor negative остаётся;
  центральный pan, pinch и точный возврат FitAll проверяются отдельно.
- Desktop journeys с тремя native zoom clicks явно задают1800x1000 до открытия
  плана. Отказ Save → Copy → history остаётся непрерывным, без reload/reset.
- Properties пересекает реальные1023/1024/1025px ha-card. Крестик проверяется по
  центру настоящего SVG во всех3редакторах × full/compact; цель24px сохранена.
- Source snapshot с retirement panel-title исполняет новый panel contract даже
  до version bump; положительные новые hooks не заменяются historical lookup.

## Реальный HA: положительные cases и красные целые прогоны разделены

HA2026.10.4, точный runtime выше:

- [40850423199](https://github.com/Matysh/houseplan-e2e/actions/runs/40850423199):
  journeys59PASS/10FAIL/5staticSKIP. X6cells PASS11.1s. Исходный RED сохранён.
- [40858427221](https://github.com/Matysh/houseplan-e2e/actions/runs/40858427221):
  journeys68PASS/1FAIL/5staticSKIP/0flaky. Native menu13.8s, X6cells14s,
  все admin kiosk и desktop editor/settings cases PASS. Mobile выявил неверный
  post-pan baseline, поэтому весь прогон остался RED.
- [40860469554](https://github.com/Matysh/houseplan-e2e/actions/runs/40860469554):
  journeys67expected/1unexpected/1flaky/5staticSKIP. Дополнительный startup-vs-FitAll
  string comparison ошибочно различал последнюю floating digit; исходная поздняя
  exact viewBox equality сохранена. Независимый реальный Illegal constructor
  HpDialog в dirty ZIP записан в #1125; retry PASS не отменяет первую ошибку.
- [Адресный40862757739](https://github.com/Matysh/houseplan-e2e/actions/runs/40862757739):
  4/4PASS =3setup+1mobile,0skip/0flaky; mobile14.8s исполнил fixed/all swipe,
  pinch/pan, exact FitAll, действительное изменение локального масштаба и его
  сохранение без WS writes, оба viewport bounds. Это **не полный journeys**.

Во всех перечисленных прогонах first-run4/4 и upgrade3/3 прошли. Они не
превращают красный journeys в зелёный. Сборка продукта и соответствующие
source/manifest identities прочитаны из артефактов, не выведены из имени ветки.

## Граница выпуска

Перед beta.4 требуется устранить #1125 и выполнить полный HA на точном конечном
кандидате, включая пять #1112 static cases и новый bootstrap case #1125,
которые старая beta.3 честно пропускает. Такой skip не является доказательством.
Окончательный полный release-run и его результат фиксируются в задачах и
релизном evidence; перечисленные source previews его не заменяют.
