# Task impact #1225

Source: https://github.com/Matysh/houseplan-card/issues/1225.

The house seed still starts as the original legacy plan. Its first migration
is a native Draw + accepted Undo, using the current SVG transform and public
hit testing. Both snapped endpoints and the line between them must be exposed
in the viewport, outside Properties and existing room/wall/device boxes. The
room/opening/partition census is retained. No private product properties,
pre-normalized graph seed or direct config write stands in for this edit.

Current profile fixtures use `external_screens_api=2` and the v2 per-space
views. The existing first profile journey intentionally starts from v1, checks
read/cancellation/inner OK without a durable migration, and migrates only by
native outer Save. Later current fixtures and cleanup preserve v2 and the
monotonic identity counter; event/patch envelope remains v1. Historical API1
fixtures remain separate and explicit. Retired hidden-device profile fields
do not overwrite the browser's ordinary Hidden preference.

PR16 (`61497db39e9982520349ce2c16cb1cd7a57b739a`) is retained through the
patch-equivalent cherry-pick `7a10cb9`; the original commit is not an ancestor
of this branch, and the original PR was not overwritten. Its exact-graph first-use journey
uses the same exposed-target selection for L/X and node dragging. Its native
server, ID, Undo/Redo, export and reload oracles are retained.

The selected business count is unchanged: 10 beta journeys + 64 remainder,
two first-run and one upgrade. The two empty remainders remain not-required.
Unit/fixture/discovery checks are preparation evidence; none is a PASS of
the 77 real HA business cases. Their result requires a pinned product and
companion SHA in the shared product runner's disposable HA labs.

Open impact notes #2, #3, #6, #9, #11–#15 were reviewed. This change addresses
the current profiles/legacy reader and preserves PR16's graph journey. It does
not declare every independent feature-specific impact note covered or close
them merely because discovery succeeds. In particular touch Area details,
return-stair highlight, the kiosk switcher, LQI threshold and live weather
subscription assertions still need their own explicit acceptance evidence.
