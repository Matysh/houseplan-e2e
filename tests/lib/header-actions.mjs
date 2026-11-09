import { expect } from '@playwright/test';
import { hp } from './hooks.mjs';
import { hasHeaderActionsContract, hasSingleRowHeaderContract } from './panel-release-contract.mjs';

/** #1364: measure the actual narrow header on real HA, without product fields. */
export async function expectSingleRowHeader(host) {
  const trigger = host.locator(hp('header-actions-trigger'));
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-label', /\S/);
  const label = host.locator(hp('space-name'));
  const picker = host.locator(hp('space-select'));
  await expect.poll(async () => Number(await label.isVisible()) + Number(await picker.isVisible())).toBe(1);
  const space = await label.isVisible() ? label : picker;
  if (await label.isVisible()) {
    await expect(label).toHaveText(/\S/);
    await expect(picker).toHaveCount(0);
  } else expect(await picker.locator('option').count()).toBeGreaterThan(1);
  await expect.poll(async () => {
    const s = await space.boundingBox(), a = await trigger.boundingBox();
    return !!s && !!a && s.width > 0 && Math.abs(s.y-a.y) < 1
      && s.x+s.width <= a.x+1 && Math.abs(a.width-44) < .001 && Math.abs(a.height-44) < .001;
  }).toBe(true);
  expect(await host.locator('.hdr').evaluate(e => {
    const head = e.querySelector('.head'), box = head.getBoundingClientRect();
    const controls = [...head.querySelectorAll('button,hp-settings-select,[data-hp="space-name"]')]
      .map(node => node.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
    return head.scrollWidth <= box.width+1
      && controls.every(r => r.y >= box.y && r.bottom <= box.bottom && Math.abs(r.y-controls[0].y) < 1);
  })).toBe(true);
}

/** Follow the visible public route; keep original accessible command names. */
export async function headerActionTarget(host, selector, { tap = false } = {}) {
  const original = host.locator(selector).first();
  if (await original.isVisible()) return original;
  expect(hasHeaderActionsContract(), 'hidden header command requires the declared actions menu').toBe(true);
  const trigger = host.locator(hp('header-actions-trigger')).first();
  await expect(trigger).toBeVisible();
  const label = await original.getAttribute('aria-label');
  expect(label, 'source command has an accessible name').toBeTruthy();
  const sheet = host.locator(hp('header-actions-menu') + ':not([inert])');
  if (!await sheet.isVisible()) await (tap ? trigger.tap() : trigger.click());
  await expect(sheet).toBeVisible();
  if (hasSingleRowHeaderContract()) await expect.poll(async () => {
    const menu = await sheet.boundingBox(), head = await host.locator('.hdr>.head').boundingBox();
    return !!menu && !!head && menu.x >= head.x-1 && menu.x+menu.width <= head.x+head.width+1;
  }, {message:'header commands remain inside their field beside Properties'}).toBe(true);
  const target = sheet.getByRole('menuitem', { name: label, exact: true });
  await expect(target).toBeVisible();
  return target;
}
