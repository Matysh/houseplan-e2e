// Seed variant `empty`: the integration is configured, no plan exists.
// A household member arrives before the administrator has drawn anything.
import { test, expect } from '@playwright/test';
import { seedVariant } from '../lib/ha-ctl.mjs';
import { card, evidence } from '../lib/ha-page.mjs';
import { HP } from '../lib/hooks.mjs';

test.skip(() => seedVariant() !== 'empty', 'needs the empty seed variant');

test('a non-admin sees a calm read-only empty state, no create action', async ({ page }, testInfo) => {
  await page.goto('/houseplan');
  await expect(page.locator('houseplan-panel')).toBeVisible({ timeout: 60_000 });
  const host = card(page);
  const empty = host.locator(HP.empty).first();
  await expect(empty).toBeVisible({ timeout: 60_000 });
  await expect(empty).toContainText(/administrator/i);
  await expect(empty.locator('button')).toHaveCount(0);
  await expect(host.locator(HP.editorTabs)).toHaveCount(0);
  await evidence(testInfo, page, 'empty-viewer.png');
});
