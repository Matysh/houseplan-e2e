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

  test('Sections view: the card defaults to the full width of its section', async ({ page }) => {
    await page.goto('/e2e-sections/plan');
    const host = card(page);
    const stage = await expectPlanDrawn(page, host);
    // HA's "full" means the whole section grid (12 columns), not the whole
    // view: a section is one view column. Anything narrower is the default
    // 400-px card a cold user complained about (#486).
    const section = page.locator('hui-section').first();
    await expect(section).toBeVisible();
    const sectionBox = await section.boundingBox();
    expect(stage.width).toBeGreaterThan(sectionBox.width * 0.9);
    expect(stage.width).toBeGreaterThan(400);
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
