import { expect } from '@playwright/test';
import { hp } from './hooks.mjs';
import { hasHeaderActionsContract } from './panel-release-contract.mjs';

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
  const target = sheet.getByRole('menuitem', { name: label, exact: true });
  await expect(target).toBeVisible();
  return target;
}
