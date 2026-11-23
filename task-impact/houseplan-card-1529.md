# Houseplan Card #1529 — window glass and upper wall cuts

- Issue: https://github.com/Matysh/houseplan-card/issues/1529
- Verdict: no E2E changes needed. This shares the client-side perspective-depth fix from #1528. Existing opening-state and space settings scenarios remain applicable.
- Regression coverage: `test/iso-opening-refinement.test.mjs` checks opaque and translucent cut planes and keeps the exposed portion of the pane visible.
