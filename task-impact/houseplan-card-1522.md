# Houseplan Card #1522 — server startup floor preview

- Source: https://github.com/Matysh/houseplan-card/issues/1522
- E2E impact: required; https://github.com/Matysh/houseplan-e2e/issues/103
- Covered by `tests/startup-floor-1522.admin.spec.mjs` from 1.86.1-beta.2:
  real Home Assistant, synthetic plan, separate browser contexts for the
  publisher and receiver. Compare the server preview against the independent
  live view on desktop and on a Pixel 7 viewport, including furniture, Flat
  wall hatching, 2.5D straight and diagonal views, and summary-panel fit.
- The late-summary case proves local #1520 is served without requesting a
  server preview. The late server-packet case proves a changed badge footprint
  declines the old preview and that steady state updates do not reseal it.
- Worker delay in order tests is not a performance measurement. The paired
  timing tests are separately opt-in and use a larger synthetic floor.
