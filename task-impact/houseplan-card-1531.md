# Houseplan Card #1531 — perspective device outlines

- Issue: https://github.com/Matysh/houseplan-card/issues/1531
- Verdict: no E2E changes needed. The existing group layout, wall contacts, and hit ownership are preserved. The change is in the glass paint coordinates.
- Regression coverage: `test/iso-marker-outline.test.mjs` checks six wall-contact markers across all four perspective angles. S6 browser coverage uses `demo/smoke_iso_device_contours.mjs`.
