import {test,expect} from '@playwright/test';
import {requireHooks} from './lib/contract.mjs';
import {expectPlanDrawn,evidence} from './lib/ha-page.mjs';
import {expectNativeDrawerEntry} from './lib/panel-shell.mjs';
import {enterEditor} from './lib/plan.mjs';
requireHooks(test,'panel-menu@aria-expanded','header-actions-menu','header-actions-trigger','stage');
const panelHost=page=>page.locator('houseplan-panel houseplan-card');
async function open(page,width=390){await page.setViewportSize({width,height:1000});await page.goto('/houseplan');const host=panelHost(page);await expectPlanDrawn(page,host);return host;}

test('#1371 native HA sidebar icon follows scrim and Escape without a second toggle state',async({page},info)=>{
 const host=await open(page),button=host.locator('[data-hp="panel-menu"]'),drawer=page.locator('home-assistant-main ha-drawer');
 await expect(button).toBeVisible();await expect(button).toHaveAttribute('aria-expanded','false');
 await button.click();await expectNativeDrawerEntry(page);await expect(drawer).toHaveAttribute('open','');await expect(button).toHaveAttribute('aria-expanded','true');
 await page.mouse.click(388,900);await expect(drawer).not.toHaveAttribute('open','');await expect(button).toHaveAttribute('aria-expanded','false');
 await button.click();await expectNativeDrawerEntry(page);await expect(button).toHaveAttribute('aria-expanded','true');
 await page.keyboard.press('Escape');await expect(drawer).not.toHaveAttribute('open','');await expect(button).toHaveAttribute('aria-expanded','false');
 await button.click();await expectNativeDrawerEntry(page);
 const settings=page.locator('ha-sidebar').getByRole('link',{name:/Settings/});await settings.scrollIntoViewIfNeeded();await settings.click();
 await expect(page).toHaveURL(/\/config(?:\/|$)/);await expect(drawer).not.toHaveAttribute('open','');
 await page.goBack();await expectPlanDrawn(page,host);await expect(button).toHaveAttribute('aria-expanded','false');
 await button.hover();await expect(button).toHaveAttribute('aria-expanded','false');
 await evidence(info,page,'sidebar-native-closed');
 await page.goto('/house-plan');const card=page.locator('houseplan-card').first();await expectPlanDrawn(page,card);await expect(card.locator('[data-hp="panel-menu"]')).toHaveCount(0);
});

test('#1371 real HA keeps two ordinary rows and a bounded disclosure with stacked editor controls',async({page},info)=>{
 test.setTimeout(180000);const host=await open(page,1440),rows=[];
 for(const width of [1800,1440,1100,900,800,700,600,500,390,700,1100,1800]){
  await page.setViewportSize({width,height:1000});await expect.poll(async()=>host.locator('.head').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await page.waitForTimeout(100);
  rows.push(await host.locator('.head').evaluate(el=>{const ys=[...el.querySelectorAll('button,hp-settings-select,[data-hp="space-name"]')].map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height).map(r=>r.y+r.height/2);const centers=[];for(const y of ys)if(!centers.some(c=>Math.abs(c-y)<8))centers.push(y);return {rows:centers.length,compact:!!el.querySelector('[data-hp="header-actions-trigger"]')?.getClientRects().length};}));
 }
 expect(rows.some(r=>r.rows===2&&!r.compact)).toBe(true);expect(rows.every(r=>r.rows<=2)).toBe(true);expect(rows.some(r=>r.compact&&r.rows===1)).toBe(true);
 await page.setViewportSize({width:390,height:1000});const trigger=host.locator('[data-hp="header-actions-trigger"]');await trigger.click();const menu=host.locator('[data-hp="header-actions-menu"]:not([inert])');await expect(menu).toBeVisible();
 const box=await menu.boundingBox(),head=await host.locator('.head').boundingBox(),field=await host.boundingBox();expect(Math.abs(box.y-head.y-head.height)).toBeLessThan(1);expect(Math.abs(box.x-field.x)).toBeLessThan(1);expect(Math.abs(box.width-field.width)).toBeLessThan(1);expect(box.y+box.height).toBeLessThan(field.y+field.height-10);
 for(const action of ['zoom-in','zoom-fit','zoom-out','panel-menu'])await expect(menu.locator('[data-action="'+action+'"]')).toHaveCount(0);
 await page.keyboard.press('Escape');
 for(const mode of ['plan','devices','decor']){
  await page.setViewportSize({width:1800,height:1000});await enterEditor(host,mode);const end=host.locator('.editbar-end');await expect(end).toBeVisible();const disabled=await end.locator(':scope > .btn').evaluateAll(items=>items.map(b=>({hp:b.dataset.hp,disabled:b.disabled})));
  await page.setViewportSize({width:390,height:1000});await expect(trigger).toBeVisible();
  await expect.poll(async()=>end.locator(':scope > .btn').evaluateAll(items=>{const b=items.map(e=>e.getBoundingClientRect()).sort((a,b)=>a.y-b.y);return b.length===3&&b.every(r=>Math.abs(r.width-40)<.01&&Math.abs(r.height-40)<.01&&Math.abs(r.x-b[0].x)<.01)&&Math.abs(b[1].y-b[0].y-44)<.01&&Math.abs(b[2].y-b[1].y-44)<.01;})).toBe(true);
  expect(await end.locator(':scope > .btn').evaluateAll(items=>items.map(b=>({hp:b.dataset.hp,disabled:b.disabled})))).toEqual(disabled);
  await end.locator('.barclose').click();await expect(end).toBeHidden();
 }
 await evidence(info,page,'editor-column-and-menu');
});

test('#1371 native scene pan survives double click in real HA',async({page},info)=>{
 test.setTimeout(120000);const host=await open(page);await page.evaluate(()=>{window.__nativeDrag1371=[];for(const name of ['dragstart','pointercancel'])document.addEventListener(name,e=>window.__nativeDrag1371.push(e.type),true);});
 const view=()=>host.locator('.stage > .zoomwrap > svg').first().getAttribute('viewBox');
 for(const width of [390,1440])for(const delay of [0,50,250,600]){
  await page.setViewportSize({width,height:1000});const box=await host.locator('[data-hp="stage"]').boundingBox(),x=box.x+box.width*.42,y=box.y+box.height*.8;
  await page.mouse.dblclick(x,y);if(delay)await page.waitForTimeout(delay);const before=await view();
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+65,y-35,{steps:6});await page.mouse.up();await expect.poll(view).not.toBe(before);
 }
 expect(await page.evaluate(()=>window.__nativeDrag1371)).toEqual([]);await evidence(info,page,'pan-after-double-click');
});
