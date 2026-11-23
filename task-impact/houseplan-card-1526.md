# Houseplan Card #1526 — perspective in straight 2.5D views

- Source: https://github.com/Matysh/houseplan-card/issues/1526
- Existing HA E2E coverage remains applicable. The straight and diagonal server startup frames are covered by `tests/startup-floor-1522.admin.spec.mjs`. The straight startup preview must match the corresponding live camera.
- The projection itself is client-side. The Houseplan Card rotation smoke checks all eight camera positions and the floor coordinate round trip. The new square-room golden covers the 16% perspective and opaque front wall. The feature needs no new HA data or authorization scenario.
- A focused HA Core 2026.11.0 replay passed the desktop geometry assertions at 45° on both the published beta.2 and the #1526 package. Both runs reached an existing remote-preview cache-key mismatch in the phone branch. This is a shared baseline failure, and the scenario and its assertions are retained.
