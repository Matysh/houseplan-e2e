import { expect, test } from '@playwright/test';
import { installedRecord, requireHooks } from './lib/contract.mjs';
import { compareTags } from '../scripts/tags.mjs';
import { HP, hp } from './lib/hooks.mjs';
import { evidence } from './lib/ha-page.mjs';
import { waitForConfig } from './lib/ha-ws.mjs';
import { centreOf, enterEditor, leaveEditor, openPlan } from './lib/plan.mjs';
import { restoreSeedAfterEach } from './lib/seed-guard.mjs';

const installed = installedRecord();
test.skip(installed?.installed.startsWith('release ') && compareTags(installed.version, '2.0.0-beta.3') < 0,
  'published build predates the shared Home Assistant MDI catalog (houseplan-card#1594)');
requireHooks(test, 'device', 'mode-tab', 'field');
restoreSeedAfterEach(test);

const markerId = 'lg_sensor.ground_floor_temperature';
const wanted = 'mdi:fan';

async function openIconControl(page, host) {
  await enterEditor(host, 'devices');
  const at = await centreOf(host.locator(hp('device', { id: markerId })).first());
  await page.mouse.dblclick(at.x, at.y);
  const dialog = host.locator(HP.dialog('marker')).first();
  await expect(dialog).toBeVisible();
  const appearance = dialog.locator('[data-section-target="appearance"]');
  await appearance.click();
  const picker = dialog.locator('hp-icon-picker[data-field="marker-icon"]');
  await expect(picker).toBeVisible();
  return { dialog, picker };
}

test('#134 picks and persists an icon from the real Home Assistant MDI catalog', async ({ page, baseURL }, info) => {
  await page.setViewportSize({ width: 1800, height: 1000 });
  const origin = new URL(baseURL).origin;
  const assets = new Set(), fanPaths = new Set();
  page.on('response', async response => {
    const url = new URL(response.url());
    if (url.origin !== origin || !url.pathname.startsWith('/static/mdi/') || !response.ok()) return;
    assets.add(url.pathname.split('/').at(-1));
    if (!/\/[a-f0-9]{40,64}\.json$/.test(url.pathname)) return;
    const data = await response.json().catch(() => null);
    if (typeof data?.fan === 'string') fanPaths.add(data.fan);
  });
  const host = await openPlan(page, { space: 'f1' });
  const { dialog, picker } = await openIconControl(page, host);
  await picker.locator('button.trigger').click();
  await dialog.locator('input[type="search"]').fill('fan');
  const result = dialog.locator('[role="option"][data-icon="mdi:fan"]');
  await expect(result).toBeVisible();
  const glyph = result.locator('svg path').first();
  await expect(glyph).toHaveAttribute('d', /^M.{23}/);
  const shape = await glyph.getAttribute('d');
  await expect.poll(() => fanPaths.has(shape)).toBe(true);
  expect([...assets]).toEqual(expect.arrayContaining(['iconList.json', 'iconMetadata.json']));
  await result.click();
  await expect(picker.locator('button.trigger svg:not(.arrow) path')).toHaveAttribute('d', shape);
  await evidence(info, page, 'ha-mdi-picker-selected');
  await dialog.locator(HP.dialogConfirm).first().click();
  await expect(dialog).toBeHidden();
  await waitForConfig(config => config.markers.find(marker => marker.id === markerId)?.icon === wanted);
  await leaveEditor(host);
  await page.reload();
  const reopenedHost = await openPlan(page, { space: 'f1' });
  const { picker: reopened } = await openIconControl(page, reopenedHost);
  await expect(reopened).toHaveJSProperty('value', wanted);
  await expect(reopened.locator('button.trigger svg:not(.arrow) path')).toHaveAttribute('d', shape);
});
