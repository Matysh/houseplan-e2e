import { expect } from '@playwright/test';
import { hp } from './hooks.mjs';
import { hasHeaderActionsContract, hasNamedSpaceHeaderContract, hasHeaderPolishContract } from './panel-release-contract.mjs';

/** Measure the actual presentation, rather than choosing it from viewport width. */
export async function expectIntrinsicHeader(host) {
  const label = host.locator(hp('space-name')), picker = host.locator(hp('space-select'));
  await expect.poll(async () => Number(await label.isVisible()) + Number(await picker.isVisible())).toBe(1);
  const space = await label.isVisible() ? label : picker;
  if (await label.isVisible()) {
    await expect(label).toHaveText(/\S/);
    await expect(picker).toHaveCount(0);
  } else expect(await picker.locator('option').count()).toBeGreaterThan(1);
  let layout;
  await expect.poll(async () => {
    layout = await host.locator('.head').evaluate(head => {
      const box = head.getBoundingClientRect(), rows = [];
      const controls = [...head.querySelectorAll('button,hp-settings-select,[data-hp="space-name"]')]
        .map(node => node.getBoundingClientRect()).filter(r => r.width && r.height);
      for (const r of controls) { const y = r.y + r.height/2; if (!rows.some(v => Math.abs(v-y)<1)) rows.push(y); }
      return { rows:rows.length, compact:!!head.querySelector('[data-hp="header-actions-trigger"]')?.getClientRects().length,
        bounded:head.scrollWidth<=box.width+1 && controls.every(r=>r.x>=box.x-1 && r.right<=box.right+1 && r.y>=box.y-1 && r.bottom<=box.bottom+1) };
    });
    return layout.bounded && layout.rows>0 && layout.rows <= (layout.compact || !hasHeaderPolishContract() ? 1 : 2);
  }).toBe(true);
  if (layout.compact) {
    const trigger = host.locator(hp('header-actions-trigger'));
    await expect(trigger).toHaveAttribute('aria-label', /\S/);
    await expect.poll(async () => {
      const s=await space.boundingBox(), a=await trigger.boundingBox();
      return !!s && !!a && s.width>0 && Math.abs(s.y-a.y)<1 && s.x+s.width<=a.x+1
        && Math.abs(a.width-44)<.001 && Math.abs(a.height-44)<.001;
    }).toBe(true);
    const menu = host.locator(hp('panel-menu'));
    if (hasHeaderPolishContract() && await menu.isVisible()) await expect.poll(async()=>{
      const m=await menu.boundingBox(),s=await space.boundingBox();
      return !!m && !!s && Math.abs(m.width-44)<.001 && Math.abs(m.height-44)<.001 && m.x+m.width<=s.x+1;
    }).toBe(true);
  }
  return layout;
}

async function paintedTarget(target) {
  await expect(target).toBeVisible();
  await expect.poll(()=>target.evaluate(button=>{
    if(button.matches(':disabled,[aria-disabled="true"]'))return true;
    const r=button.getBoundingClientRect(),hit=button.getRootNode().elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return hit===button||button.contains(hit);
  }),{message:'header command is painted and receives native input'}).toBe(true);
  return target;
}

/** Follow a painted native route; never wait away unrelated in-flight motion. */
export async function headerActionTarget(host, selector, { tap = false } = {}) {
  const candidates=host.locator(selector), original=candidates.first();
  for (const candidate of await candidates.all()) if (await candidate.isVisible()) return paintedTarget(candidate);
  expect(hasHeaderActionsContract(), 'hidden header command requires the declared actions menu').toBe(true);
  const trigger=host.locator(hp('header-actions-trigger')).first();
  await expect(trigger).toBeVisible();
  const label=await original.getAttribute('aria-label');
  expect(label, 'source command has an accessible name').toBeTruthy();
  const sheet=host.locator(hp('header-actions-menu')+':not([inert])');
  if (!await sheet.isVisible()) await (tap ? trigger.tap() : trigger.click());
  await expect(sheet).toBeVisible();
  if (hasNamedSpaceHeaderContract()) await expect.poll(async()=>{
    const menu=await sheet.boundingBox(),head=await host.locator('.hdr>.head').boundingBox(),bounds=await (hasHeaderPolishContract()?host:host.locator('.hdr>.head')).boundingBox();
    if(!menu||!head||!bounds)return false;
    if(hasHeaderPolishContract())return Math.abs(menu.x-bounds.x)<=1 && Math.abs(menu.width-bounds.width)<=1
      && Math.abs(menu.y-head.y-head.height)<=1 && menu.height>0
      && menu.y+menu.height<=Math.min(bounds.y+bounds.height,host.page().viewportSize().height)+1;
    return menu.x>=head.x-1 && menu.x+menu.width<=head.x+head.width+1;
  },{message:'header disclosure remains bounded by its owning House Plan field'}).toBe(true);
  const target=sheet.getByRole('menuitem',{name:label,exact:true});
  return paintedTarget(target);
}
