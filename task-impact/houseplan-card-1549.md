# House Plan #1549 — first optimization preview

- Issue: https://github.com/Matysh/houseplan-card/issues/1549
- E2E impact: the existing first-space journey covers the fix. It failed on the published beta.7 while opening Optimize Plans and passed on the corrected product build with Home Assistant 2026.11.0.
- The journey still checks that the exact graph persisted and that Optimize performs no write when there is nothing to change.
