# House Plan #1542 — wide value outline in 2.5D

- Issue: https://github.com/Matysh/houseplan-card/issues/1542
- Verdict: no HA E2E updates required. The fix changes the displayed outline bounds of a standalone 2.5D tile. HA values, wall contacts, saved geometry, and device actions keep their existing contracts.
- Regression coverage: `test/iso-device-face.test.mjs` checks primary and auxiliary values against their original clearance on straight and angled contacts. `demo/smoke_iso_device_presentation.mjs` checks the displayed outline around measured values through all eight camera positions.
