// The summary side panel on a real Home Assistant (houseplan-card#1010,
// row 18): shown from its header button, its configured values drawn, its
// title edited in its settings dialog and kept on the server.
//
// The panel's settings form has no field hooks in the product contract yet
// (#1011 covered the four settings dialogs, Properties, PDF and Help); its
// controls are found by their accessible names in the fixed en-US locale.
//
// The default panel shows the date and time. The journey's edit removes that
// value first — a clock has no place in evidence frames diffed run to run —
// and only then takes its frames.
import { test, expect } from '@playwright/test';
import { requireHooks } from './lib/contract.mjs';
import { card, evidence, expectPlanDrawn } from './lib/ha-page.mjs';
import { planConfig, waitForConfig } from './lib/ha-ws.mjs';
import { HP, hp } from './lib/hooks.mjs';
import { restoreSeedAfterEach } from './lib/seed-guard.mjs';

requireHooks(test, 'summary-panel', 'summary-toggle', 'summary-settings', 'summary-metric@data-id');
restoreSeedAfterEach(test);

test('the summary panel is shown, its values are drawn and its title is edited', async ({ page }, testInfo) => {
  const before = (await planConfig()).config;
  await page.goto('/houseplan');
  const host = card(page);
  await expectPlanDrawn(page, host);
  const panel = host.locator(hp('summary-panel')).first();
  if (!(await panel.isVisible().catch(() => false))) await host.locator(hp('summary-toggle')).first().click();
  await expect(panel).toBeVisible();
  for (const id of ['summary-device-count', 'summary-total-area']) {
    await expect(host.locator(hp('summary-metric', { id })).first()).toBeVisible();
  }
  await expect(host.locator(hp('summary-metric', { id: 'summary-device-count' })).first()).toContainText(/\d+/);
  await expect(host.locator(hp('summary-metric', { id: 'summary-datetime' })).first()).toBeVisible();

  await host.locator(hp('summary-settings')).first().click();
  const dialog = host.locator(HP.dialog('summary')).first();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/panel title/i).fill('House at a glance');
  // remove the clock: the Delete button of the row whose value is "Date and time"
  const names = await dialog.getByRole('textbox', { name: 'Value name' }).evaluateAll((els) => els.map((e) => e.value));
  const row = names.indexOf('Date and time');
  expect(row).toBeGreaterThanOrEqual(0);
  await dialog.getByRole('button', { name: 'Delete', exact: true }).nth(row).click();
  await evidence(testInfo, page, 'summary-settings');
  await dialog.locator(HP.dialogConfirm).first().click();
  await expect(dialog).toBeHidden();
  await expect(panel).toContainText('House at a glance');
  await expect(host.locator(hp('summary-metric', { id: 'summary-datetime' }))).toHaveCount(0);
  await waitForConfig((c) => JSON.stringify(c).includes('House at a glance') && JSON.stringify(c) !== JSON.stringify(before),
    { message: 'summary title stored' });
  await evidence(testInfo, page, 'summary-edited');

  await page.reload();
  const fresh = card(page);
  await expectPlanDrawn(page, fresh);
  const again = fresh.locator(hp('summary-panel')).first();
  if (!(await again.isVisible().catch(() => false))) await fresh.locator(hp('summary-toggle')).first().click();
  await expect(again).toContainText('House at a glance');
  await expect(fresh.locator(hp('summary-metric', { id: 'summary-datetime' }))).toHaveCount(0);
  await evidence(testInfo, page, 'summary-after-reload');

  // the header button hides the panel again
  await fresh.locator(hp('summary-toggle')).first().click();
  await expect(again).toBeHidden();
});
