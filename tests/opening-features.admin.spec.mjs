// #1024: actual HA writer, nested draft, reload and current entity state.
import {test,expect} from '@playwright/test';
import {requireHooks,installedContract,declaresValue} from './lib/contract.mjs';
import {HP,hp} from './lib/hooks.mjs';
import {openPlan,enterEditor,field,toClient} from './lib/plan.mjs';
import {planConfig,spaceOf,waitForConfig,wsCall} from './lib/ha-ws.mjs';
import {restoreSeedAfterEach} from './lib/seed-guard.mjs';
import {evidence} from './lib/ha-page.mjs';
import {accessToken,getState} from './lib/ha-api.mjs';
import {HA_URL} from '../scripts/users.mjs';

requireHooks(test,'opening','action','field','dialog','dialog-confirm');
test.skip(!!installedContract()&&!declaresValue(installedContract(),'action@data-action','opening-leaf-edit'),
  'Installed product predates #1024; this skip does not prove the new behavior');
restoreSeedAfterEach(test);

test('independent window leaves survive real HA Save/ACK/reload and follow their assigned source',async({page},testInfo)=>{
 test.setTimeout(180000);
 const initial=await planConfig();
 expect(initial.opening_features_api).toBe(1);
 const space=initial.config.spaces.find(s=>(s.openings||[]).some(o=>o.type==='window'));
 expect(space).toBeTruthy();
 const opening=space.openings.find(o=>o.type==='window');
 let host=await openPlan(page,{space:space.id});await enterEditor(host,'plan');
 const dialog=()=>host.locator(HP.dialog('opening'));
 const open=async()=>{const at=await toClient(host,opening.x*1000,opening.y*1000);
  await page.mouse.dblclick(at.x,at.y);await expect(dialog()).toBeVisible();};
 const choose=async(id,value)=>{
  const input=field(dialog(),id),label=await input.locator('option').evaluateAll((options,value)=>
    options.find(o=>o.value===value)?.textContent,value);
  expect(label,`option ${id}=${value}`).toBeTruthy();
  const select=dialog().locator('hp-settings-select').filter({has:input});
  await select.locator(hp('select-trigger')).click();
  await page.locator(hp('select-option',{id:value})).filter({visible:true}).click();
 };
 await open();
 expect(await dialog().locator(HP.action('opening-leaf-edit')).count()).toBe(2);
 await dialog().locator(HP.action('opening-leaf-edit')).first().click();
 await choose('opening-leaf-contact','');
 await choose('opening-leaf-hinge','top');await choose('opening-leaf-position','open');
 await field(dialog(),'opening-leaf-shade').click();await choose('opening-shade-position','closed');
 await dialog().locator(HP.dialogConfirm).click();
 expect((await planConfig()).rev).toBe(initial.rev,'nested Done is not persistence');
 await dialog().locator(HP.action('opening-leaf-edit')).last().click();
 const source=await field(dialog(),'opening-leaf-contact').locator('option').evaluateAll(options=>
  options.find(o=>o.value.startsWith('binary_sensor.'))?.value);
 expect(source).toBeTruthy();
 await choose('opening-leaf-contact',source);
 await expect(field(dialog(),'opening-leaf-position')).toBeDisabled();
 await dialog().locator(HP.dialogConfirm).click();
 await expect(dialog().locator(HP.action('opening-leaf-edit'))).toHaveCount(2);
 await dialog().locator(HP.dialogConfirm).click();
 await expect(dialog()).toBeHidden();
 const find=c=>spaceOf(c,space.id).openings.find(o=>o.id===opening.id);
 const saved=await waitForConfig(c=>find(c)?.opening_features?.leaves?.[0]?.hinge==='top');
 const expected=structuredClone(find(saved));
 expect(expected.opening_features.leaves[0]).toMatchObject({manual:'open',shade:{enabled:true,manual:'closed'}});
 expect(expected.opening_features.leaves[1].contact).toBe(source);
 expect(expected).not.toHaveProperty('contact');
 await evidence(testInfo,page,'independent-leaves-saved');
 await page.reload();host=await openPlan(page,{space:space.id});await enterEditor(host,'plan');await open();
 await dialog().locator(HP.action('opening-leaf-edit')).first().click();
 await expect(field(dialog(),'opening-leaf-hinge')).toHaveValue('top');
 await expect(field(dialog(),'opening-shade-position')).toHaveValue('closed');
 await dialog().locator(HP.dialogCancel).last().click();
 await expect(dialog().locator(HP.action('opening-leaf-edit'))).toHaveCount(2);
 await dialog().locator(HP.dialogCancel).last().click();
 // The old writer cannot remove/rewrite an extended opening, even with a current rev.
 const fresh=await planConfig(),old=structuredClone(fresh.config);
 delete find(old).opening_features;
 await expect(wsCall({type:'houseplan/config/set',config:old,expected_rev:fresh.rev})).rejects.toMatchObject({code:'opening_features_client_outdated'});
 expect(find((await planConfig()).config)).toEqual(expected);
 const original=await getState(source);
 const state=async(value)=>{
  const response=await fetch(`${HA_URL}/api/states/${source}`,{method:'POST',
   headers:{Authorization:`Bearer ${await accessToken('admin')}`,'Content-Type':'application/json'},
   body:JSON.stringify({state:value,attributes:original.attributes})});expect(response.ok).toBe(true);
 };
 try{
  await state('unavailable');await open();await dialog().locator(HP.action('opening-leaf-edit')).last().click();
  await expect(field(dialog(),'opening-leaf-position')).toHaveValue('unknown');
  await expect(field(dialog(),'opening-leaf-position')).toBeDisabled();
  await evidence(testInfo,page,'assigned-source-unavailable');
  const rev=(await planConfig()).rev;
  await state('on');await expect(field(dialog(),'opening-leaf-position')).not.toHaveValue('unknown');
  expect((await planConfig()).rev).toBe(rev,'live entity updates do not write config');
  expect(find((await planConfig()).config)).toEqual(expected);
 }finally{await state(original.state);}
 await dialog().locator(HP.dialogCancel).last().click();
 await expect(dialog().locator(HP.action('opening-leaf-edit'))).toHaveCount(2);
 await dialog().locator(HP.dialogCancel).last().click();
 const door=spaceOf((await planConfig()).config,space.id).openings.find(o=>o.type==='door');
 expect(door,'the real seed also has a door').toBeTruthy();
 const at=await toClient(host,door.x*1000,door.y*1000);await page.mouse.dblclick(at.x,at.y);
 await expect(dialog()).toBeVisible();
 await dialog().locator(HP.action('opening-entity-open')).first().click();
 await dialog().locator(hp('field-option',{field:'opening-contact-entity',value:''})).click();
 await choose('opening-mechanism','slide');await choose('opening-position','closed');
 await dialog().locator(HP.dialogConfirm).click();await expect(dialog()).toBeHidden();
 const doorOf=c=>spaceOf(c,space.id).openings.find(o=>o.id===door.id);
 await waitForConfig(c=>doorOf(c)?.opening_features?.mechanism==='slide');
 const savedDoor=doorOf((await planConfig()).config);
 expect(savedDoor.lock).toEqual(door.lock);
 expect(savedDoor).toMatchObject({opening_features:{version:1,mechanism:'slide',manual:'closed'}});
 await page.reload();host=await openPlan(page,{space:space.id});await enterEditor(host,'plan');
 const afterReload=await toClient(host,door.x*1000,door.y*1000);await page.mouse.dblclick(afterReload.x,afterReload.y);
 await expect(field(dialog(),'opening-mechanism')).toHaveValue('slide');
 await expect(field(dialog(),'opening-position')).toHaveValue('closed');
 await evidence(testInfo,page,'sliding-manual-door-after-reload');
});
