// Home Assistant restarts under an open page (update, config reload, a power
// blip): the plan must come back alive without the user reloading anything.
// Runs last in the main suite because it takes HA down for ~15 s.
import { test, expect } from '@playwright/test';
import { callService, waitForState } from './lib/ha-api.mjs';
import { restartHa } from './lib/ha-ctl.mjs';
import { card, deviceMarker, evidence, expectPlanDrawn } from './lib/ha-page.mjs';

const LAMP = 'light.wall_lamp_1';

test('an open plan survives a Home Assistant restart and is live again', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await callService('light', 'turn_off', { entity_id: LAMP });
  await page.goto('/houseplan');
  const host = card(page);
  await expectPlanDrawn(page, host);
  const marker = deviceMarker(host, LAMP);
  await expect(marker).toHaveAttribute('data-state', 'neutral');

  restartHa();
  // HA's frontend reconnects its websocket on its own; the card must resume
  // without a page reload — no reload here on purpose
  await expect(host).toBeVisible();
  await expect.poll(() => host.locator('[data-hp="room"]').count(), { timeout: 60_000 }).toBeGreaterThan(0);
  await callService('light', 'turn_on', { entity_id: LAMP });
  await waitForState(LAMP, 'on');
  await expect(marker).toHaveAttribute('data-state', 'working', { timeout: 60_000 });
  await evidence(testInfo, page, 'after-restart.png');
  await callService('light', 'turn_off', { entity_id: LAMP });
});
