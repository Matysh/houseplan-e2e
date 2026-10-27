// The four settings dialogs on a real Home Assistant (houseplan-card#1010,
// row 2; USER-GUIDE §5): General settings, Space, Room settings and Device on
// the plan. Each changes one field through the real form, saves, and the value
// is what the integration stores and what the dialog shows after a reload.
import { test, expect } from '@playwright/test';
import { requireHooks } from './lib/contract.mjs';
import { card, evidence, expectPlanDrawn, spaceEntry } from './lib/ha-page.mjs';
import { planConfig, spaceOf, waitForConfig } from './lib/ha-ws.mjs';
import { HP, hp } from './lib/hooks.mjs';
import { centreOf, enterEditor, field, openPlan, settle, toFloor } from './lib/plan.mjs';
import { restoreSeedAfterEach } from './lib/seed-guard.mjs';

requireHooks(test, 'field', 'settings-section', 'mode-tab', 'stage@data-grid-step');
restoreSeedAfterEach(test);

const GROUND = 'f1';
const THERMO = 'lg_sensor.ground_floor_temperature';

const inside = ([x, y], poly) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

/**
 * The «Room settings» capsule of one room. The capsule hook carries no room
 * identity in the contract, so it is found where the user finds it: the one
 * that lies inside the room's stored outline.
 */
async function roomSettingsOf(host, room) {
  const buttons = host.locator(hp('room-settings'));
  const n = await buttons.count();
  for (let i = 0; i < n; i++) {
    const c = await centreOf(buttons.nth(i));
    const f = await toFloor(host, c.x, c.y);
    if (inside([f.x / 1000, f.y / 1000], room.poly)) return buttons.nth(i);
  }
  throw new Error(`no Room settings capsule inside ${room.name}`);
}

test('General settings: a toggle is saved for the whole installation', async ({ page }, testInfo) => {
  const before = (await planConfig()).config.settings;
  const host = await openPlan(page);
  await host.locator(HP.settings).first().click();
  const dialog = host.locator(HP.dialog('settings')).first();
  await expect(dialog).toBeVisible();
  await dialog.locator(hp('settings-section', { kind: 'general', section: 'display' })).first().click();
  const toggle = field(dialog, 'gs-room-tooltip');
  const was = await toggle.isChecked();
  await toggle.click();
  await expect(toggle).toBeChecked({ checked: !was });
  await evidence(testInfo, page, 'general-changed');
  await dialog.locator(HP.dialogConfirm).first().click();
  await expect(dialog).toBeHidden();
  // the tooltip switch is `show_room_tooltip` (absent = on); saving the dialog
  // also writes the form's normalised defaults, which are not this change
  await waitForConfig((c) => (c.settings.show_room_tooltip ?? true) === !was, { message: 'room tooltip setting stored' });
  expect(before.show_room_tooltip ?? true).toBe(was);

  await page.reload();
  const fresh = card(page);
  await expectPlanDrawn(page, fresh);
  await fresh.locator(HP.settings).first().click();
  const reopened = fresh.locator(HP.dialog('settings')).first();
  await expect(field(reopened, 'gs-room-tooltip')).toBeChecked({ checked: !was });
  await evidence(testInfo, page, 'general-after-reload');
});

test('Space settings: a renamed space keeps its new name', async ({ page }, testInfo) => {
  const host = await openPlan(page, { space: GROUND });
  await host.locator(hp('space-settings', { id: GROUND })).first().click();
  const dialog = host.locator(HP.dialog('space')).first();
  await expect(dialog).toBeVisible();
  await expect(field(dialog, 'space-title')).toHaveValue('Ground Floor');
  await field(dialog, 'space-title').fill('Ground Floor E2E');
  await evidence(testInfo, page, 'space-renamed');
  await dialog.locator(HP.dialogConfirm).first().click();
  await expect(dialog).toBeHidden();
  await waitForConfig((c) => spaceOf(c, GROUND).title === 'Ground Floor E2E', { message: 'space title stored' });
  await expect(spaceEntry(host, GROUND)).toContainText('Ground Floor E2E');

  await page.reload();
  const fresh = card(page);
  await expectPlanDrawn(page, fresh);
  await expect(spaceEntry(fresh, GROUND)).toContainText('Ground Floor E2E');
  await evidence(testInfo, page, 'space-after-reload');
});

test('Room settings: a renamed room shows its new name on the plan', async ({ page }, testInfo) => {
  const room = spaceOf((await planConfig()).config, GROUND).rooms.find((r) => r.name === 'Guest Bedroom');
  const host = await openPlan(page, { space: GROUND });
  await enterEditor(host, 'plan');
  await (await roomSettingsOf(host, room)).click();
  const dialog = host.locator(HP.dialog('room')).first();
  await expect(dialog).toBeVisible();
  await expect(field(dialog, 'room-name')).toHaveValue('Guest Bedroom');
  await field(dialog, 'room-name').fill('Guest Bedroom E2E');
  await evidence(testInfo, page, 'room-renamed');
  await dialog.locator(HP.dialogConfirm).filter({ hasText: /save room/i }).first().click();
  await expect(dialog).toBeHidden();
  await waitForConfig((c) => spaceOf(c, GROUND).rooms.find((r) => r.id === room.id)?.name === 'Guest Bedroom E2E',
    { message: 'room name stored' });

  await page.reload();
  const fresh = card(page);
  await expectPlanDrawn(page, fresh);
  await expect(fresh.locator(hp('room-label', { id: room.id }))).toContainText('Guest Bedroom E2E');
  await evidence(testInfo, page, 'room-after-reload');
});

test('Device on the plan: a new display is saved and shown again', async ({ page }, testInfo) => {
  const host = await openPlan(page, { space: GROUND });
  await enterEditor(host, 'devices');
  for (let i = 0; i < 3; i++) await host.locator(hp('zoom-in')).first().click();
  await settle(host);
  const centre = await centreOf(host.locator(hp('device', { id: THERMO })).first());
  await page.mouse.dblclick(centre.x, centre.y);
  const dialog = host.locator(HP.dialog('marker')).first();
  await expect(dialog).toBeVisible();
  await dialog.locator(hp('settings-section', { kind: 'marker', section: 'appearance' })).first().click();
  const display = field(dialog, 'marker-display');
  const options = await display.locator('option').evaluateAll((els) => els.map((o) => o.value));
  const current = await display.inputValue();
  const next = options.find((v) => v && v !== current);
  await display.selectOption(next);
  await evidence(testInfo, page, 'marker-display-changed');
  await dialog.locator(HP.dialogConfirm).first().click();
  await expect(dialog).toBeHidden();
  await waitForConfig((c) => c.markers.find((m) => m.id === THERMO)?.display === next, { message: `display ${next} stored` });

  await page.reload();
  const fresh = card(page);
  await expectPlanDrawn(page, fresh);
  await enterEditor(fresh, 'devices');
  for (let i = 0; i < 3; i++) await fresh.locator(hp('zoom-in')).first().click();
  await settle(fresh);
  const again = await centreOf(fresh.locator(hp('device', { id: THERMO })).first());
  await page.mouse.dblclick(again.x, again.y);
  const reopened = fresh.locator(HP.dialog('marker')).first();
  await reopened.locator(hp('settings-section', { kind: 'marker', section: 'appearance' })).first().click();
  await expect(field(reopened, 'marker-display')).toHaveValue(next);
  await evidence(testInfo, page, 'marker-after-reload');
});
