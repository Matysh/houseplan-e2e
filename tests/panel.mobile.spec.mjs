// Narrow, touch, Android Chrome UA: the sidebar page must still draw the plan
// and offer HA's drawer through the panel's own menu button.
import { test, expect } from '@playwright/test';
import { expectPlanDrawn } from './lib/ha-page.mjs';

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

  await panel.locator('.menu').tap();
  await expect(page.locator('ha-sidebar')).toBeVisible();
});
