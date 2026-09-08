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
  const username = page.locator('input[name="username"], input[autocomplete="username"]').first();
  const password = page.locator('input[name="password"], input[type="password"]').first();
  await username.waitFor({ state: 'visible', timeout: 60_000 });
  await username.fill(user.username);
  await password.fill(user.password);
  // "Keep me logged in" decides whether HA persists its tokens in
  // localStorage; the saved browser state needs them there. The control is a
  // wa-checkbox: read the real checked state, click the host if needed.
  const keep = page.locator('ha-checkbox').filter({ hasText: /keep me logged in/i }).first();
  const isKept = () => keep.evaluate((el) => !!(el.checked ?? el.shadowRoot?.querySelector('input')?.checked));
  if (await keep.count()) {
    if (!(await isKept())) await keep.click();
    await expect.poll(isKept, { message: 'Keep me logged in did not check' }).toBe(true);
  }
  await password.press('Enter');
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/'), { timeout: 60_000 });
  await expect(page.locator('home-assistant-main')).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => page.evaluate(() => {
    // fallback for a login page without the checkbox: HA keeps the tokens in
    // memory (window.__tokenCache); persist them the way enableWrite() does
    if (!window.localStorage.getItem('hassTokens') && window.__tokenCache?.tokens) {
      window.localStorage.setItem('hassTokens', JSON.stringify(window.__tokenCache.tokens));
    }
    return !!window.localStorage.getItem('hassTokens');
  }), { timeout: 30_000, message: 'HA did not persist its tokens' }).toBe(true);
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

/** In-app navigation (no page load), the way HA's own sidebar does it. */
export async function navigateInApp(page, path) {
  await page.evaluate((p) => {
    history.pushState(null, '', p);
    window.dispatchEvent(new CustomEvent('location-changed'));
  }, path);
}

/**
 * Screenshot as evidence, attached to the report of every run — not compared.
 * A real HA shows live values that drift by the minute, so pixel gates would
 * only produce noise; the product's own golden suite owns pixel fidelity.
 */
export async function evidence(testInfo, page, name) {
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}
