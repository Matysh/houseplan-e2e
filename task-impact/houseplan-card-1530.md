# Houseplan Card #1530 — device occlusion at opaque wall cuts

- Issue: https://github.com/Matysh/houseplan-card/issues/1530
- Verdict: no E2E changes needed. The change is confined to rendering; HA entity reads, settings persistence, and device interaction contracts stay the same.
- Regression coverage: `test/iso-wall-transparency.test.mjs` checks opaque top caps versus side-wall attenuation and opt-in wall transparency. S6 browser coverage uses `demo/smoke_iso_device_contours.mjs`.
