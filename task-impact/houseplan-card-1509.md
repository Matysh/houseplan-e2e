# House Plan #1509 — 2.5D window-light continuity

Source: https://github.com/Matysh/houseplan-card/issues/1509

Needed: yes / надо. Before the next beta, extend real HA lighting coverage as tracked in https://github.com/Matysh/houseplan-e2e/issues/92.

Use a synthetic window/room, fixed sun above 3°, 2.5D and Glow. After the solar fade settles, toggle a light on/off through real HA. The 500 ms whole-scene light transition must retain unchanged sunlight at its existing animation phase, including an in-flight two-second solar-threshold fade. Preserve reduced-motion, service and geometry oracles. No new visual baseline is implied.

Product-side addressed browser regression: demo/smoke_iso_sun.mjs. The pre-fix Chromium run failed four phase-continuity assertions while geometry and all pre-existing sunlight assertions passed. This is a synthetic browser witness, not a real HA E2E run. Actual companion scenario implementation and execution remain due before beta.
