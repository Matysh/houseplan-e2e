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

Addressed real-HA execution,2026-11-13: product source
`c1ed7d9a32b8cdb22670dd51df45705d8b01f240`, prepared integration ZIP SHA256
`060197c7d8ad499511b193d84998de823a3e4035a93e74f8ec063af7966aa8cc`,
HA2026.11.1, Chromium151. All four selected cases passed: three setup cases
and the new business journey (18.6s, total27.8s). This is the immutable task
build, still carrying1.85.1 metadata, not a claim that the next beta ZIP was
already tested. The beta's fixed HA matrix runs on its own prepared package.
The new journey passed actual nested Done/no-write, Save/ACK/reload, unknown
assigned source, live state/no-config-write, old-writer refusal and a manual
sliding door's Save/reload with its lock preserved.

Two earlier attempts failed in the new test helper: a root-scoped locator was
incorrect inside `has`, then reopening raced the preceding closing animation.
The helper now uses a relative field locator and waits for full parent closure;
product assertions are unchanged. Addressed log: `/tmp/1024-realha-addressed-r3.log`
on the prepared WSL host. These attempts did not trigger broader suite reruns.
