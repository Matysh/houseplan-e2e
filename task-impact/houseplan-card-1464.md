# House Plan #1464 — house-only ZIP

Needed: yes. New writer-visible transfer, not an adjustment to full-backup
expectations. Companion: https://github.com/Matysh/houseplan-e2e/issues/76.

`tests/house-transfer.admin.spec.mjs` drives real dialog export/download,
opens the actual ZIP and checks its format, privacy and image hashes. It then
previews/cancels, retries immediately, applies and reloads. Server oracles
retain the target floors/devices/settings/layout, verify new scoped stair
destinations and fetch the actual background bytes. The description wrapping
assertion protects the clipping found while developing the new option.

Gate only by advertised optional `house_transfer_api === 1`; no invented
first-stable version, no weakening of the old full-backup/admin contracts.
The existing fixed beta subset is unchanged; this case joins the complete
journeys roster and has an addressed local execution for the feature.

Local acceptance on2026-11-18: synthetic HA2026.11.1 on loopback18464,
Playwright1.62.0 Desktop Chrome1280×800. Auth/setup/model prerequisites passed.
An initial test-only missing-array assumption was corrected (`stairs` may be
absent on a floor without stairs). The addressed case then passed; after the
UI wrapping correction it passed again on the rebuilt candidate in13seconds.
Only this scenario was retried, not the green auth/model prerequisites.
No owner HA, baseline replacement or release.
