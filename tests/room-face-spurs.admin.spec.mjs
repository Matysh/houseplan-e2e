// #1346: real HA import is fixture setup; room creation/Cancel/history use native UI.
import {readFileSync} from 'node:fs';
import {test,expect} from '@playwright/test';
import {requireHooks} from './lib/contract.mjs';
import {HP,hp} from './lib/hooks.mjs';
import {card,evidence} from './lib/ha-page.mjs';
import {snapshotPlan,importDocument,planConfig,spaceOf,waitForConfig} from './lib/ha-ws.mjs';
import {restoreSeedAfterEach} from './lib/seed-guard.mjs';
import {openPlan,enterEditor,leaveEditor,useTool,clickFloor,toClient,settle,field} from './lib/plan.mjs';
const fixture=JSON.parse(readFileSync(new URL('../fixtures/backups/1346-room-face-spurs-current.json',import.meta.url),'utf8'));
requireHooks(test,'mode-tab','stage','dialog','field','action','room-label');
restoreSeedAfterEach(test);
async function prepare(page,config){
 const seed=await snapshotPlan(),document=structuredClone(seed.document),id=config.spaces[0].id;
 document.model_version=config.model_version;document.payload.config=structuredClone(config);
 document.payload.config.settings=structuredClone(seed.config.settings);document.payload.layout={};
 // The synthetic fixture has no placed markers or content references.
 document.placement_manifest=[];document.content_manifest=[];
 await importDocument(document,{confirmMissingContent:true});
 await waitForConfig(c=>!!spaceOf(c,id),{message:'synthetic current-model fixture stored by HA'});
 const host=await openPlan(page,{space:id});await enterEditor(host,'plan');await useTool(host,'select');await settle(host);
 return{host,id};
}
const geometry=s=>({nodes:s.plan_graph.nodes,edges:s.plan_graph.edges.map(e=>({id:e.id,from:e.from,to:e.to,cm:e.cm})),partitions:s.partitions,openings:s.openings});
test('a closed contour with a dangling wall creates one room without changing the wall or opening',async({page},info)=>{
 test.setTimeout(180000);const{host,id}=await prepare(page,fixture.closed);
 const before=await planConfig(),original=spaceOf(before.config,id),dialog=host.locator(HP.dialog('room'));
 expect(original.openings.find(o=>o.id==='spur-glass-door').light_transparent).toBe(true);
 const point=await toClient(host,300,300);await page.mouse.move(point.x,point.y);await evidence(info,page,'dangling-wall-room-hover');
 await clickFloor(page,host,300,300);await expect(dialog).toBeVisible();
 await dialog.locator(HP.dialogCancel).first().click();await expect(dialog).toBeHidden();await settle(host);
 expect(spaceOf((await planConfig()).config,id)).toEqual(original);
 expect((await planConfig()).rev).toBe(before.rev);
 await clickFloor(page,host,300,300);await expect(dialog).toBeVisible();
 await field(dialog,'room-name').fill('Room around the dangling wall');
 await dialog.locator(HP.dialogConfirm).filter({hasText:/save room/i}).click();await expect(dialog).toBeHidden();
 const created=spaceOf(await waitForConfig(c=>spaceOf(c,id)?.rooms.length===1,{message:'new room acknowledged and stored on HA'}),id);
 expect(created.rooms).toHaveLength(1);expect(geometry(created)).toEqual(geometry(original));
 await host.locator(HP.action('geometry-undo')).click();
 const undone=spaceOf(await waitForConfig(c=>spaceOf(c,id)?.rooms.length===0,{message:'room Undo acknowledged'}),id);
 expect(undone).toEqual(original);
 await host.locator(HP.action('geometry-redo')).click();
 const redone=spaceOf(await waitForConfig(c=>spaceOf(c,id)?.rooms.length===1,{message:'room Redo acknowledged'}),id);
 expect(redone).toEqual(created);await leaveEditor(host);await page.reload();
 const fresh=await openPlan(page,{space:id});
 await expect(fresh.locator(hp('room-label',{id:created.rooms[0].id}))).toContainText('Room around the dangling wall');
 expect(spaceOf((await planConfig()).config,id)).toEqual(created);await evidence(info,page,'dangling-wall-after-real-reload');
});
test('an open perimeter with a dangling wall does not offer or save a room',async({page},info)=>{
 const{host,id}=await prepare(page,fixture.open),before=await planConfig(),original=spaceOf(before.config,id);
 const point=await toClient(host,300,300);await page.mouse.move(point.x,point.y);await clickFloor(page,host,300,300);await settle(host);
 await expect(host.locator(HP.dialog('room'))).toBeHidden();expect((await planConfig()).rev).toBe(before.rev);
 expect(spaceOf((await planConfig()).config,id)).toEqual(original);await evidence(info,page,'open-perimeter-no-room');
});
