// The update path (the "configuration error after the new beta" class):
// House Plan N is open in a browser, the household updates to N+1 through
// HACS and restarts HA, then keeps using the same browser — no cache
// clearing, no Ctrl+F5. The plan must come back on the new bundle.
import { test, expect } from '@playwright/test';
import { installHouseplan, installedBundleFingerprint, installedHouseplan, restartHa } from '../lib/ha-ctl.mjs';
import { card, evidence, expectPlanDrawn, navigateInApp } from '../lib/ha-page.mjs';

const TARGET = process.env.HOUSEPLAN_REF || 'latest';
const pageFingerprint = (page) => page.evaluate(() => globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__ || null);
const resourceVersions = (page) => page.evaluate(async () => {
  const hass = document.querySelector('home-assistant').hass;
  const resources = await hass.callWS({ type: 'lovelace/resources' });
  return resources.map((r) => r.url).filter((u) => u.includes('houseplan'));
});

test('an open browser follows an integration update after the HA restart', async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  const before = installedHouseplan();
  await page.goto('/house-plan/plan');
  await expectPlanDrawn(page);
  const fpBefore = installedBundleFingerprint();
  expect(await pageFingerprint(page)).toBe(fpBefore);
  await evidence(testInfo, page, `before-${before.version}.png`);

  const after = installHouseplan(TARGET);
  expect(after.version).not.toBe(before.version);
  const fpAfter = installedBundleFingerprint();
  expect(fpAfter).not.toBe(fpBefore);
  restartHa();

  // 1. the same tab, reconnected, moving inside the app: the old bundle is
  //    still loaded — the product must either keep working or say clearly
  //    that versions differ; a silent blank plan is the failure
  await navigateInApp(page, '/house-plan/kiosk');
  await navigateInApp(page, '/house-plan/plan');
  const host = card(page);
  const mismatch = page.getByText(/versions do not match/i);
  await expect(host.locator('[data-hp="room"]').first().or(mismatch)).toBeVisible({ timeout: 90_000 });
  await evidence(testInfo, page, 'after-restart-same-tab.png');

  // 2. an ordinary reload (HTTP cache intact): the new bundle must load
  await page.reload();
  await expectPlanDrawn(page);
  await expect.poll(() => pageFingerprint(page), { timeout: 60_000 }).toBe(fpAfter);
  const urls = await resourceVersions(page);
  expect(urls.some((u) => u.includes(`v=${after.version}`))).toBe(true);
  await expect(page.getByText(/versions do not match/i)).toHaveCount(0);
  await evidence(testInfo, page, `after-${after.version}.png`);

  // 3. the sidebar page of the new version works in that same browser
  await page.goto('/houseplan');
  await expect(page.locator('houseplan-panel')).toBeVisible({ timeout: 60_000 });
  await expectPlanDrawn(page, page.locator('houseplan-panel houseplan-card'));
});
