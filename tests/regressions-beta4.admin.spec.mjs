// Real HA regressions required before1.84.0-beta.4 (houseplan-e2e#26).
// Native input is the writer; complete integration documents are the oracles.
import {test,expect} from '@playwright/test';
import {isDeepStrictEqual as equal} from 'node:util';
import {installedRecord,requireHooks} from './lib/contract.mjs';
import {compareTags} from '../scripts/tags.mjs';
import {HP,hp} from './lib/hooks.mjs';
import {card,evidence,expectPlanDrawn} from './lib/ha-page.mjs';
import {planConfig,planLayout,waitForConfig,waitForLayout} from './lib/ha-ws.mjs';
import {restoreSeedAfterEach} from './lib/seed-guard.mjs';
import {openPlan,enterEditor,useTool,settle,toClient,centreOf,dragClient,clickFloor,field,action} from './lib/plan.mjs';
import {fixture,pair,installFixture,watchWrites,history,reloadUnchanged,saveRoom,settledViewport} from './lib/beta4-regressions.mjs';

requireHooks(test,'stage','opening','properties-panel','room-resize','field','action','device-history');
restoreSeedAfterEach(test);
test.beforeEach(()=>{
 const version=installedRecord()?.version;
 test.skip(version&&compareTags('v'+version,'v1.84.0-beta.4')<0,'these repaired contracts first ship in1.84.0-beta.4; skip is not proof');
});

test('#1263 one Escape cancels a contacted device drag before up, then native history and reload stay exact',async({page},info)=>{
 test.setTimeout(150000);
 const writes=watchWrites(page);await page.setViewportSize({width:2000,height:1100});
 const host=await openPlan(page,{space:'f1'});await enterEditor(host,'devices');
 const a=host.locator(hp('device',{id:'e_light_hallway_lamp_5'})).first(),b=host.locator(hp('device',{id:'e_light_hallway_lamp_4'})).first();
 const seed=await planLayout(),box=await a.boundingBox(),from=await centreOf(b);
 await dragClient(page,from,{x:box.x+box.width/2,y:box.y+box.height*1.5+2});
 await expect(b).toHaveAttribute('data-hp-device-component',/.+/);
 const owner=await b.getAttribute('data-hp-device-component');await expect(a).toHaveAttribute('data-hp-device-component',owner);
 await waitForLayout(l=>!equal(l,seed.layout));await settle(host);
 const before=await pair(),count=writes.length,start=await centreOf(b);
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+90,start.y+45,{steps:8});
 await expect(host.locator(hp('properties-panel')).first()).toBeVisible();
 await page.keyboard.press('Escape');await settle(host);
 expect(await pair()).toEqual(before);expect(writes).toHaveLength(count);
 await page.mouse.up();await settle(host);expect(await pair()).toEqual(before);expect(writes).toHaveLength(count);
 await expect(b).toHaveAttribute('data-hp-device-component',owner);
 await evidence(info,page,'contact-cancel-before-next-move');
 const next=await centreOf(b);await dragClient(page,next,{x:next.x+110,y:next.y+70});
 await waitForLayout(l=>!equal(l,before.layout));const moved=(await planLayout()).layout;
 const undo=host.locator(hp('device-history',{action:'undo'})).first(),redo=host.locator(hp('device-history',{action:'redo'})).first();
 await undo.click();await expect.poll(async()=>(await planLayout()).layout).toEqual(before.layout);
 await undo.click();await expect.poll(async()=>(await planLayout()).layout).toEqual(seed.layout);await expect(undo).toBeDisabled();
 await redo.click();await expect.poll(async()=>(await planLayout()).layout).toEqual(before.layout);
 await redo.click();await expect.poll(async()=>(await planLayout()).layout).toEqual(moved);
 await page.reload();await expectPlanDrawn(page,card(page));expect((await planLayout()).layout).toEqual(moved);
 await evidence(info,page,'contact-history-after-reload');
});

test('#1278 #1267 opening Escape is inert; own-wall centre snap with Shift survives ACK and reload',async({page},info)=>{
 test.setTimeout(150000);const writes=watchWrites(page),host=await installFixture(page,'opening');await useTool(host,'select');
 const before=await pair(),count=writes.length,space=before.config.spaces[0],opening=space.openings[0];
 expect(opening.host?.kind).toBe('wall');expect(space.wall_segments.find(w=>w.id===opening.host.id).cm).toBe(15);
 const start=await toClient(host,opening.x*1000,opening.y*1000),end=await toClient(host,400,100);
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:8});
 await expect(host.locator(hp('properties-panel')).first()).toBeVisible();
 await page.keyboard.press('Escape');await settle(host);expect(await pair()).toEqual(before);expect(writes).toHaveLength(count);
 await page.mouse.up();await settle(host);expect(await pair()).toEqual(before);expect(writes).toHaveLength(count);
 // Properties may refit the real HA viewport after the first selection.
 // Both ends of the next native gesture use its current SVG matrix.
 const restart=await toClient(host,opening.x*1000,opening.y*1000),centre=await toClient(host,301,100);
 await page.mouse.move(restart.x,restart.y);await page.mouse.down();await page.mouse.move(centre.x,centre.y,{steps:8});
 await page.keyboard.down('Shift');await page.mouse.move(centre.x+1,centre.y);await evidence(info,page,'held-centre-shoulders-and-tick',{keepPointer:true});
 // #1398/#1399 keeps one stable reference while dragging. Its drafting row
 // replaces the retired axis bubbles. The room is480cm between wall axes,
 //465cm between finished faces (15cm walls), and the window is60cm wide:
 // each clear shoulder is(465-60)/2=202.5cm. Saved axis distances stay210cm.
 if(compareTags('v'+installedRecord().version,'v1.85.2-beta.1')>=0){
  const gap=host.locator('[data-hp="wall-side-dimension"][data-role="opening-gap"]');
  await expect(gap).toHaveCount(1);await expect(gap.locator('text')).toHaveText('2.025 m');
  await expect(gap).toHaveAttribute('data-length-cm','202.5');
  await expect(gap).toHaveAttribute('data-reference-source','room-face');
  await expect(gap).toHaveAttribute('data-room','left');
  await expect(gap).toBeVisible();
  // A horizontal SVG line has a zero-height DOM box; Playwright's HTML
  // visibility predicate rejects it even when its stroke is painted.
  expect(await gap.locator('[data-hp="dimension-rail"] line').evaluate(line=>{
   const style=getComputedStyle(line),a=Number(line.getAttribute('x1')),b=Number(line.getAttribute('x2'));
   return !!line.getScreenCTM()&&Math.abs(b-a)>1&&style.visibility==='visible'
    &&style.stroke!=='none'&&Number.parseFloat(style.strokeWidth)>0;
  })).toBe(true);
 }else await expect(host.locator('.measurelabel.opshoulder')).toHaveText(['2.10 m','2.10 m']);
 await expect(host.locator('.opcentertick')).toHaveCount(1);
 await page.mouse.up();await page.keyboard.up('Shift');
 const saved=await waitForConfig(c=>c.spaces[0].openings[0].x!==opening.x);
 const moved=saved.spaces[0].openings[0];expect(moved.x).toBe(.3);expect(moved.y).toBe(.1);
 expect(moved.host.id).toBe(opening.host.id);expect(moved.host.t).toBe(.5);expect(moved.host.tq).toEqual(['1','2']);
 expect((moved.x-.1-moved.length/2)*1200).toBeCloseTo(210,6);
 expect((.5-moved.x-moved.length/2)*1200).toBeCloseTo(210,6);
 await history(host,'undo');await waitForConfig(c=>equal(c.spaces[0],space));
 await history(host,'redo');await waitForConfig(c=>equal(c.spaces[0],saved.spaces[0]));
 await reloadUnchanged(page,saved);await evidence(info,page,'opening-after-reload');
});

test('#1265 a Draw segment cut by an existing divider saves both room offers with exact shared identity',async({page},info)=>{
 test.setTimeout(150000);const host=await installFixture(page,'draw-two');
 // Native endpoints must be below the floating Walls controls, not covered by them.
 await host.locator(hp('zoom-out')).first().click();await settle(host);await useTool(host,'draw');
 const before=(await planConfig()).config;
 await clickFloor(page,host,100,200);await clickFloor(page,host,900,200);
 await saveRoom(host,'First face',{expectHidden:false});
 // The two offers are one atomic face batch. Its final Save writes both.
 const next=host.locator(HP.dialog('room')).first();
 if(!await next.isVisible())await clickFloor(page,host,700,500);
 await saveRoom(host,'Second face');const saved=await waitForConfig(c=>c.spaces[0].rooms.length===2);
 const sp=saved.spaces[0],[a,b]=sp.rooms,shared=a.wall_ids.filter(id=>b.wall_ids.includes(id));
 expect(shared).toEqual(['middle-source']);expect(sp.partitions).toHaveLength(0);
 for(const source of before.spaces[0].partitions)expect(sp.wall_segments.some(w=>w.id===source.id)).toBe(true);
 await history(host,'undo');await waitForConfig(c=>c.spaces[0].rooms.length===0);
 await history(host,'redo');await waitForConfig(c=>equal(c.spaces[0],sp));
 await reloadUnchanged(page,saved);await evidence(info,page,'both-faces-after-reload');
});

for(const name of ['promotion','promotion-residual'])test('#1265 '+name+' retains source atoms and the exact opening host after real Save',async({page},info)=>{
 test.setTimeout(150000);const host=await installFixture(page,name),before=(await planConfig()).config;
 const expected=fixture('promotion-expected'),target=expected.spaces[0].rooms.find(r=>r.id!=='neighbour');
 // The source already encloses a free face. Select offers it (#1176);
 // Walls deliberately begins a new drawing chain instead.
 await useTool(host,'select');
 const centre=target.poly.reduce((p,[x,y])=>[p[0]+x/target.poly.length,p[1]+y/target.poly.length],[0,0]);
 await clickFloor(page,host,centre[0]*1000,centre[1]*1000);
 await saveRoom(host,'Promoted');const saved=await waitForConfig(c=>c.spaces[0].rooms.length===2);
 const sp=saved.spaces[0],room=sp.rooms.find(r=>r.id!=='neighbour');
 expect(room.wall_ids).toEqual(target.wall_ids);expect(sp.rooms.find(r=>r.id==='neighbour')).toEqual(before.spaces[0].rooms[0]);
 expect(saved.spaces[1]).toEqual(before.spaces[1]);
 const opening=sp.openings[0],old=before.spaces[0].openings[0];
 if(name==='promotion')expect(opening).toEqual(expected.spaces[0].openings[0]);else expect(opening).toEqual(old);
 expect(sp.partitions).toEqual(expected.spaces[0].partitions);
 await history(host,'undo');await waitForConfig(c=>equal(c.spaces[0],before.spaces[0]));
 await history(host,'redo');await waitForConfig(c=>equal(c.spaces[0],sp));
 await reloadUnchanged(page,saved);await evidence(info,page,name+'-after-reload');
});

test('#1279 classic Split has one physical divider and exact all-wall thickness history',async({page},info)=>{
 test.setTimeout(150000);const host=await installFixture(page,'split');await useTool(host,'rooms');await useTool(host,'split');
 await clickFloor(page,host,300,300);await clickFloor(page,host,500,100);await clickFloor(page,host,500,900);
 await saveRoom(host,'Right child');const split=await waitForConfig(c=>c.spaces[0].rooms.length===2),sp=split.spaces[0];
 const [a,b]=sp.rooms,shared=a.wall_ids.filter(id=>b.wall_ids.includes(id));expect(shared).toHaveLength(1);
 expect(sp.wall_segments.filter(w=>w.a[0]===.5&&w.b[0]===.5)).toHaveLength(1);
 await useTool(host,'wall-thickness');await clickFloor(page,host,300,100);
 await field(host,'wall-thickness').fill('10');
 const apply=action(host,'wall-thickness-apply-room');await expect(apply).toBeVisible();await apply.click();await expect(apply).toBeHidden();
 const thick=await waitForConfig(c=>c.spaces[0].wall_segments.find(w=>w.id===shared[0]).cm===10),walls=thick.spaces[0].wall_segments;
 expect(walls.filter(w=>w.a[0]===.9&&w.b[0]===.9).every(w=>w.cm===0)).toBe(true);
 await history(host,'undo');await waitForConfig(c=>equal(c.spaces[0],sp));
 await history(host,'redo');await waitForConfig(c=>equal(c.spaces[0],thick.spaces[0]));
 await reloadUnchanged(page,thick);await evidence(info,page,'split-thickness-after-reload');
});

test('#1264 native Resize nodes the fixed neighbour, preserves independent material and opening child through history',async({page},info)=>{
 test.setTimeout(150000);const writes=watchWrites(page),host=await installFixture(page,'resize'),before=(await planConfig()).config,original=before.spaces[0];
 await useTool(host,'rooms');await useTool(host,'resize');const handle=host.locator(hp('room-resize',{room:'upper-left',edge:'1'})).first();
 await settledViewport(host);
 await expect(handle).toBeVisible();await expect(handle).toHaveAttribute('aria-disabled','false');
 const from=await centreOf(handle),to=await toClient(host,450,325);
 const input=await handle.evaluate((el,p)=>({attrs:el.outerHTML,hit:el.getRootNode().elementFromPoint(p.x,p.y)?.outerHTML}),from);
 await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:12});await settle(host);
 await info.attach('resize-held.json',{body:JSON.stringify({from,to,input,handles:await host.locator(hp('room-resize')).evaluateAll(els=>els.map(el=>el.outerHTML))},null,2),contentType:'application/json'});
 await evidence(info,page,'resize-held-before-up',{keepPointer:true});await page.mouse.up();
 await settle(host);await info.attach('resize-native-write.json',{body:JSON.stringify({writes,stored:(await planConfig()).config},null,2),contentType:'application/json'});
 let saved;
 try{saved=await waitForConfig(c=>!equal(c.spaces[0],original));}
 finally{await info.attach('resize-final-stored.json',{body:JSON.stringify({writes,stored:(await planConfig()).config},null,2),contentType:'application/json'});}
 const sp=saved.spaces[0],movedX=sp.rooms.find(r=>r.id==='upper-left').poly[1][0];
 // Native grid multiplication can yield .45000000000000007. This is far below
 // one grid step; exact document/history and the host's rational remain strict.
 expect(movedX).toBeCloseTo(.45,14);
 expect(sp.rooms.find(r=>r.id==='lower-left').poly).toEqual([[.1,.5],[movedX,.5],[.5,.5],[.5,.85],[.1,.85]]);
 expect(sp.partitions).toEqual(original.partitions);expect(sp.rooms.find(r=>r.id==='remote')).toEqual(original.rooms.find(r=>r.id==='remote'));
 const opening=sp.openings[0],old=original.openings[0],child=sp.wall_segments.find(w=>w.id===opening.host.id);
 expect({...opening,host:old.host}).toEqual(old);expect(opening.host.id).not.toBe(old.host.id);expect(opening.host.t).toBeCloseTo(4/7,14);
 const decimals=[child.a[0],child.b[0],opening.x].map(v=>String(v).split('.')),places=Math.max(...decimals.map(([,s=''])=>s.length));
 const [a,b,p]=decimals.map(([whole,fraction=''])=>BigInt(whole+fraction.padEnd(places,'0')));
 let numerator=a-p,denominator=a-b;const gcd=(a,b)=>b?gcd(b,a%b):a;
 const divisor=gcd(numerator,denominator);expect(opening.host.tq).toEqual([String(numerator/divisor),String(denominator/divisor)]);
 expect([child.a,child.b,child.cm]).toEqual([[movedX,.5],[.1,.5],37]);
 expect(writes.filter(w=>w.type==='houseplan/config/set')).toEqual([expect.objectContaining({reply:{success:true}})]);
 await history(host,'undo');await waitForConfig(c=>equal(c.spaces[0],original));
 await history(host,'redo');await waitForConfig(c=>equal(c.spaces[0],sp));
 await reloadUnchanged(page,saved);await evidence(info,page,'incident-resize-after-reload');
});

test('#1264 an independent incident material obstacle safely clamps Resize without a storage write',async({page},info)=>{
 test.setTimeout(120000);const writes=watchWrites(page),host=await installFixture(page,'resize-conflict'),before=await pair(),count=writes.length;
 await useTool(host,'rooms');await useTool(host,'resize');
 const handle=host.locator(hp('room-resize',{room:'upper-left',edge:'1'})).first();await expect(handle).toHaveAttribute('aria-disabled','false');
 const from=await centreOf(handle),to=await toClient(host,450,325);
 await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:12});await settle(host);await page.mouse.up();await settle(host);
 expect(await pair()).toEqual(before);expect(writes).toHaveLength(count);
 await reloadUnchanged(page,before.config);await evidence(info,page,'incident-material-refusal');
});
