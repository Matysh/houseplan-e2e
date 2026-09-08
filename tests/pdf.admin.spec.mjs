// Save as PDF (#53/#482): the printer button, the dialog, a real download.
import { test, expect } from '@playwright/test';
import { readFileSync, statSync } from 'node:fs';
import { card, evidence, expectPlanDrawn } from './lib/ha-page.mjs';

test('the current space downloads as a real PDF', async ({ page }, testInfo) => {
  await page.goto('/houseplan');
  const host = card(page);
  await expectPlanDrawn(page, host);
  // TODO(houseplan-card#489): data-hp="pdf" / data-hp="dialog-confirm"
  await host.locator('.pdf-button').click();
  const dialog = host.locator('hp-dialog').first();
  await expect(dialog).toBeVisible();
  await evidence(testInfo, page, 'pdf-dialog.png');

  const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
  await dialog.getByRole('button', { name: /^save$/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  const path = await download.path();
  const size = statSync(path).size;
  expect(size).toBeGreaterThan(10_000);
  const head = readFileSync(path).subarray(0, 5).toString('latin1');
  expect(head).toBe('%PDF-');
  await testInfo.attach(download.suggestedFilename(), { path, contentType: 'application/pdf' });
});
