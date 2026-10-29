// The sidebar page /houseplan (#486) on a real Home Assistant — the journey
// that was blank in v1.73.0-beta.5 (#488) for two reasons the harness could
// not see: HA assigns properties before the element is defined, and the
// panel container has no height.
import { test, expect } from '@playwright/test';
import { callService, waitForState } from './lib/ha-api.mjs';
import { requireHooks } from './lib/contract.mjs';
import { hasOverflowPanelHeader } from './lib/panel-release-contract.mjs';
import { card, deviceMarker, editorTabs, expectPlanDrawn, spaceEntries, spaceTabs } from './lib/ha-page.mjs';
import { hp } from './lib/hooks.mjs';

const LAMP = 'light.wall_lamp_1';

test.describe('House Plan sidebar panel', () => {
  test('is listed in the sidebar and shows the plan on the very first open', async ({ page }) => {
    await page.goto('/houseplan');
    const panel = page.locator('houseplan-panel');
    await expect(panel).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('ha-sidebar a[href="/houseplan"]')).toHaveCount(1);

    const host = panel.locator('houseplan-card');
    const stage = await expectPlanDrawn(page, host);
    const viewport = page.viewportSize();
    // The panel owns a usable full-height plan rather than a dashboard column.
    expect(stage.height).toBeGreaterThan(viewport.height * 0.6);
    expect(stage.width).toBeGreaterThan(viewport.width * 0.6);

    await expect.poll(() => spaceEntries(host).count()).toBeGreaterThanOrEqual(3);
    // an administrator gets the three editors; nothing else in the page
    // duplicates the product title
    await expect(editorTabs(host)).toHaveCount(3);
    await expect(panel.locator('[role="heading"]')).toHaveCount(hasOverflowPanelHeader() ? 0 : 1);
  });

  test('lists the spaces in one select on this window and as tabs on a wide one', async ({ page }) => {
    requireHooks(test, 'space-select', 'space-select-value', 'space-tab@data-space');
    if (hasOverflowPanelHeader()) await page.setViewportSize({ width: 640, height: 900 });
    await page.goto('/houseplan');
    const host = card(page);
    await expectPlanDrawn(page, host);
    // #1120 uses content overflow. These dimensions exercise both forms with
    // the same roster; they are test inputs rather than product breakpoints.
    await expect(host.locator(hp('space-select')).first()).toBeVisible();
    await expect(spaceTabs(host)).toHaveCount(0);
    const options = host.locator(`${hp('space-select-value')} option`);
    await expect.poll(() => options.count()).toBeGreaterThanOrEqual(3);
    const listed = await options.evaluateAll((all) => all.map((o) => o.value));

    // With enough room ordinary tabs return in the same order.
    await page.setViewportSize({ width: hasOverflowPanelHeader() ? 1920 : 1600, height: 900 });
    await expect(spaceTabs(host)).toHaveCount(listed.length);
    expect(await spaceTabs(host).evaluateAll((all) => all.map((t) => t.dataset.space))).toEqual(listed);
    await expect(host.locator(hp('space-select'))).toHaveCount(0);
  });

  test('survives leaving for a dashboard and coming back inside the app', async ({ page }) => {
    await page.goto('/houseplan');
    await expectPlanDrawn(page);
    // in-app navigation: HA tears the panel element down and recreates it
    await page.locator('ha-sidebar a[href="/house-plan"]').first().click();
    await expect(page).toHaveURL(/\/house-plan/);
    await expectPlanDrawn(page);
    await page.locator('ha-sidebar a[href="/houseplan"]').first().click();
    await expect(page).toHaveURL(/\/houseplan$/);
    const stage = await expectPlanDrawn(page, page.locator('houseplan-panel houseplan-card'));
    expect(stage.height).toBeGreaterThan(page.viewportSize().height * 0.6);
  });

  test('reflects entity state changed in Home Assistant', async ({ page }) => {
    await callService('light', 'turn_off', { entity_id: LAMP });
    await waitForState(LAMP, 'off');
    await page.goto('/houseplan');
    const host = card(page);
    await expectPlanDrawn(page, host);
    const marker = deviceMarker(host, LAMP);
    await expect(marker).toBeVisible();
    await expect(marker).toHaveAttribute('data-state', 'neutral');

    await callService('light', 'turn_on', { entity_id: LAMP });
    await waitForState(LAMP, 'on');
    await expect(marker).toHaveAttribute('data-state', 'working');

    await callService('light', 'turn_off', { entity_id: LAMP });
    await waitForState(LAMP, 'off');
    await expect(marker).toHaveAttribute('data-state', 'neutral');
  });

  test('tapping a toggle-bound lamp switches it in Home Assistant', async ({ page }) => {
    await callService('light', 'turn_off', { entity_id: LAMP });
    await waitForState(LAMP, 'off');
    await page.goto('/houseplan');
    const host = card(page);
    await expectPlanDrawn(page, host);
    const marker = deviceMarker(host, LAMP);
    await expect(marker).toHaveAttribute('data-state', 'neutral');
    // the seed binds this marker with tap_action: toggle — a real click must
    // reach HA, and the plan must follow HA back
    await marker.click();
    await waitForState(LAMP, 'on');
    await expect(marker).toHaveAttribute('data-state', 'working');
    await callService('light', 'turn_off', { entity_id: LAMP });
    await waitForState(LAMP, 'off');
  });
});
