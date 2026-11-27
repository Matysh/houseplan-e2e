import { expect, test } from '@playwright/test';
import { compareTags } from '../scripts/tags.mjs';
import { installedRecord, requireHooks } from './lib/contract.mjs';
import { card, evidence, expectPlanDrawn } from './lib/ha-page.mjs';
import { planConfig, planLayout, spaceOf, waitForConfig, waitForLayout, wsCall } from './lib/ha-ws.mjs';
import { headerActionTarget } from './lib/header-actions.mjs';
import { HP, hp } from './lib/hooks.mjs';
import { centreOf, enterEditor, field, leaveEditor, openPlan, stage, toFloor } from './lib/plan.mjs';
import { restoreSeedAfterEach } from './lib/seed-guard.mjs';

const SPACE = 'f1';
const FLOOR = { id: 'v_e2e132_floor', name: 'E2E floor device', position: { x: .42, y: .36 }, height: 0 };
const RAISED = { id: 'v_e2e132_raised', name: 'E2E elevated device', position: { x: .63, y: .34 }, height: 60 };
const LED = { id: 'v_e2e132_led', name: 'E2E bent LED strip', position: { x: .25, y: .36 }, height: 136, isStrip: true };
const ENDPOINTS = [[.19, .36], [.28, .36], [.28, .39]];
const settings = host => host.locator(HP.dialog('marker')).first();
const properties = host => host.locator(hp('properties-panel')).first();
const device = (host, id) => host.locator(hp('device', { id })).first();
const strip = (host, id) => host.locator(hp('led-device-select', { id })).first();
const heightInput = dialog => dialog.getByLabel('Height above floor (3D only)', { exact: true });
const markerOf = (config, id) => config.markers.find(marker => marker.id === id);
const stripOf = (config, markerId) => spaceOf(config, SPACE).led_strips.find(shape => shape.marker === markerId);

const product = installedRecord();
// The first published release containing #1608 follows beta.2. Source builds
// under test may already contain it while still reporting beta.2.
test.skip(product?.installed.startsWith('release ') && compareTags(product.version, '2.0.0-beta.3') < 0,
  'published build predates device height and active LED copies (houseplan-card#1608)');
requireHooks(test, 'stage@data-projection', 'stage@data-rotation', 'device-copy', 'led-device-select');
restoreSeedAfterEach(test);

async function setConfig(change) {
  const { config, rev, opening_features_api: openingFeatures } = await planConfig();
  change(config);
  await wsCall({ type: 'houseplan/config/set', config, expected_rev: rev,
    ...(openingFeatures === 1 ? { opening_features_api: 1 } : {}) });
}

async function fixture(page, items) {
  await page.setViewportSize({ width: 1800, height: 1000 });
  await setConfig(config => {
    config.settings.volumetric_view = false;
    for (const { id, name } of items) {
      config.markers.push({ id, name, binding: 'virtual', space: SPACE, tap_action: 'info',
        icon: id === LED.id ? 'mdi:led-strip-variant' : 'mdi:star', ...(id === LED.id ? { is_light: true } : {}) });
    }
    if (items.includes(LED)) {
      const floor = spaceOf(config, SPACE);
      (floor.led_strips ??= []).push({ id: 'e2e132-led-shape', marker: LED.id, points: ENDPOINTS, active: true });
    }
  });
  const { layout, rev } = await planLayout();
  for (const { id, position } of items) layout[id] = { s: SPACE, ...position };
  await wsCall({ type: 'houseplan/layout/set', layout, expected_rev: rev });
  return openPlan(page, { space: SPACE });
}

async function clickStrip(page, host, id, button = 'left') {
  const target = strip(host, id);
  await expect(target).toBeAttached();
  // A straight SVG segment has a zero-height bounding box. Use its painted
  // stroke, at the midpoint by arc length, as the native mouse target.
  const at = await target.evaluate(path => {
    const point = path.getPointAtLength(path.getTotalLength() / 2);
    const { x, y } = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM());
    return { x, y };
  });
  await page.mouse.click(at.x, at.y, { button });
}

async function openHeightSettings(page, host, item) {
  if (item.isStrip) {
    await clickStrip(page, host, item.id);
    await field(properties(host), 'properties-settings').click();
  } else {
    const at = await centreOf(device(host, item.id));
    await page.mouse.dblclick(at.x, at.y);
  }
  const dialog = settings(host);
  await dialog.getByRole('button', { name: 'Display on plan', exact: true }).click();
  await expect(heightInput(dialog)).toBeVisible();
  return dialog;
}

async function saveHeight(page, host, item) {
  const dialog = await openHeightSettings(page, host, item);
  await heightInput(dialog).fill(String(item.height));
  await dialog.locator(HP.dialogConfirm).first().click();
  await expect(dialog).toBeHidden();
  await waitForConfig(config => markerOf(config, item.id)?.height_cm === item.height,
    { message: `server saved ${item.height} cm on ${item.name}` });
}

const flatPosition = async (host, id) => {
  const point = await centreOf(device(host, id));
  return toFloor(host, point.x, point.y);
};

test('#132 stored marker heights survive reload, preserve Flat and position clickable devices in eight 3D views', async ({ page }, info) => {
  test.setTimeout(150_000);
  let host = await fixture(page, [FLOOR, RAISED]);
  const before = await Promise.all([FLOOR, RAISED].map(item => flatPosition(host, item.id)));
  const savedPositions = (await planLayout()).layout;
  await enterEditor(host, 'devices');
  await saveHeight(page, host, FLOOR);
  await saveHeight(page, host, RAISED);
  await leaveEditor(host);

  await page.reload();
  host = card(page);
  await expectPlanDrawn(page, host);
  await expect(stage(host)).toHaveAttribute('data-projection', 'flat');
  for (const [index, item] of [FLOOR, RAISED].entries()) {
    const point = await flatPosition(host, item.id);
    expect(Math.hypot(point.x - before[index].x, point.y - before[index].y)).toBeLessThan(1);
    expect((await planLayout()).layout[item.id]).toEqual(savedPositions[item.id]);
  }

  await enterEditor(host, 'devices');
  for (const item of [FLOOR, RAISED]) {
    const dialog = await openHeightSettings(page, host, item);
    await expect(heightInput(dialog)).toHaveValue(String(item.height));
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
  await leaveEditor(host);
  await setConfig(config => { config.settings.volumetric_view = true; });
  await page.reload();
  host = card(page);
  await expectPlanDrawn(page, host);
  const svg = stage(host);
  await expect(svg).toHaveAttribute('data-projection', 'iso');
  const start = Number(await svg.getAttribute('data-rotation'));
  const angles = [];
  let opened = false;
  for (let turn = 0; turn <= 8; turn++) {
    if (turn) await (await headerActionTarget(host, hp('rotate-right'))).click();
    const angle = (start + turn * 45) % 360;
    await expect(svg).toHaveAttribute('data-rotation', String(angle));
    let clickPoint;
    await expect.poll(() => host.evaluate((node, ids) => {
      // The native canvas has no DOM bounds per mesh. Read its actually
      // presented bodies and camera, then use native input for the hit.
      const scene = node._plan3dHost;
      const camera = scene?.viewport.painted?.camera;
      if (!camera?.isPerspectiveCamera || node._rotationMotion.running
        || !scene.canvas.hasAttribute('data-hp-plan-3d-ready')) return null;
      const box = scene.canvas.getBoundingClientRect();
      return ids.map(id => {
        const mesh = scene.world.markers.group.children.find(item => item.userData.plan3dPick?.id === id);
        if (!mesh) return null;
        mesh.geometry.computeBoundingBox();
        const client = mesh.position.clone().project(camera);
        const x = box.left + (client.x + 1) * box.width / 2;
        const y = box.top + (1 - client.y) * box.height / 2;
        const bottom = (mesh.position.y + mesh.geometry.boundingBox.min.y) / (node._gridPitch / node._cellCm);
        return { bottom, x, y, hit: scene.pick(x, y) };
      });
    }, [FLOOR.id, RAISED.id]).then(positions => {
      if (positions?.[1]?.hit === RAISED.id) clickPoint = positions[1];
      return positions?.map((position, index) => Math.abs(position?.bottom - [FLOOR.height, RAISED.height][index]));
    }), { message: `native 3D marker heights at ${angle}°` }).toEqual([expect.closeTo(0, 3), expect.closeTo(0, 3)]);
    angles.push(angle);
    if (!opened && clickPoint) {
      await page.mouse.click(clickPoint.x, clickPoint.y);
      const infoDialog = host.locator(HP.dialog('info')).first();
      await expect(infoDialog).toContainText(RAISED.name);
      await page.keyboard.press('Escape');
      await expect(infoDialog).toBeHidden();
      opened = true;
    }
  }
  expect(new Set(angles).size).toBe(8);
  expect(angles.at(-1)).toBe(start);
  expect(opened, 'a native click at one of the painted device positions opened its card').toBe(true);
  await evidence(info, page, 'device-height-native-3d');
});

test('#132 copying a raised LED strip preserves its independent form and undoes both saved records', async ({ page }, info) => {
  let host = await fixture(page, [LED]);
  await enterEditor(host, 'devices');
  await saveHeight(page, host, LED);
  const before = (await planConfig()).config;
  const original = stripOf(before, LED.id);
  const markerIds = new Set(before.markers.map(marker => marker.id));
  const originalPosition = (await planLayout()).layout[LED.id];

  // Establish the visible selection that the copy command should transfer.
  await clickStrip(page, host, LED.id);
  await expect(properties(host)).toContainText(LED.name);
  await clickStrip(page, host, LED.id, 'right');
  await host.locator(hp('device-copy')).first().click();
  const after = await waitForConfig(config => config.markers.some(marker => !markerIds.has(marker.id)),
    { message: 'LED copy persisted as a separate marker' });
  const copied = after.markers.filter(marker => !markerIds.has(marker.id));
  expect(copied).toHaveLength(1);
  const [copy] = copied;
  const copyShape = stripOf(after, copy.id);
  expect(copy.height_cm).toBe(LED.height);
  expect(copyShape.id).not.toBe(original.id);
  expect(copyShape.active).not.toBe(false);
  expect(copyShape.points).toHaveLength(original.points.length);
  const offset = copyShape.points[0].map((value, axis) => value - original.points[0][axis]);
  expect(Math.hypot(...offset)).toBeGreaterThan(0);
  for (const [index, point] of copyShape.points.entries()) {
    for (const [axis, coordinate] of point.entries()) {
      expect(coordinate - original.points[index][axis]).toBeCloseTo(offset[axis], 5);
    }
  }
  expect(stripOf(after, LED.id)).toEqual(original);
  const copyPosition = (await waitForLayout(layout => !!layout[copy.id]))[copy.id];
  expect((await planLayout()).layout[LED.id]).toEqual(originalPosition);
  await expect(strip(host, copy.id)).toBeAttached();
  await expect(properties(host)).toContainText(copy.name);
  await evidence(info, page, 'selected-copy-of-raised-led');

  const history = action => host.locator(hp('device-history', { action })).first().click();
  await history('undo');
  const undone = await waitForConfig(config => !markerOf(config, copy.id));
  expect(stripOf(undone, copy.id)).toBeUndefined();
  await expect.poll(async () => (await planLayout()).layout[copy.id]).toBeUndefined();
  await history('redo');
  const redone = await waitForConfig(config => !!markerOf(config, copy.id));
  expect(markerOf(redone, copy.id)).toEqual(copy);
  expect(stripOf(redone, copy.id)).toEqual(copyShape);
  await expect.poll(async () => (await planLayout()).layout[copy.id]).toEqual(copyPosition);
  await leaveEditor(host);

  await page.reload();
  host = card(page);
  await expectPlanDrawn(page, host);
  await enterEditor(host, 'devices');
  await expect(strip(host, LED.id)).toBeAttached();
  await expect(strip(host, copy.id)).toBeAttached();
  const reloaded = (await planConfig()).config;
  expect(markerOf(reloaded, copy.id)?.height_cm).toBe(LED.height);
  expect(stripOf(reloaded, copy.id)).toEqual(copyShape);
  expect(stripOf(reloaded, LED.id)).toEqual(original);
  expect((await planLayout()).layout[LED.id]).toEqual(originalPosition);
  const reopened = await openHeightSettings(page, host, { id: copy.id, isStrip: true });
  await expect(heightInput(reopened)).toHaveValue(String(LED.height));
});
