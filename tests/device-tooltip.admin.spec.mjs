// houseplan-e2e#50 / houseplan-card#1409: actual HA state stream and containers.
import {test,expect} from '@playwright/test';
import {requireHooks} from './lib/contract.mjs';
import {card,evidence,expectPlanDrawn} from './lib/ha-page.mjs';
import {openPlan,enterEditor,leaveEditor,selectSpace,spaceTab} from './lib/plan.mjs';
import {headerActionTarget} from './lib/header-actions.mjs';
import {restoreSeedAfterEach} from './lib/seed-guard.mjs';
import {wsCall} from './lib/ha-ws.mjs';
import {callService,getState,waitForState} from './lib/ha-api.mjs';
import {HP} from './lib/hooks.mjs';
import {A,B,ENTITY,NAMES,marker,tooltip,installTooltipFixture,placeMarkers,observeMotion,
 point,move,outside,shown,painted,openTip,readTip,sameAnchor} from './lib/device-tooltip-50.mjs';

requireHooks(test,'live-tooltip','device','mode-tab','editor-close','space-tab');
restoreSeedAfterEach(test);
let dashboardId,initialLight;
test.beforeAll(async()=>{
 const dashboard=await wsCall({type:'lovelace/dashboards/create',url_path:'tooltip-50',title:'Tooltip 50',
  show_in_sidebar:false,require_admin:false});dashboardId=dashboard.id;
 const config={views:[{title:'Masonry',path:'masonry',type:'masonry',cards:[
  {type:'custom:houseplan-card',title:'Tooltip 50 masonry',height:620,language:'en',space:'f1'}]}]};
 await wsCall({type:'lovelace/config/save',url_path:'tooltip-50',config});
 expect((await wsCall({type:'lovelace/config',url_path:'tooltip-50'})).views[0].type).toBe('masonry');
});
test.afterAll(async()=>{if(dashboardId)await wsCall({type:'lovelace/dashboards/delete',dashboard_id:dashboardId});});
test.beforeEach(async({page})=>{
 initialLight=(await getState(ENTITY)).state;
 await callService('light','turn_on',{entity_id:ENTITY});await waitForState(ENTITY,'on');
 await installTooltipFixture();await observeMotion(page);
 await page.setViewportSize({width:1800,height:1000});
});
test.afterEach(async()=>{if(['on','off'].includes(initialLight))await callService('light','turn_'+initialLight,{entity_id:ENTITY});});

for(const surface of ['panel','masonry'])test(`device tooltip holds its anchor through real HA updates in ${surface}`,async({page},testInfo)=>{
 let host;
 if(surface==='panel')host=await openPlan(page,{space:'f1'});
 else{await page.goto('/tooltip-50/masonry');host=card(page);await expectPlanDrawn(page,host);}
 const opened=await openTip(page,host),p=await point(host);
 await page.mouse.move(p.x+3,p.y+2);
 expect(sameAnchor(opened,await readTip(host))).toBe(true);
 for(let i=0;i<5;i++){await page.waitForTimeout(70);const s=await readTip(host);
  expect(s.active).toBe(true);expect(sameAnchor(opened,s)).toBe(true);expect(s.motionCount).toBe(opened.motionCount);}
 for(const state of ['off','on','off']){
  await callService('light','turn_'+state,{entity_id:ENTITY});await waitForState(ENTITY,state);
  if(state==='off')await expect(tooltip(host)).toContainText(/Off/i);
  else await expect(tooltip(host)).not.toContainText(/Off/i);
  const s=await readTip(host);expect(s.active).toBe(true);expect(sameAnchor(opened,s)).toBe(true);
  expect(s.motionCount).toBe(opened.motionCount);
 }
 await evidence(testInfo,page,'live-ha-tooltip-'+surface,{keepPointer:true});
 await outside(page,host);
 // Keyboard activation and the actual HA service effect remain the ordinary path.
 await page.keyboard.press('Tab');await marker(host).focus();await shown(host);
 await marker(host).evaluate(el=>el.blur());await outside(page,host);
 await marker(host).click();await waitForState(ENTITY,'on');
 await evidence(testInfo,page,'ordinary-click-'+surface);
 await outside(page,host);await move(page,await point(host));
 await host.evaluate(el=>{const parent=el.parentNode,next=el.nextSibling;el.remove();parent.insertBefore(el,next);});
 await page.waitForTimeout(260);
 await testInfo.attach('remount-observation',{body:JSON.stringify(await readTip(host),null,2),contentType:'application/json'});
 await expect(tooltip(host)).toBeHidden();await expectPlanDrawn(page,host);
 await openTip(page,host);await expect(tooltip(host)).toBeVisible();
 await testInfo.attach('tooltip-evidence',{body:JSON.stringify({surface,opened},null,2),contentType:'application/json'});
});

test('device tooltip dwell and motion retire neighbouring visits, resize and reduced motion',async({page},testInfo)=>{
 let host=await openPlan(page,{space:'f1'});const a=await point(host),b=await point(host,B);
 await outside(page,host);const before=await readTip(host);
 await move(page,a);await page.waitForTimeout(45);expect((await readTip(host)).active).toBe(false);
 await move(page,{x:3,y:3});await page.waitForTimeout(230);
 expect((await readTip(host)).motionCount).toBe(before.motionCount);await expect(tooltip(host)).toBeHidden();
 const start=await page.evaluate(()=>performance.now());await move(page,a);await shown(host);
 const entering=await readTip(host);expect(entering.motions.at(-1).at-start).toBeGreaterThanOrEqual(100);
 expect(entering.running.some(m=>m.duration===180&&m.frames[0].opacity===0&&m.frames.at(-1).opacity===1)).toBe(true);
 await painted(host);await page.mouse.move(3,3);const leaving=await readTip(host);
 expect(leaving.hidden).toBe(false);expect(leaving.running.some(m=>m.duration===140&&m.frames.at(-1).opacity===0)).toBe(true);
 await expect(tooltip(host)).toBeHidden();
 await move(page,a);await page.waitForTimeout(70);await move(page,b);await page.waitForTimeout(80);
 expect((await readTip(host)).active).toBe(false);await shown(host,B);await painted(host);
 await move(page,a);await shown(host);await painted(host);await page.waitForTimeout(230);
 await expect(tooltip(host).locator('b').first()).toHaveText(NAMES[A]);
 await outside(page,host);await placeMarkers({[A]:{s:'f1',x:.93,y:.84}});
 await page.reload();host=card(page);await expectPlanDrawn(page,host);const edge=await openTip(page,host);
 expect(edge.x).toBeGreaterThanOrEqual(7);expect(edge.y).toBeGreaterThanOrEqual(7);
 expect(edge.right).toBeLessThanOrEqual(edge.width-7);expect(edge.bottom).toBeLessThanOrEqual(edge.height-7);
 await page.setViewportSize({width:1790,height:1000});await page.waitForTimeout(150);
 const resized=await readTip(host);
 if(resized.active){expect(resized.right).toBeLessThanOrEqual(resized.width-7);expect(resized.motionCount).toBe(edge.motionCount);}
 else await expect(tooltip(host)).toBeHidden(); // a real relocation can move the target out from under the pointer
 await outside(page,host);await page.emulateMedia({reducedMotion:'reduce'});
 const reduced=await openTip(page,host);expect(reduced.opacity).toBe(1);expect(reduced.running).toEqual([]);
 await page.mouse.move(3,3);await expect(tooltip(host)).toBeHidden();
 await evidence(testInfo,page,'tooltip-at-edge');
 await testInfo.attach('tooltip-motion',{body:JSON.stringify({entering,leaving,edge,resized,reduced},null,2),contentType:'application/json'});
});

test('device tooltip cancels pending and visible visits across mode, space, page hiding and remount',async({page},testInfo)=>{
 let host=await openPlan(page,{space:'f1'});
 for(const visible of [false,true]){
  const control=await headerActionTarget(host,HP.modeTab('devices'));await control.focus();
  await outside(page,host);await move(page,await point(host));
  if(visible)await shown(host);else await page.waitForTimeout(45);
  await page.keyboard.press('Enter');await expect(host.locator(HP.mode('devices'))).toBeVisible();
  await page.waitForTimeout(230);await expect(tooltip(host)).toBeHidden();await leaveEditor(host);
  await outside(page,host);await spaceTab(host,'f2').focus();await move(page,await point(host));
  if(visible)await shown(host);else await page.waitForTimeout(45);
  await page.keyboard.press('Enter');await expect(spaceTab(host,'f2')).toHaveAttribute('aria-current','page');
  await page.waitForTimeout(230);await expect(tooltip(host)).toBeHidden();await selectSpace(host,'f1');
  await outside(page,host);await move(page,await point(host));
  if(visible)await shown(host);else await page.waitForTimeout(45);
  // Real HA navigation retires the document, its card and its pending hover.
  await page.goto('/config/dashboard');await expect(page.locator('houseplan-card')).toHaveCount(0);
  await page.mouse.move(3,3);host=await openPlan(page,{space:'f1'});
  await page.waitForTimeout(230);await expect(tooltip(host)).toBeHidden();
  await move(page,await point(host));if(visible)await shown(host);else await page.waitForTimeout(45);
  await host.evaluate(el=>{const parent=el.parentNode,next=el.nextSibling;el.remove();parent.insertBefore(el,next);});
  await page.waitForTimeout(260);await expect(tooltip(host)).toBeHidden();await expectPlanDrawn(page,host);
 }
 await evidence(testInfo,page,'lifecycle-cleared');
});
