// Save as PDF (#53/#482): the printer button, the dialog, a real download —
// and the dialog's switches change the file (houseplan-card#1010, row 19).
import { test, expect } from '@playwright/test';
import { readFileSync, statSync } from 'node:fs';
import { requireHooks } from './lib/contract.mjs';
import { card, evidence, expectPlanDrawn } from './lib/ha-page.mjs';
import { HP, confirmIn } from './lib/hooks.mjs';
import { field } from './lib/plan.mjs';

async function downloadPdf(page, dialog) {
  const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
  await confirmIn(dialog).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(readFileSync(path).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  return { download, path, bytes: readFileSync(path) };
}

test('the current space downloads as a real PDF', async ({ page }, testInfo) => {
  await page.goto('/houseplan');
  const host = card(page);
  await expectPlanDrawn(page, host);
  await host.locator(HP.pdf).first().click();
  const dialog = host.locator(HP.dialog('pdf')).first();
  await expect(dialog).toBeVisible();
  await evidence(testInfo, page, 'pdf-dialog.png');

  const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
  await confirmIn(dialog).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  const path = await download.path();
  const size = statSync(path).size;
  expect(size).toBeGreaterThan(10_000);
  const head = readFileSync(path).subarray(0, 5).toString('latin1');
  expect(head).toBe('%PDF-');
  await testInfo.attach(download.suggestedFilename(), { path, contentType: 'application/pdf' });
});

test('switching room names off in the dialog changes the PDF', async ({ page }, testInfo) => {
  requireHooks(test, 'field');
  await page.goto('/houseplan');
  const host = card(page);
  await expectPlanDrawn(page, host);
  await host.locator(HP.pdf).first().click();
  let dialog = host.locator(HP.dialog('pdf')).first();
  await expect(dialog).toBeVisible();
  await expect(field(dialog, 'pdf-roomNames')).toBeChecked();
  const withNames = await downloadPdf(page, dialog);

  await host.locator(HP.pdf).first().click();
  dialog = host.locator(HP.dialog('pdf')).first();
  await expect(dialog).toBeVisible();
  await field(dialog, 'pdf-roomNames').uncheck();
  await evidence(testInfo, page, 'pdf-without-room-names');
  const withoutNames = await downloadPdf(page, dialog);
  // the same plan without its room names: a different, smaller document
  expect(withoutNames.bytes.equals(withNames.bytes)).toBe(false);
  expect(withoutNames.bytes.length).toBeLessThan(withNames.bytes.length);
  await testInfo.attach('without-room-names.pdf', { path: withoutNames.path, contentType: 'application/pdf' });
});
