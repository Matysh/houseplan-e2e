// A household member (non-admin user) sees the plan and nothing that edits it.
import { test, expect } from '@playwright/test';
import { card, editorTabs, expectPlanDrawn } from './lib/ha-page.mjs';
import { HP, hp } from './lib/hooks.mjs';
import { expectIntrinsicHeader, headerActionTarget } from './lib/header-actions.mjs';
import { hasNamedSpaceHeaderContract } from './lib/panel-release-contract.mjs';

async function checkNarrowReadOnly(page,host) {
  if (!hasNamedSpaceHeaderContract()) return;
  await page.setViewportSize({width:390,height:844});
  await expectIntrinsicHeader(host);
  await expect(editorTabs(host)).toHaveCount(0);
  await expect(host.locator(HP.spaceAdd)).toHaveCount(0);
  await expect(host.locator(HP.settings)).toHaveCount(0);
  await headerActionTarget(host,hp('hidden-devices'));
  await expect(host.locator('[data-hp="header-actions-menu"] [data-action="mode-plan"],[data-hp="header-actions-menu"] [data-action="settings"],[data-hp="header-actions-menu"] [data-action="space-add"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
}

test.describe('House Plan for a non-admin user', () => {
  test('the sidebar page shows the plan read-only', async ({ page }) => {
    await page.goto('/houseplan');
    await expect(page.locator('houseplan-panel')).toBeVisible({ timeout: 60_000 });
    const host = card(page);
    await expectPlanDrawn(page, host);
    await expect(editorTabs(host)).toHaveCount(0);
    await expect(host.locator(HP.spaceAdd)).toHaveCount(0);
    await expect(host.locator(HP.settings)).toHaveCount(0);
    await checkNarrowReadOnly(page,host);
  });

  test('the dashboard card is the same read-only plan', async ({ page }) => {
    await page.goto('/house-plan/plan');
    const host = card(page);
    await expectPlanDrawn(page, host);
    await expect(editorTabs(host)).toHaveCount(0);
    await checkNarrowReadOnly(page,host);
  });
});
