# Houseplan Card #1528 — depth at crossing 2.5D faces

- Issue: https://github.com/Matysh/houseplan-card/issues/1528
- Verdict: no E2E changes needed. The issue changes client-side surface clipping only. Existing rotation, entity binding, and startup scenarios remain applicable.
- Regression coverage: `test/iso-opening-refinement.test.mjs` checks the visible portions of intersecting door and wall planes at sampled pixels, including the translucent-wall render path.
