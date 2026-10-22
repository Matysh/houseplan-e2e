// Spaces on a real Home Assistant (houseplan-card#1010, row 17): an
// administrator adds a space drawn by hand, then deletes it from its settings.
// Oracles: the spaces the integration stores, the tabs after a reload, the
// toast that names the outcome by its i18n key.
import { test, expect } from '@playwright/test';
import { requireHooks } from './lib/contract.mjs';
import { card, evidence, expectPlanDrawn } from './lib/ha-page.mjs';
import { planConfig, waitForConfig } from './lib/ha-ws.mjs';
import { HP, hp } from './lib/hooks.mjs';
import { field } from './lib/plan.mjs';
import { restoreSeedAfterEach } from './lib/seed-guard.mjs';

requireHooks(test, 'space-tab@data-space', 'space-delete', 'field', 'toast@data-id');
restoreSeedAfterEach(test);

test('a space is added, kept after a reload, and deleted again', async ({ page }, testInfo) => {
  const before = (await planConfig()).config.spaces.map((s) => s.id);
  await page.goto('/houseplan');
  let host = card(page);
  await expectPlanDrawn(page, host);
  await host.locator(HP.spaceAdd).first().click();
  const dialog = host.locator(HP.dialog('space')).first();
  await expect(dialog).toBeVisible();
  await field(dialog, 'space-title').fill('E2E Annex');
  await field(dialog, 'space-plan-source').selectOption({ label: 'Draw it myself' });
  await evidence(testInfo, page, 'space-add-dialog');
  await dialog.locator(HP.dialogConfirm).first().click();
  await expect(dialog).toBeHidden();
  const created = await waitForConfig((c) => c.spaces.some((s) => s.title === 'E2E Annex'), { message: 'space stored' });
  const annex = created.spaces.find((s) => s.title === 'E2E Annex');
  expect(before).not.toContain(annex.id);
  // a new space opens in the plan editor with the Walls tool, ready to draw
  await expect(host.locator(HP.mode('plan'))).toBeVisible();
  await expect(host.locator(HP.tool('draw'))).toHaveAttribute('aria-pressed', 'true');
  await evidence(testInfo, page, 'space-added');

  await page.reload();
  host = card(page);
  await expect(host.locator(hp('space-tab', { space: annex.id }))).toContainText('E2E Annex', { timeout: 60_000 });
  await expect(host.locator(HP.spaceTab)).toHaveCount(before.length + 1);

  // delete from its own settings; an empty space needs no device decision
  await host.locator(hp('space-settings', { id: annex.id })).first().click();
  const settings = host.locator(HP.dialog('space')).first();
  await expect(settings).toBeVisible();
  await settings.locator(hp('space-delete')).first().click();
  const confirm = host.locator(HP.dialog('confirm')).first();
  await expect(confirm).toBeVisible();
  await evidence(testInfo, page, 'space-delete-confirm');
  await confirm.locator(HP.dialogConfirm).first().click();
  await waitForConfig((c) => !c.spaces.some((s) => s.id === annex.id), { message: 'space deleted on the server' });
  await expect(host.locator(hp('space-tab', { space: annex.id }))).toHaveCount(0);
  await expect(host.locator(hp('toast')).last()).toHaveAttribute('data-id', /.+/);
  const toastKey = await host.locator(hp('toast')).last().getAttribute('data-id');
  expect(toastKey).toMatch(/space/i);
  await evidence(testInfo, page, 'space-deleted');

  await page.reload();
  host = card(page);
  await expectPlanDrawn(page, host);
  await expect(host.locator(HP.spaceTab)).toHaveCount(before.length);
});
