# Beta.4 regression inputs

Requested in [houseplan-e2e#26](https://github.com/Matysh/houseplan-e2e/issues/26).
Product source: `Matysh/houseplan-card@7af907c34e0bc19a5f3215b6003023b2a96aaa5f`.
No customer credentials, device inventory or image files are included.

- `opening`: two rectangles, explicit 15 cm canonical walls, existing model11
  window bound at one-quarter of the left room's top wall. Checks #1267/#1278.
- `split`: one rectangle with zero-thickness contours, no pre-existing divider.
- `draw-two`: three sides and an independent middle divider. Two face offers
  are decided sequentially and saved as the product's single atomic batch.
- `promotion*`: source-pinned `test/fixtures/room-host-promotion.json`, including
  its independently recorded expected host and a residual-host control.
- `closure*`: source-pinned `test/fixtures/874-room-closure.json`; original room
  boundaries 30 cm, old independent source carrier 25 cm, native new wall15 cm.
  Room metadata and every old neighbour vertex survive exact graph noding.
- `resize-conflict`: `test/helpers/resize-incident-fixture.mjs` with its hosted
  opening. The separate 13 cm partition touches the moving wall's endpoint:
  native obstacle clamping must leave the whole config/layout/revisions intact.
- `resize`: same geometry, with that independent partition explicitly moved
  below the rooms and the aperture at `x=0.25`, clear of the whole movement
  path. Its source carrier is reversed with room-cycle directions preserved:
  the aperture must bind to the newly allocated left child, parameter `4/7`.
  A wall may not move through an aperture even if the final pose would be clear.
  This exercises T noding and exact rehosting while retaining unrelated material.
- `dependent`: `test/graph-edit-intent.test.mjs`, case “#1264 sliding a T seam
  never moves a dependent corner of fixed rooms”. Exact dependency expressions
  are retained. A new T vertex may node a fixed boundary; its old vertices and
  the dependent `(0.3,0.7)` corner must stay at their exact source coordinates.
- `first-floor`: privacy-minimised `test/fixtures/real-plan-first-floor.json`,
  converted once with the official model11 converter before installation.
- `legacy-stairs`: genuinely absent `model_version` and graph, explicit legacy
  wall keys plus one stair, target floor, and complete stair fields. It is
  installed in raw HA storage **before HA boots**, not via migrating import.

Current fixtures were materialised with `commitWallSegmentModel`,
`commitGraphEdit`, and the exact source helpers above. Those functions prepare
input only. Measured writes in every journey use real mouse/keyboard input;
oracles read the integration's actual websocket documents and ACK/error replies.
`confirmMissingContent` is confined to synthetic fixture setup/restoration:
these fixtures contain no images or placed devices and their full-export
manifests are empty. Import journeys retain their default unconfirmed path.

The legacy case runs separately with `playwright.legacy.config.mjs`. The normal
`plan-model` dependency intentionally migrates a house before business tests
and therefore cannot establish the legacy premise. Do not count a skipped
version-gated case as a passing regression.
