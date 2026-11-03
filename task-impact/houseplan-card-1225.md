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

## Actual HA evidence and addressed follow-up

The ordinary shared fallback run [41632300999](https://github.com/Matysh/houseplan-card/actions/runs/41632300999)
pinned product `a07f4a10309c7b187ab122cf3227002f04c2e81d`, this companion's
`6103fce2223768f7419192cdfa791ca51d232a49`, HA2026.10.4 and upgradev1.83.1.
All77 selected business cases executed:66 passed,11 failed,0 skipped and0
unexecuted. All10 setup executions passed. First-run/upgrade remainders stayed
not-required. Published summaries were independently retranslated from raw
Playwright JSON and matched. This is evidence of real execution, not a green
release audit. The per-case primary paths and classifications are retained in
`houseplan-card-1225-ha-results.json` beside this note.

Seven failed business fixtures are ported after primary trace review: exposed
room/decor drawing targets, authored graph endpoint identity, precise footer
Cancel, model11 clone owner identity, a repairable nonstructural bootstrap
reference, and a valid over32MiB negative import. The first-run journey's latent
coordinate-key selector also uses its already-asserted exact graph node ID.
No exact wire/lattice, identity, Undo, durable-state, permission or rejection
oracle is weakened. The newly guarded closed-room helper also rejects occupied
interiors rather than surrounding an existing room with a free perimeter.

These ports are not yet real-HA PASS. Remaining RED cases are explicit: native
lattice provenance [#1237](https://github.com/Matysh/houseplan-card/issues/1237),
strict import migration preceding opening repair
[#1238](https://github.com/Matysh/houseplan-card/issues/1238) (two cases), and the
old material's Optimize preflight refusal before space-copy. The latter candidate
precedes#1227; its toast alone does not prove the same concrete geometry cause.
The dirty ZIP fixtures also retain a known graph/projection mismatch; removing
that assertion or claiming arbitrary self-crossing geometry repair would hide
a real limitation. Separate analysis confirmed the opening repair-order bug on
an otherwise valid current graph document.

Addressed local verification after these ports: visible-target browser helper
3/3 passed (including occupied-interior control); contract lint51 files passed.
Those results do not substitute for HA verification. No new workflow, test
selection/profile, product patch or release command was introduced.

## Actual follow-up41646456489 and versioned dirty transfers

The authorized ordinary fallback follow-up pinned the same producta07 and
companionafa1724; HA2026.10.4/upgradev1.83.1 were unchanged. It completed in
29m56s and actually reused459 prior successful steps (10 newly passed,
64 failed,2 not-required,1 blocked). All77 business cases executed again:
**72 passed,5 failed,0 skipped/unexecuted; all10 setups passed.** All published
HA summary counts match a new translation of raw primary Playwright JSON.

Six repaired business fixtures now have actual PASS: room creation, node drag,
three decor shapes, kiosk cloned-floor identity, genuine bootstrap, and the
oversize refusal. The legacy profile case passed the previous ambiguous-selector
point and now stops after outer Cancel following inner OK; its current trace is
still being classified. First-run exact lattice#1237, old-material Copy Optimize
and two pre-A-D dirty producers remain explicit failures. A-D changes below
were integrated after this run and must not be reported as having passed it.

Accepted#1033/#1167/#1216 distinguish legal distinct coincident/off-grid
partitions from a proper-crossing zero-area room. The previous broad question
was corrected in issuecomment6605582890; no new owner decision is needed for
that specific atomic refusal. The stale combined F127 fixture is now split:
current authority-consistent positive content/reference repair with the exact
legal partitions and unchanged#1238 opening-repair assertion; negative current
projection tamper; an isolated literal legacy10 zero-area crossing; and a
positive genuine legacy10 off-wall repair following the unchanged model5 case.
All77 original business IDs remain; these are substeps, not new selections.

The current positive geometry is a frozen official producer result with an
exact source precondition, not a runtime rebuild from changed projections.
Current rooms are compared in full as well as through the complete structural
graph/projection. Negative inputs preserve the full config/layout pair, both
revisions and existing Undo metadata. Literal legacy sources are never renamed
current exports; exact source/repair/reload and whole-config Undo remain.

Addressed local checks of integrated A-D: syntax3 modules, contract51 files,
actual fixture/archive construction and source-precondition checks passed.
The generation produces exact current11 data and two explicit refusal inputs;
it does not contact HA. The integrated pure backend A control excluding only
the deliberate #1238 opening also passed: all three spaces keep whole rooms
including opaque metadata, and the complete official producer structural target
is unchanged. No expected output was normalized. Current11 opening-repair#1238 remains RED. No third
HA audit was dispatched and neither PR18 merge nor productS8 is claimed.
