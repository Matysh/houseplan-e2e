// Seed variant `empty`: the very first contact of an administrator — the
// step where the cold Reddit user was lost (#486). Ends with a persisted
// first space; outlining rooms by real clicks waits for the grid hooks (#489).
import { test, expect } from '@playwright/test';
import { seedVariant } from '../lib/ha-ctl.mjs';
import { card, editorTabs, evidence, spaceTabs } from '../lib/ha-page.mjs';

test.skip(() => seedVariant() !== 'empty', 'needs the empty seed variant');

test('from the sidebar page to a saved first space without any image', async ({ page }, testInfo) => {
  await page.goto('/houseplan');
  await expect(page.locator('houseplan-panel')).toBeVisible({ timeout: 60_000 });
  const host = card(page);
  const empty = host.locator('.empty');
  await expect(empty).toBeVisible({ timeout: 60_000 });
  await expect(empty).toContainText(/add the first space/i);
  await evidence(testInfo, page, 'empty-admin.png');

  // TODO(houseplan-card#489): data-hp="create-space", "dialog", "dialog-confirm"
  await empty.getByRole('button', { name: /add space/i }).click();
  const dialog = host.locator('hp-dialog').first();
  await expect(dialog).toBeVisible();
  await dialog.locator('input[type="text"]').first().fill('Ground floor');
  await dialog.getByText(/no image/i).click();
  await evidence(testInfo, page, 'first-space-dialog.png');
  await dialog.getByRole('button', { name: /^save$/i }).click();
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
