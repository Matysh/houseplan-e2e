# Houseplan-card #1398 - HA E2E impact

Source: https://github.com/Matysh/houseplan-card/issues/1398

Decision: no new real-HA E2E scenario needed.

Unifies transient editor dimension presentation for openings, decor lines and equal device intervals. No schema, HA entity/action, transport or persisted-history contract changes. Native fake-hass tests cover actual selection, drag, field commit/cancel/Undo, camera frames and spacing writes. The 180-degree opening-reference fix is covered by resolver and native drag cases.

Before the next beta, keep the normal editor/visual suite. Compare changed editor images with the owner-approved UI-058 reference in #1398; this record does not accept or overwrite golden baselines.
