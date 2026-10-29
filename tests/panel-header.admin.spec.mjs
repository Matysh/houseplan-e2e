// #1120: the real HA host owns narrow/sidebar state. The fixture uses HA's
// native browser preference switch; it never edits storage or a private hass
// property. Primary API/DOM source: home-assistant/frontend
// src/panels/profile/ha-force-narrow-row.ts, ha-profile-dashboard.ts.
import { test, expect } from '@playwright/test';
import { requireHooks } from './lib/contract.mjs';
import { HP } from './lib/hooks.mjs';
import { card, expectPlanDrawn, spaceEntries, evidence } from './lib/ha-page.mjs';
import { hasBeta4PanelContract } from './lib/panel-release-contract.mjs';
import { expectPanelShell } from './lib/panel-shell.mjs';

requireHooks(test, 'panel-menu', 'panel-title', 'stage', 'space-select', 'space-tab');

async function browserSidebarPreference(page) {
  await page.goto('/profile/browser');
  const control = page.locator('ha-force-narrow-row').getByRole('switch');
  await expect(control).toBeVisible({ timeout: 60_000 });
  return control;
}
async function setHiddenPreference(page, hidden) {
  const control = await browserSidebarPreference(page);
  if (await control.isChecked() !== hidden) await control.click();
  if (hidden) await expect(control).toBeChecked();
  else await expect(control).not.toBeChecked();
}
async function ordinaryPanel(page) {
  await page.goto('/houseplan');
  const panel = page.locator('houseplan-panel'), host = panel.locator('houseplan-card');
  await expectPlanDrawn(page, host);
  await expectPanelShell(panel, host);
  return { panel, host, menu: host.locator(HP.panelMenu).first() };
}
async function menuTarget(menu) {
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  return box;
}
const sidebarEntry = page => page.locator('ha-sidebar a[href="/houseplan"]');

test('the native HA menu follows width and the real sidebar preference, and stays outside Lovelace', async ({ page }, testInfo) => {
  test.skip(!hasBeta4PanelContract(), 'the released beta.3 header predates #1120; a skip is not beta.4 proof');
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1920, height: 1000 });
  // Playwright gives this test its own disposable BrowserContext. The native
  // switch restores only the hidden boolean (auto and docked both read false);
  // closing the context discards browser preferences without changing saved auth.
  const original = await (await browserSidebarPreference(page)).isChecked();
  try {
    await setHiddenPreference(page, false);
    const { host, menu } = await ordinaryPanel(page);
    // Wide auto/docked HA keeps its own sidebar; House Plan adds no duplicate.
    await expect(menu).toBeHidden();

    // A real HA viewport transition reaches the existing panel without a new
    // page, injected state, or a fixed-width rule in the test implementation.
    await page.setViewportSize({ width: 390, height: 844 });
    await menuTarget(menu);
    await expectPlanDrawn(page, host);
    await expect(sidebarEntry(page)).not.toBeInViewport();
    await menu.click();
    await expect(sidebarEntry(page)).toBeInViewport({ ratio: 0.9 });
    await page.keyboard.press('Escape');
    await expect(sidebarEntry(page)).not.toBeInViewport();
    await evidence(testInfo, page, 'native-ha-narrow-menu');

    await page.setViewportSize({ width: 1920, height: 1000 });
    await expect(menu).toBeHidden();
    await expectPlanDrawn(page, host);

    // HA's ordinary switch emits its native hass-dock-sidebar event and stores
    // the browser preference itself. A cold panel must honor it as well.
    await setHiddenPreference(page, true);
    const hidden = await ordinaryPanel(page), menuBox = await menuTarget(hidden.menu);
    const firstSpace = await spaceEntries(hidden.host).first().boundingBox();
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(firstSpace.x + 1);
    await hidden.menu.click();
    await expect(sidebarEntry(page)).toBeInViewport({ ratio: 0.9 });
    await page.keyboard.press('Escape');
    await expect(sidebarEntry(page)).not.toBeInViewport();
    await evidence(testInfo, page, 'native-ha-wide-hidden-sidebar-menu');

    await page.goto('/house-plan');
    const lovelace = card(page);
    await expectPlanDrawn(page, lovelace);
    await expect(lovelace.locator(HP.panelMenu)).toHaveCount(0);
    await evidence(testInfo, page, 'lovelace-has-no-houseplan-menu');
  } finally {
    await page.setViewportSize({ width: 1920, height: 1000 });
    await setHiddenPreference(page, original);
  }
});
