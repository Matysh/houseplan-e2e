// Narrow, touch, Android Chrome UA: the sidebar page must still draw the plan
// and offer HA's drawer through the panel's own menu button.
import { test, expect } from '@playwright/test';
import { expectPlanDrawn } from './lib/ha-page.mjs';
import { HP } from './lib/hooks.mjs';
import { hasBeta4PanelContract } from './lib/panel-release-contract.mjs';
import { expectPanelShell, expectNativeDrawerEntry } from './lib/panel-shell.mjs';

test('sidebar page on a phone draws the plan and opens the drawer', async ({ page }) => {
  await page.goto('/houseplan');
  const panel = page.locator('houseplan-panel');
  await expect(panel).toBeVisible({ timeout: 60_000 });
  const stage = await expectPlanDrawn(page, panel.locator('houseplan-card'));
  const viewport = page.viewportSize();
  expect(stage.width).toBeGreaterThan(viewport.width * 0.8);
  expect(stage.height).toBeGreaterThan(viewport.height * 0.4);
  // no page-wide horizontal scroll
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  const menu = panel.locator(HP.panelMenu).first();
  if (hasBeta4PanelContract()) {
    // The menu belongs to the card; an outer title no longer reserves 56px.
    await expect(panel.locator('houseplan-card').locator(HP.panelMenu)).toHaveCount(1);
    await expectPanelShell(panel, panel.locator('houseplan-card'));
    const target = await menu.boundingBox();
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator('ha-sidebar a[href="/houseplan"]')).not.toBeInViewport();
  }
  await menu.tap();
  await expect(page.locator('ha-sidebar')).toBeVisible();
  if (hasBeta4PanelContract()) await expectNativeDrawerEntry(page);
});
