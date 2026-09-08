// A household member (non-admin user) sees the plan and nothing that edits it.
import { test, expect } from '@playwright/test';
import { card, editorTabs, expectPlanDrawn } from './lib/ha-page.mjs';

test.describe('House Plan for a non-admin user', () => {
  test('the sidebar page shows the plan read-only', async ({ page }) => {
    await page.goto('/houseplan');
    await expect(page.locator('houseplan-panel')).toBeVisible({ timeout: 60_000 });
    const host = card(page);
    await expectPlanDrawn(page, host);
    await expect(editorTabs(host)).toHaveCount(0);
    await expect(host.locator('.tabadd')).toHaveCount(0);
    await expect(host.locator('.settings-button')).toHaveCount(0);
  });

  test('the dashboard card is the same read-only plan', async ({ page }) => {
    await page.goto('/house-plan/plan');
    const host = card(page);
    await expectPlanDrawn(page, host);
    await expect(editorTabs(host)).toHaveCount(0);
  });
});
