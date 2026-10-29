# Влияние Houseplan #1113 на E2E — итог после S8

- Задача: https://github.com/Matysh/houseplan-card/issues/1113 .
- Дата: 2026-10-29.
- Вердикт: **надо**.
- Продукт принят автоматически в **S8-merged**: CODE r1 **H0/M0**, [6485424202](https://github.com/Matysh/houseplan-card/issues/1113#issuecomment-6485424202), [CODE report](https://github.com/Matysh/houseplan-card/blob/0d55dec1c20d099f3e6f0576298357aeacfed497/docs/reviews/CODE-REVIEW-1113-r1.md).
- Reviewed source: c359c1d9d5e2c8c0331f315d8a8dc6cde082f8ff. Accepted dev: 0d55dec1c20d099f3e6f0576298357aeacfed497.
- Первый публичный релиз профилей и kiosk routes #1103 — будущая **1.83.0-beta.4**. Immutable beta.3 их не содержит; текущая старая package version у source diagnostic не означает публикацию этих возможностей в beta.3.

## Почему нужны реальные journeys

Серверный namespace, durable link ID, приоритет URL/профиль/локальные предпочтения,
отдельные браузерные состояния и новая authenticated read-only WS-подписка для
non-admin требуют настоящего HA и независимых клиентов. Native synthetic wire,
unit/harness и Golden покрывают свои границы, но не заменяют эту проверку.

## Реализованные четыре journeys

| Journey | Immutable companion source | Фактическая проверка |
| --- | --- | --- |
| Cold saved profile | [panel-profiles.admin.spec.mjs](https://github.com/Matysh/houseplan-e2e/blob/063950d6f0ad6c8c4f4473d933591ce8ab1281ce/tests/panel-profiles.admin.spec.mjs) | Реальные floor/rotation/sizes/display defaults; публичная ROOM matrix подтверждает0°/90°; редакторы недоступны пользователю |
| Native admin Save → live read-only viewer | тот же admin spec | Реальный native Save и ACK, patch exact base/successor, namespace-only изменение, нулевой дополнительный viewer config GET, без navigation/нового connection/resync/closed |
| URL overrides and local identity | тот же admin spec | URL выше профиля и native local choices; effective display/rotation и сохранённые локальные значения проверяются независимо |
| Delete/old URL/new ID/rights | [panel-profiles.viewer.spec.mjs](https://github.com/Matysh/houseplan-e2e/blob/063950d6f0ad6c8c4f4473d933591ce8ab1281ce/tests/panel-profiles.viewer.spec.mjs) | Live fallback после удаления, новый ID не захватывает старый URL, fresh browser, read-only UI и настоящий server unauthorized; разрешённый local-only summary Save не пишет shared config |

Общий собственный helper:
[tests/lib/panel-profiles.mjs](https://github.com/Matysh/houseplan-e2e/blob/063950d6f0ad6c8c4f4473d933591ce8ab1281ce/tests/lib/panel-profiles.mjs).
Все обращения идут через реальные HA WS/API и public DOM/native input.
Нет synthetic HA bus, private product property writes, auth payload dumps или
редактирования .storage. Safe HA semver receipt берётся только из уже полученного
auth_required.ha_version.

## Исполненное доказательство и точная граница

[Diagnostic run40795559572](https://github.com/Matysh/houseplan-e2e/actions/runs/40795559572)
завершён SUCCESS. Exact product:
**3b6d13a1ecadcf6ae962dec6113af162aa86d481**; exact companion:
**063950d6f0ad6c8c4f4473d933591ce8ab1281ce**. Actual HA **2026.10.4** из server
greeting; четыре собственных profile journeys **4/4 PASS с первой попытки**,
без собственных skip/flaky:7.607/20.498/35.919/35.340s.

Measured live sequence: подготовительный настоящий ACK37 материализовал старые
defaults; затем измеренный native Save37→38 имел
nonprofileChangedPaths=[], ACK38. Viewer имел2начальных config GET и **ΔGET0**
после Save,1WS/1navigation; actual ready37 затем update38/base37 с complete
profile patch, без resync/closed. Cold physical ROOM angles0°/90°. Источник
этих фактов: FOUR-PROFILE-PROOF.json, safe receipts и original HTML report,
сохранённые в task evidence profiles-e2e/preflight3.

Main diagnostic suite:54PASS/0FAIL/5SKIP; все5skip — только static-sync #1112
с честной beta.4 version boundary. First-run4/4 и upgrade3/3 PASS. Эти skip
не считаются PASS и обязаны исполняться на final beta.4.

Это **source diagnostic proof**, не samecommit acceptance для c359 или будущей
беты. ProductA/render inputs между3b иc359 не изменились (FPcd31dbf3…);
добавлены relay schema mirror/PDF smoke readiness/evidence. Такая эквивалентность
полезна для контекста, но не подменяет final exact-source gate.

## Предыдущие RED сохранены

- [Первый diagnostic40790193176](https://github.com/Matysh/houseplan-e2e/actions/runs/40790193176):
 51PASS/3FAIL/5SKIP. Ошибки fixture/oracle: hidden header DOM mistaken for
 visible controls, disabled initial no-op Save и разрешённые local summary
 settings у nonwriter. Их исправления не ослабили серверные права/no-write,
 shared contents, native input и display oracles. Actual Core semver первого
 run не устанавливался ретроспективно по floating tag.
- [Второй40793245387](https://github.com/Matysh/houseplan-e2e/actions/runs/40793245387):
 52PASS/2FAIL/5SKIP. Device bbox centres содержали upright face/text; заменены
 public physical ROOM CTM при прежней3°границе. Native Save вместе с профилем
 менял ещё6полей; rev-only event и full reload были правильным mixed fallback.
 Fixture теперь делает настоящее подготовительное изменение другого своего
 профиля и ACK до viewer baseline. Измеренный namespace-only/GETΔ0 guard сохранён.
- После этих конкретных corrections third run4/4 PASS; старые RED не объявлены
 прошедшими и не выданы за дефекты продукта.

## Что обязательно выполнить до beta release

1. Установить точный единый принятый **beta.4 candidate** после #1119/#1120,
 синхронизировать product DOM contract и записать фактические source/version/
 HA greeting receipts. Выполнить все четыре profile journeys без skip.
2. Выполнить10kiosk journeys #1103 и header semantics #1120. #1120 отменяет
 прежнее ожидание меню/шапки HA в киоске; outer panel header и kiosk menu
 отсутствуют. Поворот/profile motion/contact frames после accepted1119
 проверяются его адресным integration witness.
3. Для новых external-screen-* hooks использовать requireHooks/installedContract
 с firstsince1.83.0-beta.4. Не добавлять поверх них version gate, который
 молча пропустил бы source snapshot со старой package string и новым contract.
 Version gate остаётся для новых #1103/#1120 semantics без новых hooks.
 Unknown/foreign HA запускает newest expectations; skip никогда не acceptance.
4. Root выполняет отдельный accepted-tree versioned relay rollout послеS8:
 stagingdiscard synthetic positives/negatives → тот же проверенный inventory
 prod → health/rollback proof, по scripts/support-relay/README.md §package2.
 Это отдельный операционный prerequisite беты; production POST-тестов не нужно.

Final exact beta.4 run и операционная выкладка здесь **ещё не заявлены PASS**.
