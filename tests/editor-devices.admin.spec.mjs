// Device editor on a real Home Assistant (houseplan-card#1010, rows 1, 7, 15):
// a device is moved (with its own undo/redo), renamed in its settings dialog
// and copied from the context menu; its size is changed in the side
// Properties panel; two devices pulled together by the magnets become one
// group with a shared outline. Oracles: the integration's stored layout and
// config, then the plan after a page reload.
import { test, expect } from '@playwright/test';
import { requireHooks } from './lib/contract.mjs';
import { card, evidence, expectPlanDrawn } from './lib/ha-page.mjs';
import { planConfig, planLayout, waitForConfig, waitForLayout } from './lib/ha-ws.mjs';
import { HP, hp } from './lib/hooks.mjs';
import {
  centreOf, dragClient, enterEditor, field, leaveEditor, openPlan, settle, snap, toClient, toFloor,
} from './lib/plan.mjs';
import { restoreSeedAfterEach } from './lib/seed-guard.mjs';
import { hasBeta4PanelContract } from './lib/panel-release-contract.mjs';

requireHooks(test, 'stage@data-grid-step', 'mode-tab', 'field', 'action', 'device-history', 'device-copy',
  'device@data-hp-device-component', 'device-contact-contour', 'properties-panel');
restoreSeedAfterEach(test);

const U = 1000;
const THERMO = 'lg_sensor.ground_floor_temperature';
const LAMP_A = 'e_light_hallway_lamp_5';
const LAMP_B = 'e_light_hallway_lamp_4';
const marker = (host, id) => host.locator(hp('device', { id })).first();
const markerOf = (config, id) => config.markers.find((m) => m.id === id);

/** Devices editor, zoomed in so a marker is a comfortable mouse target. */
async function devicesEditor(page) {
  const host = await openPlan(page, { space: 'f1' });
  await enterEditor(host, 'devices');
  for (let i = 0; i < 3; i++) await host.locator(hp('zoom-in')).first().click();
  await settle(host);
  return host;
}

test('a device is moved with undo and redo, renamed and copied, and the plan keeps it', async ({ page }, testInfo) => {
  const before = (await planLayout()).layout[THERMO];
  const host = await devicesEditor(page);
  await evidence(testInfo, page, 'device-before');

  // move: real drag; the marker centre lands on the grid
  const from = await centreOf(marker(host, THERMO));
  const start = await toFloor(host, from.x, from.y);
  const target = await snap(host, start.x + 60, start.y + 40);
  await dragClient(page, from, await toClient(host, target.x, target.y));
  const near = (pos, p) => Math.abs(pos.x * U - p.x) < 1e-3 && Math.abs(pos.y * U - p.y) < 1e-3;
  await waitForLayout((l) => near(l[THERMO], target), { message: 'moved position stored' });
  await expect(marker(host, THERMO)).toHaveAttribute('data-selected', 'true');
  await evidence(testInfo, page, 'device-moved');

  // the editor's own position history: back to the seed point, then forward again
  await host.locator(hp('device-history', { action: 'undo' })).first().click();
  await waitForLayout((l) => Math.abs(l[THERMO].x - before.x) < 1e-6 && Math.abs(l[THERMO].y - before.y) < 1e-6,
    { message: 'undo restored the position' });
  await host.locator(hp('device-history', { action: 'redo' })).first().click();
  await waitForLayout((l) => near(l[THERMO], target), { message: 'redo moved it again' });

  // rename in the full settings dialog (double click)
  const centre = await centreOf(marker(host, THERMO));
  await page.mouse.dblclick(centre.x, centre.y);
  const dialog = host.locator(HP.dialog('marker')).first();
  await expect(dialog).toBeVisible();
  await field(dialog, 'marker-name').fill('Thermostat E2E');
  await evidence(testInfo, page, 'device-settings');
  await dialog.locator(HP.dialogConfirm).first().click();
  await expect(dialog).toBeHidden();
  await waitForConfig((c) => markerOf(c, THERMO)?.name === 'Thermostat E2E', { message: 'new name stored' });

  // copy from the context menu: a virtual copy next to it, numbered from 2
  const count = (await planConfig()).config.markers.length;
  const again = await centreOf(marker(host, THERMO));
  await page.mouse.click(again.x, again.y, { button: 'right' });
  await host.locator(hp('device-copy')).first().click();
  const copied = await waitForConfig((c) => c.markers.length === count + 1, { message: 'copy stored' });
  const copy = copied.markers.find((m) => m.name === 'Thermostat E2E 2');
  expect(copy, 'the copy is named with the first free number').toBeTruthy();
  expect(copy.binding).toBe('virtual');
  await evidence(testInfo, page, 'device-copied');

  await leaveEditor(host);
  await page.reload();
  const fresh = card(page);
  await expectPlanDrawn(page, fresh);
  await expect(marker(fresh, copy.id)).toHaveCount(1);
  const shown = await centreOf(marker(fresh, THERMO));
  const shownFloor = await toFloor(fresh, shown.x, shown.y);
  const step = Number(await fresh.locator(hp('stage')).first().getAttribute('data-grid-step'));
  expect(Math.abs(shownFloor.x - target.x)).toBeLessThan(step);
  expect(Math.abs(shownFloor.y - target.y)).toBeLessThan(step);
  await evidence(testInfo, page, 'device-after-reload');
});

test('the Properties panel changes the size of the selected device', async ({ page }, testInfo) => {
  // This journey exercises editing and persistence in the desktop Properties
  // panel. HA reserves space for its sidebar, so make that premise explicit.
  await page.setViewportSize({ width: 1800, height: 1000 });
  const host = await devicesEditor(page);
  await expect.poll(async () => (await host.boundingBox()).width).toBeGreaterThan(1120);
  const widthOf = async (owner) => (await marker(owner, THERMO).boundingBox()).width;
  const before = await widthOf(host);
  const centre = await centreOf(marker(host, THERMO));
  await page.mouse.click(centre.x, centre.y);
  const panel = host.locator(hp('properties-panel')).first();
  const size = field(panel, 'properties-size');
  await expect(size).toBeEditable();
  const old = Number(await size.inputValue());
  const wanted = old >= 150 ? 100 : 150;
  await size.fill(String(wanted));
  await size.press('Enter');
  await evidence(testInfo, page, 'properties-size');
  const stored = await waitForConfig((c) => {
    const m = markerOf(c, THERMO);
    return m && m.size != null && Math.abs(Number(m.size) * 100 - wanted) < 1e-6;
  }, { message: `size ${wanted}% stored` });
  expect(Number(markerOf(stored, THERMO).size)).toBeCloseTo(wanted / 100, 6);
  await expect(size).toHaveValue(String(wanted));

  // after a reload the marker is drawn at its new size and the panel says so
  await page.keyboard.press('Escape');
  const fresh = await devicesEditor(page);
  expect(await widthOf(fresh) / before).toBeCloseTo(wanted / old, 1);
  const again = await centreOf(marker(fresh, THERMO));
  await page.mouse.click(again.x, again.y);
  await expect(field(fresh.locator(hp('properties-panel')).first(), 'properties-size')).toHaveValue(String(wanted));
  await evidence(testInfo, page, 'properties-after-reload');
});

test('two devices pulled together by the magnets form one outlined group', async ({ page }, testInfo) => {
  const host = await devicesEditor(page);
  await expect(host.locator(HP.tool('device-magnets'))).toHaveAttribute('aria-pressed', 'true');
  const a = marker(host, LAMP_A);
  const b = marker(host, LAMP_B);
  await expect(a).not.toHaveAttribute('data-hp-device-component', /.+/);
  await evidence(testInfo, page, 'magnets-before');

  // drop B just under A, a couple of pixels short of contact: the magnet closes the gap
  const boxA = await a.boundingBox();
  const from = await centreOf(b);
  await dragClient(page, from, { x: boxA.x + boxA.width / 2, y: boxA.y + boxA.height * 1.5 + 2 });

  await expect(b).toHaveAttribute('data-hp-device-component', /.+/);
  const owner = await b.getAttribute('data-hp-device-component');
  await expect(a).toHaveAttribute('data-hp-device-component', owner);
  await expect(host.locator(hp('device-contact-contour', { grouped: 'true', component: owner }))).toHaveCount(1);
  await evidence(testInfo, page, 'magnets-grouped');

  // the group is a fact of the stored positions: it is there after a reload, in View
  await leaveEditor(host);
  await page.reload();
  const fresh = card(page);
  await expectPlanDrawn(page, fresh);
  await expect(marker(fresh, LAMP_B)).toHaveAttribute('data-hp-device-component', owner);
  await expect(marker(fresh, LAMP_A)).toHaveAttribute('data-hp-device-component', owner);
  await evidence(testInfo, page, 'magnets-after-reload');
});

// #1119 UI010 uses the actual ha-card width, including HA's real host layout.
// Window width alone is not the contract: the sidebar may reserve some of it.
test('Properties follows the real card width at 1023, 1024 and 1025 without losing selection', async ({ page }, testInfo) => {
  test.skip(!hasBeta4PanelContract(), 'the 1024px Properties boundary first ships in beta.4; a skip is not proof');
  test.setTimeout(150_000);
  const originalViewport = page.viewportSize();
  try {
    await page.setViewportSize({ width: 1800, height: 1000 });
    const host = await devicesEditor(page), owner = host.locator('ha-card').first();
    const selected = marker(host, THERMO), point = await centreOf(selected);
    await page.mouse.click(point.x, point.y);
    const panel = host.locator(hp('properties-panel')).first();
    const size = field(panel, 'properties-size');
    await expect(size).toBeEditable();
    const originalSize = await size.inputValue();
    const [beforeConfig, beforeLayout] = await Promise.all([planConfig(), planLayout()]);
    for (const [index, target] of [1023, 1024, 1025, 1024, 1025].entries()) {
      // Calibrate by an observable box. No CSS, component properties, private
      // ResizeObserver state, or HA sidebar settings are injected.
      for (let attempt = 0; attempt < 4; attempt++) {
        const actual = (await owner.boundingBox()).width;
        if (actual === target) break;
        const viewport = page.viewportSize();
        await page.setViewportSize({ width: Math.round(viewport.width + target - actual), height: viewport.height });
        await settle(host);
      }
      await expect.poll(async () => (await owner.boundingBox()).width).toBe(target);
      await expect(selected).toHaveAttribute('data-selected', 'true');
      if (target < 1024) await expect(panel).toBeHidden();
      else {
        await expect(size).toBeEditable();
        await expect(size).toHaveValue(originalSize);
      }
      if (index < 3) await evidence(testInfo, page, `properties-card-${target}`);
    }
    const [afterConfig, afterLayout] = await Promise.all([planConfig(), planLayout()]);
    expect(afterConfig.config).toEqual(beforeConfig.config);
    expect(afterConfig.rev).toBe(beforeConfig.rev);
    expect(afterLayout.layout).toEqual(beforeLayout.layout);
    expect(afterLayout.rev).toBe(beforeLayout.rev);
  } finally {
    await page.setViewportSize(originalViewport);
  }
});
