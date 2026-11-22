# Houseplan Card #1526 — perspective in straight 2.5D views

- Source: https://github.com/Matysh/houseplan-card/issues/1526
- Existing HA E2E coverage remains applicable. Replay the straight and diagonal server startup frames in `tests/startup-floor-1522.admin.spec.mjs` on the beta candidate. The straight startup preview must match the corresponding live camera.
- The projection itself is client-side. The Houseplan Card rotation smoke checks all eight camera positions and the floor coordinate round trip. The new square-room golden covers the 16% perspective and opaque front wall. The feature needs no new HA data or authorization scenario.

