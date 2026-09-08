// Seed variant `empty`: the very first contact of an administrator — the
// step where the cold Reddit user was lost (#486). Ends with a persisted
// first space; outlining rooms by real clicks waits for the grid hooks (#489).
import { test, expect } from '@playwright/test';
import { seedVariant } from '../lib/ha-ctl.mjs';
import { card, editorTabs, evidence, spaceTabs } from '../lib/ha-page.mjs';
import { HP, confirmIn } from '../lib/hooks.mjs';

test.skip(() => seedVariant() !== 'empty', 'needs the empty seed variant');

test('from the sidebar page to a saved first space without any image', async ({ page }, testInfo) => {
  await page.goto('/houseplan');
  await expect(page.locator('houseplan-panel')).toBeVisible({ timeout: 60_000 });
  const host = card(page);
  const empty = host.locator(HP.empty).first();
  await expect(empty).toBeVisible({ timeout: 60_000 });
  await expect(empty).toContainText(/add the first space/i);
  await evidence(testInfo, page, 'empty-admin.png');

  // an administrator with write access gets the space dialog opened for
  // them (onboarding); the Add space button is the fallback path
  const dialog = host.locator(HP.dialog('space')).first();
  if (!(await dialog.isVisible().catch(() => false))) {
    await host.locator(HP.createSpace).first().click();
  }
  await expect(dialog).toBeVisible();
  await dialog.locator('input[type="text"]').first().fill('Ground floor');
  await dialog.getByText(/no image/i).click();
  await evidence(testInfo, page, 'first-space-dialog.png');
  await confirmIn(dialog).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });

  await expect(spaceTabs(host)).toHaveCount(1);
  await expect(spaceTabs(host).first()).toContainText('Ground floor');
  await expect(host.locator('.stage')).toBeVisible();
  await expect(editorTabs(host)).toHaveCount(3);
  await evidence(testInfo, page, 'first-space-created.png');

  // the space lives on the server, not in this tab
  await page.reload();
  await expect(spaceTabs(page.locator('houseplan-card').first())).toHaveCount(1, { timeout: 60_000 });
  await expect(spaceTabs(page.locator('houseplan-card').first()).first()).toContainText('Ground floor');
});
