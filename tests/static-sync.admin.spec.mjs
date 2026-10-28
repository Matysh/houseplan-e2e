// #1112: five REAL HA journeys. Delays reorder actual transport replies/events;
// server writes, native drags, authentication, ACKs and readback remain real.
import { test, expect } from '@playwright/test';
import { requireHooks } from './lib/contract.mjs';
import { hp } from './lib/hooks.mjs';
import { card, expectPlanDrawn, evidence } from './lib/ha-page.mjs';
import { enterEditor, centreOf, dragClient, toFloor, toClient, snap, settle, selectSpace } from './lib/plan.mjs';
import { planConfig, planLayout, wsCall, snapshotPlan, restorePlan, waitForLayout } from './lib/ha-ws.mjs';
import { staticSyncWire, createStaticDashboard, firePlanEvent, handoffStaticConnection, ownStaticHosts, supportsStaticSync } from './lib/static-sync.mjs';

requireHooks(test, 'device', 'room', 'mode-tab', 'stage@data-grid-step', 'device-history', 'tool');
const SOURCE = 'lg_sensor.ground_floor_temperature', VIRTUAL = 'v_demo_tv';
const marker = (host, id = SOURCE) => host.locator(hp('device', { id })).first();
const statics = page => page.locator('houseplan-space-card');
let seed, dashboard;

test.beforeEach(async () => {
  test.skip(!supportsStaticSync(), 'static shared-store behavior ships in 1.83.0-beta.4; old release is not this contract');
  seed = await snapshotPlan();
  dashboard = await createStaticDashboard();
});
test.afterEach(async ({ page }) => {
  // Closing our page first releases held transports and B without making a
  // restore event race another scenario. Never touch an existing dashboard.
  try { await page.close(); }
  finally {
    try { if (seed) await restorePlan(seed); }
    finally {
      try { if (dashboard) await dashboard.remove(); }
      finally { seed = dashboard = null; }
    }
  }
});

async function openPair(page, wire, view = 'pair') {
  await page.goto(`/${dashboard.path}/${view}`);
  await expect(statics(page)).toHaveCount(2);
  for (const host of await statics(page).all()) {
    await expect(host).toBeVisible();
    await expect(marker(host)).toBeVisible({ timeout: 60_000 });
    expect(await host.locator(hp('room')).count()).toBeGreaterThan(0);
  }
  await wire.settle(page);
  return statics(page);
}

/** Painted coordinates relative to each declared host. No copy of product
 * projection/contact geometry: the oracle is the same card after cold reload,
 * checked alongside independent native HA layout readback.
 */
async function painted(page, id = SOURCE) {
  const positions = [];
  for (const host of await statics(page).all()) {
    const frame = await host.boundingBox(), point = await centreOf(marker(host, id));
    positions.push({ x: point.x - frame.x, y: point.y - frame.y });
  }
  return positions;
}
function expectSamePaint(actual, expected) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((point, i) => {
    expect(Math.abs(point.x - expected[i].x)).toBeLessThan(1);
    expect(Math.abs(point.y - expected[i].y)).toBeLessThan(1);
  });
}
async function expectMoved(page, before, id = SOURCE) {
  await expect.poll(async () => (await painted(page, id)).every((p, i) =>
    Math.hypot(p.x - before[i].x, p.y - before[i].y) > 1), {
    message: 'both real static cards painted the new stored position',
  }).toBe(true);
}
async function assertReloadOracle(page, wire, position, id = SOURCE) {
  expect((await planLayout()).layout[id]).toEqual(position);
  const live = await painted(page, id);
  await page.reload();
  await openPairReady(page, wire);
  expectSamePaint(await painted(page, id), live);
  expect((await planLayout()).layout[id]).toEqual(position);
}
async function openPairReady(page, wire) {
  await expect(statics(page)).toHaveCount(2);
  for (const host of await statics(page).all()) await expect(marker(host)).toBeVisible();
  await wire.settle(page);
}
async function writePosition(id = SOURCE, offset = .02) {
  const [config, layout] = await Promise.all([planConfig(), planLayout()]);
  const old = layout.layout[id];
  if (!old) throw new Error(`seed marker ${id} has no stored layout`);
  const position = { ...old, x: old.x + offset, y: old.y + offset / 2 };
  const ack = await wsCall({ type: 'houseplan/layout/set', expected_rev: layout.rev,
    expected_config_rev: config.rev, layout: { ...layout.layout, [id]: position } });
  expect(Number.isSafeInteger(ack.rev)).toBe(true);
  expect(ack.rev).toBeGreaterThan(layout.rev);
  expect((await planLayout()).layout[id]).toEqual(position);
  return { position, rev: ack.rev };
}
async function attachReceipt(testInfo, wire, name = 'real-ha-static-sync.json') {
  await testInfo.attach(name, { body: JSON.stringify(wire.receipt(), null, 2), contentType: 'application/json' });
}

test('five native full-card drags ACK and update both static cards on the same HA connection', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const wire = await staticSyncWire(page);
  await openPair(page, wire, 'mixed');
  const host = card(page);
  await expectPlanDrawn(page, host);
  await selectSpace(host, 'f1');
  await enterEditor(host, 'devices');
  const magnets = host.locator(hp('tool', { tool: 'device-magnets' })).first();
  if (await magnets.count() && await magnets.isEnabled() && await magnets.getAttribute('aria-pressed') === 'true') await magnets.click();
  await settle(host);
  const positions = [];
  for (let i = 0; i < 5; i++) {
    const before = await painted(page), stored = await planLayout();
    await marker(host).scrollIntoViewIfNeeded();
    const from = await centreOf(marker(host)), floor = await toFloor(host, from.x, from.y);
    const target = await snap(host, floor.x + 60, floor.y + 40);
    await dragClient(page, from, await toClient(host, target.x, target.y));
    const changed = await waitForLayout(layout => layout[SOURCE]
      && Math.abs(layout[SOURCE].x - stored.layout[SOURCE].x) + Math.abs(layout[SOURCE].y - stored.layout[SOURCE].y) > .001,
      { message: `native drag ${i + 1} persisted in real HA` });
    await expect.poll(() => wire.results.filter(r => /^houseplan\/layout\/(set|update)$/.test(r.type) && r.success).length).toBe(i + 1);
    await wire.settle(page);
    await expectMoved(page, before);
    positions.push(changed[SOURCE]);
  }
  expect(wire.connections).toBe(1);
  await evidence(testInfo, page, 'five-native-drags-static-pair');
  // A fresh static-only view is independent of the full editor's local model.
  const live = await painted(page);
  await page.goto(`/${dashboard.path}/pair`);
  await openPairReady(page, wire);
  expect((await planLayout()).layout[SOURCE]).toEqual(positions.at(-1));
  // Different card heights on the mixed view can change the frame; cold pair
  // reload is compared to that exact pair, never to a copied geometry formula.
  expect(live).toHaveLength(2);
  await assertReloadOracle(page, wire, positions.at(-1));
  await attachReceipt(testInfo, wire);
});

test('a real five-write burst uses one shared layout GET; equal and older events do not read or roll back', async ({ page }, testInfo) => {
  const wire = await staticSyncWire(page);
  await openPair(page, wire);
  const before = await painted(page);
  wire.holdEvents();
  let latest;
  for (let i = 0; i < 5; i++) latest = await writePosition(SOURCE, .015);
  await wire.heldEvents(5);
  wire.reset();
  wire.releaseEvents();
  await expect.poll(() => wire.counts()).toEqual({ config: 0, layout: 1 });
  await wire.settle(page);
  expect(wire.counts()).toEqual({ config: 0, layout: 1 });
  await expectMoved(page, before);
  const currentPaint = await painted(page), config = await planConfig();
  wire.reset();
  for (const [type, rev] of [['houseplan_layout_updated', latest.rev], ['houseplan_layout_updated', latest.rev - 1],
    ['houseplan_config_updated', config.rev], ['houseplan_config_updated', Math.max(0, config.rev - 1)]]) {
    await firePlanEvent(type, { rev });
  }
  await wire.settle(page);
  expect(wire.counts()).toEqual({ config: 0, layout: 0 });
  expectSamePaint(await painted(page), currentPaint);
  await evidence(testInfo, page, 'burst-and-older-events');
  await assertReloadOracle(page, wire, latest.position);
  await attachReceipt(testInfo, wire);
});

test('new configuration refreshes config and advertised capabilities, while layout-only and legacy events retain the other half', async ({ page }, testInfo) => {
  const wire = await staticSyncWire(page);
  await openPair(page, wire);
  const before = await painted(page), current = await planConfig();
  const title = `${current.config.spaces.find(s => s.id === 'f1').title} E2E1112`;
  const config = structuredClone(current.config);
  config.spaces.find(s => s.id === 'f1').title = title;
  wire.reset();
  await wsCall({ type: 'houseplan/config/set', expected_rev: current.rev, config });
  for (const host of await statics(page).all()) await expect(host.getByText(title, { exact: true })).toBeVisible();
  await wire.settle(page);
  expect(wire.counts()).toEqual({ config: 1, layout: 0 });
  expect(wire.results.find(r => r.type === 'houseplan/config/get')).toMatchObject({ success: true, decorAssetsApi: 1, summaryPanelApi: 1 });
  expectSamePaint(await painted(page), before);
  wire.reset();
  const moved = await writePosition();
  await expectMoved(page, before);
  await wire.settle(page);
  expect(wire.counts()).toEqual({ config: 0, layout: 1 });
  for (const host of await statics(page).all()) await expect(host.getByText(title, { exact: true })).toBeVisible();
  for (const [type, expected] of [['houseplan_layout_updated', { config: 0, layout: 1 }],
    ['houseplan_config_updated', { config: 1, layout: 0 }]]) {
    wire.reset();
    await firePlanEvent(type, {});
    await expect.poll(() => wire.counts()).toEqual(expected);
    await wire.settle(page);
    expect(wire.counts()).toEqual(expected);
  }
  await assertReloadOracle(page, wire, moved.position);
  await evidence(testInfo, page, 'config-and-legacy-refreshed');
  await attachReceipt(testInfo, wire);
});

test('a real virtual-light event paints immediately and survives a layout-only refresh', async ({ page }, testInfo) => {
  const config = await planConfig(), next = structuredClone(config.config);
  const virtual = next.markers.find(m => m.id === VIRTUAL);
  expect(virtual?.binding).toBe('virtual');
  Object.assign(virtual, { is_light: true, tap_action: 'toggle', icon: 'mdi:lightbulb' });
  await wsCall({ type: 'houseplan/config/set', expected_rev: config.rev, config: next });
  const wire = await staticSyncWire(page);
  await openPair(page, wire);
  wire.reset();
  const toggled = await wsCall({ type: 'houseplan/virtual_light/toggle', marker_id: VIRTUAL });
  expect(typeof toggled.on).toBe('boolean');
  const state = toggled.on ? 'working' : 'neutral';
  for (const host of await statics(page).all()) await expect(marker(host, VIRTUAL)).toHaveAttribute('data-state', state);
  await wire.settle(page);
  expect(wire.counts()).toEqual({ config: 0, layout: 0 });
  expect(wire.events.some(e => e.type === 'houseplan_virtual_light_updated' && e.rev === toggled.rev)).toBe(true);
  const before = await painted(page, VIRTUAL);
  const moved = await writePosition(VIRTUAL);
  await expectMoved(page, before, VIRTUAL);
  await wire.settle(page);
  expect(wire.counts()).toEqual({ config: 0, layout: 1 });
  for (const host of await statics(page).all()) await expect(marker(host, VIRTUAL)).toHaveAttribute('data-state', state);
  const stored = await planConfig();
  expect(stored.virtual_lights.off.includes(VIRTUAL)).toBe(!toggled.on);
  await assertReloadOracle(page, wire, moved.position, VIRTUAL);
  for (const host of await statics(page).all()) await expect(marker(host, VIRTUAL)).toHaveAttribute('data-state', state);
  await evidence(testInfo, page, 'virtual-light-after-layout');
  await attachReceipt(testInfo, wire);
});

test('held old reads cannot replace newer events, and a real connection handoff drops the old revision high-water', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const wire = await staticSyncWire(page);
  await openPair(page, wire);
  const before = await painted(page);
  wire.holdReads();
  await firePlanEvent('houseplan_config_updated', {});
  await firePlanEvent('houseplan_layout_updated', {});
  await wire.heldReads(2);
  const oldConfig = await planConfig(), newer = structuredClone(oldConfig.config);
  const raceTitle = `${newer.spaces.find(s => s.id === 'f1').title} race1112`;
  newer.spaces.find(s => s.id === 'f1').title = raceTitle;
  const configAck = await wsCall({ type: 'houseplan/config/set', expected_rev: oldConfig.rev, config: newer });
  const raced = await writePosition();
  await expect.poll(() => wire.events.some(e => e.type === 'houseplan_config_updated' && e.rev === configAck.rev)).toBe(true);
  await expect.poll(() => wire.events.some(e => e.type === 'houseplan_layout_updated' && e.rev === raced.rev)).toBe(true);
  wire.releaseReads();
  await expectMoved(page, before);
  await wire.settle(page);
  expect(wire.counts().layout).toBeGreaterThanOrEqual(3); // initial + held + fresh generation
  expect(wire.counts().config).toBeGreaterThanOrEqual(3);
  for (const host of await statics(page).all()) await expect(host.getByText(raceTitle, { exact: true })).toBeVisible();
  expect(await ownStaticHosts(page)).toEqual({ cards: 2, connectionUnchanged: true });
  await openPairReady(page, wire);
  const afterRace = await painted(page);
  const connectionA = wire.connections, connectionB = connectionA + 1;
  wire.holdReads(undefined, connectionB);
  wire.holdEvents(['houseplan_layout_updated'], connectionB);
  expect(await handoffStaticConnection(page)).toEqual({ cards: 2, authenticated: true });
  await wire.heldReads(2);
  expect(wire.connections).toBe(connectionB);
  const highWater = (await planLayout()).rev + 100;
  await firePlanEvent('houseplan_layout_updated', { rev: highWater });
  await expect.poll(() => wire.events.some(e => e.connection === connectionA && e.rev === highWater)).toBe(true);
  await wire.heldEvents();
  // This actual bus notification is deliberately stale input on old A only;
  // B's copy is discarded at the transport seam, never applied as current.
  await attachReceipt(testInfo, wire, 'old-A-event-while-B-replies-held.json');
  wire.releaseEvents({ discard: true });
  wire.releaseReads();
  await wire.settle(page);
  expectSamePaint(await painted(page), afterRace);
  await attachReceipt(testInfo, wire, 'B-current-low-revision-adopted.json');
  wire.reset();
  const low = await writePosition(SOURCE, .025);
  expect(low.rev).toBeLessThan(highWater);
  await expectMoved(page, afterRace);
  await wire.settle(page);
  expect(wire.counts(connectionB)).toEqual({ config: 0, layout: 1 });
  await evidence(testInfo, page, 'real-connection-handoff-lower-revision');
  await attachReceipt(testInfo, wire);
  await assertReloadOracle(page, wire, low.position);
});
