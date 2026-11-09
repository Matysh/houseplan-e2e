// Real HA regression for Houseplan #1354/#1356: native pane scrolling and selection.
import {test,expect} from '@playwright/test';
import {requireHooks} from './lib/contract.mjs';
import {evidence} from './lib/ha-page.mjs';
import {HP,hp} from './lib/hooks.mjs';
import {openPlan,enterEditor,zoomInVisible,field} from './lib/plan.mjs';
import {planConfig,planLayout} from './lib/ha-ws.mjs';
import {restoreSeedAfterEach} from './lib/seed-guard.mjs';
requireHooks(test,'device','dialog','field');restoreSeedAfterEach(test);

test('device settings keep navigation and draft while native pane scroll and dropdowns remain usable',async({page},info)=>{
 test.setTimeout(240000);
 await page.setViewportSize({width:1800,height:1000});
 const host=await openPlan(page,{space:'f1'});await enterEditor(host,'devices');await zoomInVisible(host);
 const before=await planConfig(),layout=await planLayout();
 await host.locator(hp('device',{id:'lg_sensor.ground_floor_temperature'})).first().dblclick();
 const dialog=host.locator(HP.dialog('marker')).first();await expect(dialog).toBeVisible();
 await field(dialog,'marker-name').fill('Scroll E2E draft');
 const pane=dialog.locator('.hpf-settings-content');
 const section=async id=>{
  const mobile=dialog.locator('.hpf-settings-mobile hp-settings-select');
  if(await mobile.isVisible()){
   const label=await mobile.locator('option[value="'+id+'"]').textContent();
   await mobile.locator('button').click();await mobile.getByRole('option',{name:label.trim(),exact:true}).click();
  }else await dialog.locator('[data-section-target="'+id+'"]').click();
 };
 for(const viewport of [{width:1280,height:900},{width:1000,height:380},{width:390,height:700}]){
  await page.setViewportSize(viewport);await section('appearance');
  const anchor=viewport.width<=550?dialog.locator('.hpf-settings-mobile'):dialog.locator('.hpf-settings-nav button').first();
  await pane.hover({position:{x:6,y:35}});await page.mouse.wheel(0,-5000);
  await expect.poll(()=>pane.evaluate(el=>el.scrollTop)).toBe(0);
  const navigationBefore=await anchor.boundingBox(),footerBefore=await dialog.locator('.hpf-footer').boundingBox();
  await page.mouse.wheel(0,900);await expect.poll(()=>pane.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  const navigationAfter=await anchor.boundingBox(),footerAfter=await dialog.locator('.hpf-footer').boundingBox();
  expect(Math.abs(navigationAfter.y-navigationBefore.y)).toBeLessThan(.5);
  expect(Math.abs(footerAfter.y-footerBefore.y)).toBeLessThan(.5);
  // Native click reveals a trigger above the scrolled pane. Its queued scroll
  // must not dismiss the newly opened menu before the option can be chosen.
  const enhanced=dialog.locator('.hpf-settings-pane:not([hidden]) hp-settings-select').filter({has:page.locator('select:not(:disabled)')}).first();
  const choice=await enhanced.locator('select').evaluate(el=>({value:el.value,label:el.selectedOptions[0].label}));
  await enhanced.locator('button').click();
  await enhanced.getByRole('option',{name:choice.label,exact:true}).click();
  await expect(enhanced.locator('select')).toHaveValue(choice.value);
  await section('basics');await expect(field(dialog,'marker-name')).toHaveValue('Scroll E2E draft');
  // #1354: review a genuine invalid draft from another, scrolled section.
  // The footer must reveal the actual field through the new scroll owner.
  await dialog.locator(HP.field('bmode','virtual')).check();
  await field(dialog,'marker-name').fill('');
  await expect(field(dialog,'marker-name')).toHaveAttribute('aria-invalid','true');
  await expect(dialog.locator(HP.dialogConfirm).first()).toBeDisabled();
  await section('appearance');
  await pane.hover({position:{x:6,y:35}});await page.mouse.wheel(0,900);
  await expect.poll(()=>pane.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  await expect(field(dialog,'marker-name')).toBeHidden();
  await dialog.locator(HP.action('review-fields')).click();
  await expect(field(dialog,'marker-name')).toBeVisible();
  await expect(field(dialog,'marker-name')).toBeFocused();
  const invalidBox=await field(dialog,'marker-name').boundingBox(),paneBox=await pane.boundingBox();
  expect(invalidBox.y).toBeGreaterThanOrEqual(paneBox.y);
  expect(invalidBox.y+invalidBox.height).toBeLessThanOrEqual(paneBox.y+paneBox.height);
  await field(dialog,'marker-name').fill('Scroll E2E draft');
  await evidence(info,page,'device-scroll-'+viewport.width);
 }
 expect((await planConfig()).config).toEqual(before.config);expect((await planLayout()).layout).toEqual(layout.layout);
 await dialog.locator(HP.dialogCancel).first().click();
 const confirm=host.locator(HP.dialog('confirm')).first();await expect(confirm).toBeVisible();
 await confirm.locator(HP.dialogCancel).first().click();await expect(confirm).toHaveCount(0);
 await expect(field(dialog,'marker-name')).toHaveValue('Scroll E2E draft');
 await dialog.locator(HP.dialogCancel).first().click();await expect(confirm).toBeVisible();
 await confirm.locator(HP.dialogConfirm).first().click();await expect(dialog).toHaveCount(0);
 expect((await planConfig()).config).toEqual(before.config);
});
