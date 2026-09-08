// The dashboard card in the three layouts real users put it in. The Sections
// case is the one that lost a cold user (#486): a new HA dashboard is a
// Sections view, and a card there is ~400 px wide unless it asks for full width.
import { test, expect } from '@playwright/test';
import { card, expectPlanDrawn } from './lib/ha-page.mjs';

test.describe('House Plan card on dashboards', () => {
  test('Panel view: the card owns the page', async ({ page }) => {
    await page.goto('/house-plan/plan');
    const stage = await expectPlanDrawn(page);
    expect(stage.width).toBeGreaterThan(page.viewportSize().width * 0.6);
  });

  test('Sections view: the card defaults to the full section width', async ({ page }) => {
    await page.goto('/e2e-sections/plan');
    const host = card(page);
    const stage = await expectPlanDrawn(page, host);
    const view = page.locator('hui-view, hui-sections-view').first();
    const viewBox = await view.boundingBox();
    // full width of the view, not one grid column of it
    expect(stage.width).toBeGreaterThan(viewBox.width * 0.7);
  });

  test('Masonry view: the card still draws the plan', async ({ page }) => {
    await page.goto('/e2e-sections/masonry');
    await expectPlanDrawn(page);
  });

  test('kiosk view hides the header and keeps the plan', async ({ page }) => {
    await page.goto('/house-plan/kiosk');
    const host = card(page);
    await expectPlanDrawn(page, host);
    // hidden or not rendered at all — either way nothing of the header shows
    await expect(host.locator('[data-hp="space-tab"]').first()).toBeHidden();
    await expect(host.locator('[data-editor-navigation]').first()).toBeHidden();
  });
});
