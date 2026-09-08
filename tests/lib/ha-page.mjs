/**
 * Page-level helpers. Everything here goes through the real Home Assistant
 * frontend; the only House Plan knowledge is the documented `data-hp` /
 * `data-editor-navigation` hooks (docs/STYLING-HOOKS.md) and element names.
 */
import { expect } from '@playwright/test';

/** Log in through HA's own login page and return once the app has loaded. */
export async function loginThroughUi(page, user) {
  await page.goto('/');
  await page.waitForURL(/\/auth\/authorize/, { timeout: 60_000 });
  const username = page.locator('input[name="username"]').or(page.getByLabel(/username/i)).first();
  const password = page.locator('input[name="password"]').or(page.getByLabel(/password/i)).first();
  await username.waitFor({ state: 'visible', timeout: 60_000 });
  await username.fill(user.username);
  await password.fill(user.password);
  // "Keep me logged in" decides whether tokens land in localStorage; the
  // saved storage state needs them there.
  const keep = page.getByLabel(/keep me logged in/i);
  if (await keep.count()) {
    const checked = await keep.first().isChecked().catch(() => true);
    if (!checked) await keep.first().check().catch(() => {});
  }
  await password.press('Enter');
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/'), { timeout: 60_000 });
  await expect(page.locator('home-assistant-main')).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => page.evaluate(() => !!window.localStorage.getItem('hassTokens')), {
    timeout: 30_000,
    message: 'HA did not persist its tokens (Keep me logged in)',
  }).toBe(true);
}

/** The House Plan card inside whatever host is on the page. */
export function card(page) {
  return page.locator('houseplan-card').first();
}

/**
 * Wait until a plan is actually drawn: rooms are the first thing the card
 * renders after its server snapshot arrived, and a stage with real size is
 * what the user sees. Returns the stage bounding box.
 */
export async function expectPlanDrawn(page, host = card(page)) {
  await expect(host).toBeVisible({ timeout: 60_000 });
  const rooms = host.locator('[data-hp="room"]');
  await expect.poll(() => rooms.count(), { timeout: 60_000, message: 'no rooms drawn' }).toBeGreaterThan(0);
  const stage = host.locator('.stage').first();
  await expect(stage).toBeVisible();
  await expect.poll(async () => (await stage.boundingBox())?.height ?? 0, {
    timeout: 30_000, message: 'stage has no height',
  }).toBeGreaterThan(200);
  return stage.boundingBox();
}

export const deviceMarker = (host, entityId) => host.locator(`[data-hp="device"][data-entity="${entityId}"]`).first();
export const spaceTabs = (host) => host.locator('[data-hp="space-tab"]');
export const editorTabs = (host) => host.locator('[data-editor-navigation]');
