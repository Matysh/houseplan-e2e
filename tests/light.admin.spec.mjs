// Light from devices on a real Home Assistant (houseplan-card#1010, row 14):
// a lamp switched on in Home Assistant lights its room on the plan — the glow
// pool of exactly that source appears — and switched off it goes away. The
// glow is judged by its declared DOM result (glow-layer, glow-pool[data-entity],
// #1011), not by pixels; the evidence frames show the light itself.
import { test, expect } from '@playwright/test';
import { requireHooks } from './lib/contract.mjs';
import { callService, waitForState } from './lib/ha-api.mjs';
import { card, deviceMarker, evidence, expectPlanDrawn } from './lib/ha-page.mjs';
import { hp } from './lib/hooks.mjs';
import { settle } from './lib/plan.mjs';

requireHooks(test, 'glow-layer', 'glow-pool@data-entity');

const LAMP = 'light.wall_lamp_1';
const HALL = 'light.hallway_lamp_1';

test.afterEach(async () => {
  await callService('light', 'turn_off', { entity_id: [LAMP, HALL] });
});

test('a lamp switched on in Home Assistant spreads its light on the plan, and off removes it', async ({ page }, testInfo) => {
  await callService('light', 'turn_off', { entity_id: [LAMP, HALL] });
  await waitForState(LAMP, 'off');
  await page.goto('/houseplan');
  const host = card(page);
  await expectPlanDrawn(page, host);
  const pool = (entity) => host.locator(hp('glow-pool', { entity }));
  await expect(pool(LAMP)).toHaveCount(0);
  await evidence(testInfo, page, 'light-off');

  await callService('light', 'turn_on', { entity_id: LAMP });
  await waitForState(LAMP, 'on');
  await expect(deviceMarker(host, LAMP)).toHaveAttribute('data-state', 'working');
  await expect(host.locator(hp('glow-layer')).first()).toBeAttached();
  await expect(pool(LAMP).first()).toBeAttached();
  // only the lamp that is on is a source: the hallway stays dark
  await expect(pool(HALL)).toHaveCount(0);
  await settle(host);
  await evidence(testInfo, page, 'light-on');

  // a second source in another room adds its own pool
  await callService('light', 'turn_on', { entity_id: HALL });
  await waitForState(HALL, 'on');
  await expect(pool(HALL).first()).toBeAttached();
  await expect(pool(LAMP).first()).toBeAttached();

  // off: the pools fade out and leave the DOM (the existing fade is waited out)
  await callService('light', 'turn_off', { entity_id: [LAMP, HALL] });
  await waitForState(LAMP, 'off');
  await expect(pool(LAMP)).toHaveCount(0, { timeout: 15_000 });
  await expect(pool(HALL)).toHaveCount(0, { timeout: 15_000 });
  await settle(host);
  await evidence(testInfo, page, 'light-off-again');
});
