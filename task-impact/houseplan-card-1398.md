# Houseplan-card #1398  HA E2E impact

Source: https://github.com/Matysh/houseplan-card/issues/1398

Decision: no new real-HA E2E scenario needed.

This task unifies transient editor dimension presentation for openings, decor lines and equal device intervals. It changes no schema, HA entity/action contract, transport or persisted history. Native fake-hass tests drive actual selection, drag, field commit/cancel/Undo, camera frames and spacing writes; existing HA editor scenarios remain applicable. The 180-degree opening-reference fix is covered at the physical resolver and native drag levels.

Before the next beta, retain the normal editor/visual suite. Any changed editor image must be compared with the owner-approved UI-058 reference in houseplan-card #1398; this record does not accept or overwrite golden baselines.
