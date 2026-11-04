// Source-pinned regressions requested in houseplan-e2e#26 before beta.4.
import {test,expect} from '@playwright/test';
import {isDeepStrictEqual as equal} from 'node:util';
import {installedRecord,requireHooks} from './lib/contract.mjs';
import {compareTags} from '../scripts/tags.mjs';
import {HP,hp} from './lib/hooks.mjs';
import {evidence} from './lib/ha-page.mjs';
import {planConfig,waitForConfig} from './lib/ha-ws.mjs';
import {restoreSeedAfterEach} from './lib/seed-guard.mjs';
import {useTool,settle,toClient,centreOf,clickFloor} from './lib/plan.mjs';
import {fixture,pair,installFixture,history,reloadUnchanged,saveRoom,materialProblems} from './lib/beta4-regressions.mjs';
import {holdConfigReply} from './lib/held-config-reply.mjs';

requireHooks(test,'stage','room-resize','field','action');
restoreSeedAfterEach(test);
test.beforeEach(()=>{const version=installedRecord()?.version;test.skip(version&&compareTags('v'+version,'v1.84.0-beta.4')<0,'new beta.4 contracts; a skip is not evidence');});
async function resize(page,host,room,edge,steps){
 await useTool(host,'rooms');await useTool(host,'resize');
 const handle=host.locator(hp('room-resize',{room,edge:String(edge)})).first();
 await expect(handle).toHaveAttribute('aria-disabled','false');
 const config=(await planConfig()).config,poly=config.spaces[0].rooms.find(r=>r.id===room).poly,a=poly[edge],b=poly[(edge+1)%poly.length];
 const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
 const step=Number(await host.locator(hp('stage')).first().getAttribute('data-grid-step'));
 expect(step).toBeGreaterThan(0);
 const from=await centreOf(handle),to=await toClient(host,(a[0]+b[0])*500+(b[1]-a[1])/length*step*steps,(a[1]+b[1])*500-(b[0]-a[0])/length*step*steps);
 await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:12});await settle(host);await page.mouse.up();
 return waitForConfig(c=>!equal(c.spaces[0],config.spaces[0]));
}
async function keepRoom(page,host,id){
 const before=(await planConfig()).config,room=before.spaces[0].rooms.find(r=>r.id===id);
 // These two source rooms are rectangles with collinear graph junctions.
 // Use an interior quarter point, clear of their central room-settings pill.
 const p=[0,1].map(i=>Math.min(...room.poly.map(p=>p[i]))*.75+Math.max(...room.poly.map(p=>p[i]))*.25);
 await useTool(host,'rooms');await useTool(host,'delete-room');await clickFloor(page,host,p[0]*1000,p[1]*1000);
 const confirm=host.locator(HP.dialogConfirm).filter({hasText:/delete room, keep walls/i}).first();await expect(confirm).toBeVisible();await confirm.click();
 return waitForConfig(c=>!c.spaces[0].rooms.some(r=>r.id===id));
}
async function exactHistory(page,host,before,after){
 await history(host,'undo');await waitForConfig(c=>equal(c.spaces[0],before.spaces[0]));
 await history(host,'redo');await waitForConfig(c=>equal(c.spaces[0],after.spaces[0]));
 await reloadUnchanged(page,after);
}

test('#1265 composite 874 native closure preserves parent, neighbour and source material through real ACK/history/reload',async({page},info)=>{
 test.setTimeout(150000);const host=await installFixture(page,'closure'),before=(await planConfig()).config,source=fixture('closure-actions');
 // One source grid step must span several pixels for exact sub-grid vertices.
 for(let i=0;i<3;i++)await host.locator(hp('zoom-in')).first().click();await settle(host);await useTool(host,'draw');
 for(const p of [source.addedWall.a,source.addedWall.b])await clickFloor(page,host,p[0]*1000,p[1]*1000);
 await expect(host.locator(HP.dialog('room')).first()).toBeVisible();
 const beforeSave=await waitForConfig(c=>c.spaces[0].partitions.some(p=>p.a[0]===source.addedWall.a[0]&&p.b[0]===source.addedWall.a[0]));
 await saveRoom(host,'Composite child');const saved=await waitForConfig(c=>c.spaces[0].rooms.length===3),sp=saved.spaces[0];
 const neighbour=sp.rooms.find(r=>r.id==='neighbor'),oldNeighbour=before.spaces[0].rooms.find(r=>r.id==='neighbor');
 expect({...neighbour,poly:oldNeighbour.poly,wall_ids:oldNeighbour.wall_ids}).toEqual(oldNeighbour);
 for(const p of oldNeighbour.poly)expect(neighbour.poly).toContainEqual(p);
 expect(neighbour.poly).toContainEqual(source.addedWall.b);
 const parent=sp.rooms.find(r=>r.id==='parent'),oldParent=before.spaces[0].rooms.find(r=>r.id==='parent');
 expect({...parent,poly:oldParent.poly,wall_ids:oldParent.wall_ids}).toEqual(oldParent);
 const old=source.oldWall,atoms=[...sp.wall_segments,...sp.partitions].filter(w=>w.a[1]===old.a[1]&&w.b[1]===old.b[1]&&Math.min(w.a[0],w.b[0])>=Math.min(old.a[0],old.b[0])&&Math.max(w.a[0],w.b[0])<=Math.max(old.a[0],old.b[0]));
 expect(atoms.some(w=>w.id==='old-carrier'||w.id.startsWith('old-carrier~'))).toBe(true);
 expect(atoms.every(w=>w.cm===25)).toBe(true);
 expect(atoms.reduce((n,w)=>n+Math.abs(w.b[0]-w.a[0]),0)).toBeCloseTo(Math.abs(old.b[0]-old.a[0]),12);
 await exactHistory(page,host,beforeSave,saved);await evidence(info,page,'composite-after-reload');
});

test('#1265 a real refused promotion Save preserves storage and a native retry commits the exact host',async({page},info)=>{
 test.setTimeout(150000);const hold=await holdConfigReply(page),host=await installFixture(page,'promotion'),before=await pair();
 await useTool(host,'select');const expected=fixture('promotion-expected'),room=expected.spaces[0].rooms.find(r=>r.id!=='neighbour');
 const centre=room.poly.reduce((p,q)=>p.map((v,i)=>v+q[i]/room.poly.length),[0,0]);await clickFloor(page,host,centre[0]*1000,centre[1]*1000);
 const dialog=host.locator(HP.dialog('room')).first();await dialog.locator(HP.field('room-name')).first().fill('Retry promotion');
 const reached=hold.arm({staleRevision:true});await dialog.locator(HP.dialogConfirm).filter({hasText:/save room/i}).first().click();
 expect((await reached).reply).toEqual({success:false,errorCode:'conflict'});expect(await pair()).toEqual(before);
 // Face batches close optimistically; the real rejection must restore the
 // source geometry so Select can offer the same face again without reload.
 hold.release();await expect(host.locator(hp('toast',{id:'toast.conflict'}))).toBeVisible();
 await evidence(info,page,'promotion-real-refusal');await clickFloor(page,host,centre[0]*1000,centre[1]*1000);await saveRoom(host,'Retry promotion');
 const saved=await waitForConfig(c=>c.spaces[0].rooms.length===2);
 expect(saved.spaces[0].openings[0]).toEqual(expected.spaces[0].openings[0]);
 await exactHistory(page,host,before.config,saved);
});

test('#1264 native seam Resize preserves the exact dependent corner belonging only to fixed rooms',async({page},info)=>{
 test.setTimeout(150000);const host=await installFixture(page,'dependent'),before=(await planConfig()).config;
 const saved=await resize(page,host,'a',1,3);
 const fixedLeft=saved.spaces[0].rooms.find(r=>r.id==='fixed-left'),fixedRight=saved.spaces[0].rooms.find(r=>r.id==='fixed-right'),oldRight=before.spaces[0].rooms.find(r=>r.id==='fixed-right');
 expect(fixedLeft).toEqual(before.spaces[0].rooms.find(r=>r.id==='fixed-left'));
 expect({...fixedRight,poly:oldRight.poly,wall_ids:oldRight.wall_ids}).toEqual(oldRight);
 for(const p of oldRight.poly)expect(fixedRight.poly).toContainEqual(p);
 expect(fixedRight.poly).toContainEqual([.5125,.5]);
 expect(fixedLeft.poly).toContainEqual([.3,.7]);expect(fixedRight.poly).toContainEqual([.3,.7]);
 expect(saved.spaces[0].rooms.find(r=>r.id==='a').poly).not.toEqual(before.spaces[0].rooms.find(r=>r.id==='a').poly);
 await exactHistory(page,host,before,saved);await evidence(info,page,'dependent-corner-after-reload');
});

test('#1264 first-floor Resize minus3, Keep room-f, Resize plus1, Keep room-b has no new hidden or mixed-role material',async({page},info)=>{
 test.setTimeout(180000);const host=await installFixture(page,'first-floor'),before=(await planConfig()).config;
 const resized=await resize(page,host,'room-b',0,-3),kept=await keepRoom(page,host,'room-f');
 expect(kept.spaces[0].rooms).toHaveLength(before.spaces[0].rooms.length-1);
 const resizedAgain=await resize(page,host,'room-b',0,1),saved=await keepRoom(page,host,'room-b');
 expect(saved.spaces[0].rooms).toHaveLength(before.spaces[0].rooms.length-2);
 for(const c of [resized,kept,resizedAgain,saved]){
  const sp=c.spaces[0],ids=sp.wall_segments.map(w=>w.id);
  expect(materialProblems(sp)).toEqual({hidden:[],mixed:[]});
  expect(new Set(ids).size).toBe(ids.length);
  expect(sp.partitions.every(p=>!ids.includes(p.id))).toBe(true);
  // Any kept partition coinciding with a wall would be a new hidden obstacle.
  for(const p of sp.partitions)expect(sp.wall_segments.some(w=>equal([p.a,p.b],[w.a,w.b])||equal([p.a,p.b],[w.b,w.a]))).toBe(false);
 }
 await exactHistory(page,host,resizedAgain,saved);await evidence(info,page,'first-floor-after-reload');
});
