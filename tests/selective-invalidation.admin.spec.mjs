// #1093: real HA persistence seams. Product performance/counter budgets stay
// in houseplan-card; these journeys assert native behavior and server truth.
import {test,expect} from '@playwright/test';
import {requireHooks} from './lib/contract.mjs';
import {HP,hp} from './lib/hooks.mjs';
import {card,evidence,expectPlanDrawn,deviceMarker} from './lib/ha-page.mjs';
import {openPlan,field,enterEditor,leaveEditor,selectSpace,centreOf,dragClient,toFloor,toClient,snap,settle,zoomInVisible} from './lib/plan.mjs';
import {planConfig,planLayout,spaceOf,waitForConfig,waitForLayout} from './lib/ha-ws.mjs';
import {callService,getState,waitForState} from './lib/ha-api.mjs';
import {restoreSeedAfterEach} from './lib/seed-guard.mjs';
import {holdConfigReply} from './lib/held-config-reply.mjs';

requireHooks(test,'field','mode-tab','action','toast@data-id','device-copy','device-history','stage@data-grid-step','space-select-value');
restoreSeedAfterEach(test);
const FLOOR='f1',OTHER='f2',SOURCE='lg_sensor.ground_floor_temperature',LAMP='light.wall_lamp_1';
const marker=(host,id)=>host.locator(hp('device',{id})).first();
const inConfig=(config,id)=>config.markers.find(m=>m.id===id);
const pair=async()=>{const [config,layout]=await Promise.all([planConfig(),planLayout()]);return {config:config.config,layout:layout.layout};};
async function openSpace(page){const host=await openPlan(page,{space:FLOOR});await host.locator(hp('space-settings',{id:FLOOR})).first().click();const dialog=host.locator(HP.dialog('space')).first();await expect(dialog).toBeVisible();return {host,dialog};}
async function assertPair(id,expectedMarker,expectedPosition){
 await expect.poll(async()=>{const stored=await pair();return {marker:inConfig(stored.config,id)||null,position:stored.layout[id]||null};},{message:'coherent stored marker and layout after native history'}).toEqual({marker:expectedMarker||null,position:expectedPosition||null});
}
async function closeDraft(page,host,dialog){
 await page.keyboard.press('Escape');const confirm=host.locator(HP.dialog('confirm')).first();
 if(await confirm.isVisible())await confirm.locator(HP.dialogConfirm).first().click();
 await expect(dialog).toBeHidden();
}

test('Save remains pending until its real HA ACK, then closes and survives reload',async({page},testInfo)=>{
 const hold=await holdConfigReply(page),{host,dialog}=await openSpace(page);
 const title=spaceOf((await planConfig()).config,FLOOR).title+' ACK1093';
 await field(dialog,'space-title').fill(title);const reached=hold.arm();await dialog.locator(HP.dialogConfirm).first().click();
 const receipt=await reached;expect(receipt.reply.success).toBe(true);
 await waitForConfig(c=>spaceOf(c,FLOOR).title===title,{message:'real HA persisted before browser receives ACK'});
 await expect(dialog).toBeVisible();await expect(dialog.locator(HP.dialogConfirm).first()).toBeDisabled();
 await expect(host.locator(hp('toast',{id:'toast.space_saved'}))).toHaveCount(0);
 await evidence(testInfo,page,'save-real-ack-held');hold.release();
 await expect(dialog).toBeHidden();await expect(host.locator(hp('toast',{id:'toast.space_saved'}))).toBeVisible();
 expect(hold.writes.filter(w=>w.type==='houseplan/config/set')).toHaveLength(1);
 await page.reload();const fresh=card(page);await expectPlanDrawn(page,fresh);
 await fresh.locator(hp('space-settings',{id:FLOOR})).first().click();
 await expect(field(fresh.locator(HP.dialog('space')).first(),'space-title')).toHaveValue(title);
 await evidence(testInfo,page,'save-real-ack-reloaded');
});

test('a confirmed Save refusal leaves server truth intact and does not poison subsequent Copy and history',async({page},testInfo)=>{
 test.setTimeout(120_000);
 // Establish the desktop premise before the entire refusal -> Copy -> history
 // sequence; never resize/reload/reset the queue between these operations.
 await page.setViewportSize({width:1800,height:1000});
 const hold=await holdConfigReply(page),{host,dialog}=await openSpace(page),before=await pair();
 const originalTitle=spaceOf(before.config,FLOOR).title;
 await field(dialog,'space-title').fill(originalTitle+' refused1093');const reached=hold.arm({staleRevision:true});
 await dialog.locator(HP.dialogConfirm).first().click();const receipt=await reached;
 expect(receipt.reply).toEqual({success:false,errorCode:'conflict'});
 expect(spaceOf((await planConfig()).config,FLOOR).title).toBe(originalTitle);
 await expect(dialog).toBeVisible();await expect(dialog.locator(HP.dialogConfirm).first()).toBeDisabled();
 hold.release();await expect(dialog.locator(HP.dialogConfirm).first()).toBeEnabled();
 await expect(host.locator(hp('toast',{id:'toast.error'}))).toBeVisible();
 await expect(host.locator(hp('toast',{id:'toast.space_saved'}))).toHaveCount(0);
 await evidence(testInfo,page,'save-real-refusal');await closeDraft(page,host,dialog);

 // The next independent native intent follows the rejected write without
 // resetting a queue, reloading the page, or issuing a successful Save first.
 await enterEditor(host,'devices');
 const magnets=host.locator(HP.tool('device-magnets')).first();if(await magnets.getAttribute('aria-pressed')==='true' && await magnets.isEnabled())await magnets.click();
 await zoomInVisible(host);await settle(host);
 const point=await centreOf(marker(host,SOURCE));await page.mouse.click(point.x,point.y,{button:'right'});
 await host.locator(hp('device-copy')).first().click();
 const copied=await waitForConfig(c=>c.markers.length===before.config.markers.length+1,{message:'fresh Copy works after refused Save'});
 const copy=copied.markers.find(m=>!before.config.markers.some(old=>old.id===m.id));expect(copy).toBeTruthy();expect(copy.binding).toBe('virtual');
 const copyPosition=(await waitForLayout(l=>!!l[copy.id]))[copy.id];await expect(marker(host,copy.id)).toBeVisible();
 await evidence(testInfo,page,'copy-after-refused-save');
 const from=await centreOf(marker(host,copy.id)),floor=await toFloor(host,from.x,from.y),target=await snap(host,floor.x+60,floor.y+40);
 await dragClient(page,from,await toClient(host,target.x,target.y));
 const moved=(await waitForLayout(l=>l[copy.id]&&Math.abs(l[copy.id].x-copyPosition.x)+Math.abs(l[copy.id].y-copyPosition.y)>.001,{message:'native copied-marker move persisted'}))[copy.id];
 const movedPoint=await centreOf(marker(host,copy.id));await page.mouse.dblclick(movedPoint.x,movedPoint.y);
 const markerDialog=host.locator(HP.dialog('marker')).first();await expect(markerDialog).toBeVisible();
 await markerDialog.locator(HP.action('marker-delete')).first().click();
 const confirmation=host.locator(HP.dialog('confirm')).first();await expect(confirmation).toBeVisible();await confirmation.locator(HP.dialogConfirm).first().click();
 await assertPair(copy.id,null,null);
 const history=async action=>{const button=host.locator(hp('device-history',{action})).first();await expect(button).toBeEnabled();await button.click();};
 await history('undo');await assertPair(copy.id,copy,moved);
 await history('undo');await assertPair(copy.id,copy,copyPosition);
 await history('undo');await assertPair(copy.id,null,null);
 await history('redo');await assertPair(copy.id,copy,copyPosition);
 await history('redo');await assertPair(copy.id,copy,moved);
 await history('redo');await assertPair(copy.id,null,null);
 expect(inConfig((await planConfig()).config,SOURCE)).toEqual(inConfig(before.config,SOURCE));
 expect(spaceOf((await planConfig()).config,FLOOR).title).toBe(originalTitle);
 await evidence(testInfo,page,'copy-move-delete-history-replayed');
 await leaveEditor(host);await page.reload();await expectPlanDrawn(page,card(page));await expect(marker(card(page),copy.id)).toHaveCount(0);
 await assertPair(copy.id,null,null);await evidence(testInfo,page,'history-final-reloaded');
});

test('an HA update on an inactive floor is current when that floor is shown',async({page},testInfo)=>{
 const original=await getState(LAMP);
 try {
  await callService('light','turn_off',{entity_id:LAMP});await waitForState(LAMP,'off');
  const host=await openPlan(page,{space:FLOOR});await expect(deviceMarker(host,LAMP)).toHaveAttribute('data-state','neutral');
  await selectSpace(host,OTHER);await expect(deviceMarker(host,LAMP)).toHaveCount(0);
  await callService('light','turn_on',{entity_id:LAMP});await waitForState(LAMP,'on');
  await expect(deviceMarker(host,LAMP)).toHaveCount(0);await evidence(testInfo,page,'inactive-floor-source-updated');
  await selectSpace(host,FLOOR);await expect(deviceMarker(host,LAMP)).toHaveAttribute('data-state','working');
  await evidence(testInfo,page,'inactive-floor-shown-latest');
  await page.reload();await expectPlanDrawn(page,card(page));await selectSpace(card(page),FLOOR);await expect(deviceMarker(card(page),LAMP)).toHaveAttribute('data-state','working');
 } finally {await callService('light',original.state==='on'?'turn_on':'turn_off',{entity_id:LAMP});await waitForState(LAMP,original.state);}
});
