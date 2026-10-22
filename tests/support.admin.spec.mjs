// Help and feedback on a real Home Assistant (houseplan-card#1010, row 20):
// the dialog opens, the extended diagnostics are prepared on the server and
// previewed, the package downloads as JSON — and nothing is sent: the seed has
// no relay and the journey closes the dialog instead of pressing Send.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { requireHooks } from './lib/contract.mjs';
import { card, evidence, expectPlanDrawn } from './lib/ha-page.mjs';
import { HP } from './lib/hooks.mjs';
import { action, field } from './lib/plan.mjs';

requireHooks(test, 'field', 'action');

test('the diagnostics package is prepared, previewed and downloaded without sending', async ({ page }, testInfo) => {
  await page.goto('/houseplan');
  const host = card(page);
  await expectPlanDrawn(page, host);
  await host.locator(HP.support).first().click();
  const dialog = host.locator(HP.dialog('support')).first();
  await expect(dialog).toBeVisible();
  await field(dialog, 'support-message').fill('E2E journey — this report is never sent');
  await field(dialog, 'support-attach').check();
  // the server prepares a snapshot of the plan: three spaces in the seed
  await expect(dialog).toContainText(/3 spaces/, { timeout: 30_000 });
  await evidence(testInfo, page, 'support-prepared');

  await action(dialog, 'support-preview').click();
  const raw = field(dialog, 'support-preview-text');
  await expect(raw).toBeVisible();
  await expect.poll(async () => (await raw.inputValue()).includes('"spaces"')).toBe(true);
  await evidence(testInfo, page, 'support-preview');

  const downloading = page.waitForEvent('download');
  await action(dialog, 'support-download').click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const pack = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(JSON.stringify(pack)).toContain('"spaces"');
  await testInfo.attach(download.suggestedFilename(), { path: await download.path(), contentType: 'application/json' });

  await dialog.locator(HP.dialogCancel).filter({ hasText: /close/i }).first().click();
  await expect(dialog).toBeHidden();
});
