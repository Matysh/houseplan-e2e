# Houseplan-card #1024 — HA E2E needed

Source: https://github.com/Matysh/houseplan-card/issues/1024, companion issue #44.

Added `tests/opening-features.admin.spec.mjs`: real nested UI draft and outer
Save → server ACK → reload, independent top/shade/contact settings, unavailable
assigned source without manual fallback, current live state without config
writes and old-writer refusal. Fixture restoration reads the fresh capability
and supplies the marker only when advertised; old HA builds retain the old path.
The scenario explicitly skips products predating the new action contract.

Native/model tests in the product cover optical control points, orientation,
Copy/portable transfers, door/gate mechanisms and Flat/2.5D geometry; these are
not represented as new real-HA journeys. Actual execution and exact candidate
are recorded in companion #44 before beta publication. Owner HA is never used.
