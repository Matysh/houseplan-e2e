// #1154: real-HA replacement of Space settings by Copy must retain the name.
import { test, expect } from '@playwright/test';
import { compareTags } from '../scripts/tags.mjs';
import { installedRecord, requireHooks } from './lib/contract.mjs';
import { card, evidence, expectPlanDrawn } from './lib/ha-page.mjs';
import { planConfig } from './lib/ha-ws.mjs';
import { HP, hp } from './lib/hooks.mjs';
import { field, selectSpace } from './lib/plan.mjs';
import { restoreSeedAfterEach } from './lib/seed-guard.mjs';

requireHooks(test, 'space-settings', 'action@data-action', 'dialog@data-kind');
restoreSeedAfterEach(test);

test('space-copy name survives the retired HA settings shell and Cancel keeps configuration', async ({ page }, testInfo) => {
  const version = installedRecord()?.version;
  test.skip(!!version && compareTags('v' + version, 'v1.83.0-beta.6') < 0,
    'Space-copy lifecycle correction #1154 ships in 1.83.0-beta.6; an older release is not its proof');
  const before = (await planConfig()).config;
  const source = before.spaces.find(space => space.id === 'f1') || before.spaces[0];
  expect(source).toBeTruthy();
  await page.goto('/houseplan');
  const host = card(page);
  await expectPlanDrawn(page, host);
  await selectSpace(host, source.id);
  await host.locator(hp('space-settings', { id: source.id })).first().click();
  const dialog = host.locator(HP.dialog('space')).first();
  await expect(dialog).toBeVisible();
  await dialog.locator(hp('action', { action: 'space-copy' })).click();
  const name = dialog.getByRole('textbox');
  await expect(name).toBeVisible();
  await name.fill('E2E retained copy name');
  // Observe beyond the retired shell's bounded exit. This is real HA lifecycle:
  // no synthetic events, constructor replacement, retries or product patches.
  await page.waitForTimeout(750);
  await expect(dialog).toBeVisible();
  await expect(name).toHaveValue('E2E retained copy name');
  expect((await planConfig()).config).toEqual(before);
  await evidence(testInfo, page, 'copy-name-retained');
  await dialog.locator(HP.dialogCancel).first().click();
  await expect(field(dialog, 'space-title')).toHaveValue(source.title);
  await evidence(testInfo, page, 'copy-cancel-returned-settings');
  await dialog.locator(HP.dialogCancel).first().click();
  await expect(host.locator(HP.dialog('space'))).toHaveCount(0);
  expect((await planConfig()).config).toEqual(before);
});
