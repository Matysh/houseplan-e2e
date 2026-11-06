// New 1.85 journeys: genuine UI input and HA ACK/readback, no private product writes.
import {test,expect} from '@playwright/test';
import {requireHooks} from './lib/contract.mjs';
import {card,evidence} from './lib/ha-page.mjs';
import {HP,hp} from './lib/hooks.mjs';
import {planConfig,planLayout,spaceOf,waitForConfig,wsCall} from './lib/ha-ws.mjs';
import {callService,getState,waitForState} from './lib/ha-api.mjs';
import {USERS,HA_URL} from '../scripts/users.mjs';
import {restoreSeedAfterEach} from './lib/seed-guard.mjs';
import {centreOf,clickFloor,dragClient,enterEditor,field,leaveEditor,selectSpace,settle,stage,gridStep,toClient,useTool} from './lib/plan.mjs';
import {visiblePlanSegment} from './lib/visible-plan-target.mjs';

requireHooks(test,'empty-plan','empty-plan-edit','node-attach-target','wall-node','room-settings','stair');
restoreSeedAfterEach(test);
const hint='Only areas that are not yet linked in Houseplan are shown.';
const prompt='The plan is empty. Let’s draw something.';
const wire=p=>['l',String(Math.round(p.x*240/1000)),String(Math.round(p.y*240/1000))];
const graph=(config,id)=>spaceOf(config,id).plan_graph;
const preview=host=>host.locator('.hp-stair-placement-preview');

async function annex(page,title){
 await page.goto('/houseplan');const host=card(page);
 await expect(host.locator(HP.ready)).toBeVisible({timeout:60000});
 await host.locator(HP.spaceAdd).first().click();const dialog=host.locator(HP.dialog('space')).first();
 await expect(dialog).toBeVisible();await field(dialog,'space-title').fill(title);
 await field(dialog,'space-plan-source').selectOption({label:'Draw it myself'});
 await dialog.locator(HP.dialogConfirm).first().click();await expect(dialog).toBeHidden();
 const saved=await waitForConfig(c=>c.spaces.some(s=>s.title===title),{message:'new annex on real HA'});
 const id=saved.spaces.find(s=>s.title===title).id;await selectSpace(host,id);
 await expect(host.locator(HP.mode('plan'))).toBeVisible();await settle(host);return{host,id};
}
async function updateSpace(id,change){
 const before=await planConfig(),next=structuredClone(before.config);change(spaceOf(next,id));
 const accepted=await wsCall({type:'houseplan/config/set',config:next,expected_rev:before.rev});
 await expect.poll(async()=>spaceOf((await planConfig()).config,id)).toEqual(spaceOf(accepted.config,id));return accepted.config;
}
async function rectangle(page,host,name){
 await useTool(host,'draw');await field(host,'wall-thickness').fill('15');await field(host,'wall-thickness').press('Enter');
 const targets=await stage(host).evaluate(visiblePlanSegment,{step:await gridStep(host),clearInterior:true,
  pattern:[[[0,0],[2,0]],[[2,0],[2,2]],[[2,2],[0,2]],[[0,2],[0,0]]]});
 for(const point of [...targets.segments.map(s=>s.a),targets.segments[0].a])await clickFloor(page,host,point.x,point.y);
 const dialog=host.locator(HP.dialog('room')).first();await expect(dialog).toBeVisible();
 await expect(dialog.getByText(hint,{exact:true})).toHaveText(hint);
 await field(dialog,'room-name').fill(name);return{dialog,targets};
}
async function pointerFree(host){
 return stage(host).evaluate(svg=>{
  const r=svg.getBoundingClientRect(),occupied=[...svg.querySelectorAll('[data-hp="wall"],[data-hp="room"],[data-hp="stair"],[data-hp="device"]')].filter(n=>!n.closest('.hp-stair-placement-preview')).map(n=>n.getBoundingClientRect());
  for(const fy of [.8,.65,.5,.35,.2,.1,.9])for(const fx of [.75,.55,.35,.2,.1,.9]){
   const p={x:r.x+r.width*fx,y:r.y+r.height*fy};
   if(occupied.some(b=>p.x>=b.left-20&&p.x<=b.right+20&&p.y>=b.top-20&&p.y<=b.bottom+20))continue;
   let hit=document.elementFromPoint(p.x,p.y);while(hit?.shadowRoot){const next=hit.shadowRoot.elementFromPoint(p.x,p.y);if(!next||next===hit)break;hit=next;}
   if(hit&&(hit===svg||svg.contains(hit))&&!hit.closest('button,input,select,[data-hp="wall-node"]'))return p;
  }throw Error('No visible empty client target');
 });
}

test('empty View and the room area helper survive real writes, reader and kiosk contexts',async({page,context},info)=>{
 test.setTimeout(180000);const{host,id}=await annex(page,'1.85 empty helper');
 await leaveEditor(host);const empty=host.locator(hp('empty-plan')),button=host.locator(hp('empty-plan-edit'));
 await expect(empty).toContainText(prompt);await expect(button).toHaveText('Plan editor');await expect(host.locator('.homearrow')).toHaveCount(0);
 const before=await planConfig(),layout=await planLayout(),at=await pointerFree(host);
 await dragClient(page,at,{x:at.x-80,y:at.y-25});await settle(host);
 expect((await planConfig()).config).toEqual(before.config);expect((await planLayout()).layout).toEqual(layout.layout);
 await expect(host.locator('.homearrow')).toHaveCount(0);
 const browser=context.browser();
 const reader=await browser.newContext({baseURL:HA_URL,storageState:USERS.viewer.storageState});
 try{const p=await reader.newPage();await p.goto('/houseplan');const h=card(p);await expect(h.locator(HP.ready)).toBeVisible({timeout:60000});await selectSpace(h,id);
  await expect(h.locator(hp('empty-plan'))).toContainText(prompt);await expect(h.locator(hp('empty-plan-edit'))).toHaveCount(0);
 }finally{await reader.close();}
 const kiosk=await browser.newContext({baseURL:HA_URL,storageState:USERS.admin.storageState});
 try{const p=await kiosk.newPage(),index=(await planConfig()).config.spaces.findIndex(s=>s.id===id)+1;
  await p.goto('/houseplan?hpkiosk=1&hpspace='+index);const h=card(p);await expect(h.locator(hp('empty-plan'))).toBeVisible({timeout:60000});
  await expect(h.locator(hp('empty-plan-edit'))).toHaveCount(0);for(const control of await h.locator(HP.editorTabs).all())await expect(control).toBeHidden();
 }finally{await kiosk.close();}
 // A real second client's hidden content is still content; removal restores the state.
 await updateSpace(id,s=>{s.decor=[{id:'hidden185',kind:'rect',x:.3,y:.3,w:.1,h:.1,color:'#ff0000',width:3}];s.settings={...s.settings,hide_decor:true};});
 await expect(empty).toHaveCount(0);await page.reload();await expect(card(page).locator(HP.ready)).toBeVisible({timeout:60000});await selectSpace(host,id);
 await expect(empty).toHaveCount(0);await expect(host.locator('.decorlayer .dshape')).toHaveCount(0);
 await updateSpace(id,s=>{s.decor=[];});await expect(empty).toBeVisible();await expect(host.locator('.homearrow')).toHaveCount(0);
 const freeArea=await wsCall({type:'config/area_registry/create',name:'Houseplan 1.85 E2E '+Date.now()});
 await button.click();await expect(host.locator(HP.mode('plan'))).toBeVisible();
 const{dialog}=await rectangle(page,host,'1.85 area room');
 const areas=await field(dialog,'room-area').locator('option').evaluateAll(xs=>xs.map(x=>x.value));
 const bound=(await planConfig()).config.spaces.flatMap(s=>(s.rooms||[]).map(r=>r.area)).filter(Boolean);
 for(const area of bound)expect(areas).not.toContain(area);
 const selected=freeArea.area_id;expect(areas).toContain(selected);await field(dialog,'room-area').selectOption(selected);
 await dialog.locator(HP.dialogConfirm).filter({hasText:/save room/i}).first().click();await expect(dialog).toBeHidden();
 const saved=await waitForConfig(c=>spaceOf(c,id).rooms.some(r=>r.name==='1.85 area room'));
 const room=spaceOf(saved,id).rooms.find(r=>r.name==='1.85 area room');expect(room.area||'').toBe(selected);
 await leaveEditor(host);await expect(empty).toHaveCount(0);await page.reload();await expect(card(page).locator(HP.ready)).toBeVisible({timeout:60000});await selectSpace(host,id);await enterEditor(host,'plan');
 await host.locator(hp('room-settings')).first().click();const reopened=host.locator(HP.dialog('room')).first();await expect(reopened).toBeVisible();
 await expect(field(reopened,'room-area')).toHaveValue(selected);await expect(reopened.locator('.hpf-hint').filter({hasText:hint})).toBeVisible();
 await reopened.locator(HP.dialogCancel).first().click();await evidence(info,page,'185-empty-area-reloaded');
 await wsCall({type:'config/area_registry/delete',area_id:freeArea.area_id});
});

test('dangling endpoint attach keeps exact graph identity through ACK, Undo Redo and reload',async({page},info)=>{
 test.setTimeout(360000);const requests=[];
 page.on('websocket',socket=>socket.on('framesent',event=>{try{const m=JSON.parse(String(event.payload));if(m.type==='houseplan/wall/node_move'&&m.intent?.attach_edge){const{id,...body}=m;requests.push(body);}}catch{}}));
 const patterns=[
  {name:'horizontal',host:[[0,0],[3,0]],source:[[1,2],[1,1]]},
  {name:'vertical',host:[[0,0],[0,3]],source:[[2,1],[1,1]]},
  {name:'diagonal',host:[[0,0],[3,3]],source:[[0,2],[1,2]]},
  {name:'room wall',host:[[0,0],[3,0]],source:[[1,-2],[1,-1]],room:true}];
 for(const item of patterns){
  const{host,id}=await annex(page,'1.85 attach '+item.name);expect((await planConfig()).wall_node_attach_api).toBe(1);
  await useTool(host,'draw');await field(host,'wall-thickness').fill('0');await field(host,'wall-thickness').press('Enter');
  const pattern=item.room?[[[0,0],[3,0]],[[3,0],[3,2]],[[3,2],[0,2]],[[0,2],[0,0]],item.source]:[item.host,item.source];
  const targets=await stage(host).evaluate(visiblePlanSegment,{step:await gridStep(host),pixels:65,clearInterior:true,pattern});
  const hostLine=targets.segments[0],source=targets.segments.at(-1);
  const points=item.room?[...targets.segments.slice(0,4).map(s=>s.a),hostLine.a]:[hostLine.a,hostLine.b];
  for(const p of points)await clickFloor(page,host,p.x,p.y);
  if(item.room){const d=host.locator(HP.dialog('room')).first();await expect(d).toBeVisible();await field(d,'room-name').fill('Attach contour');await d.locator(HP.dialogConfirm).filter({hasText:/save room/i}).first().click();await expect(d).toBeHidden();}
  else await page.keyboard.press('Escape');
  await useTool(host,'draw');for(const p of[source.a,source.b])await clickFloor(page,host,p.x,p.y);await page.keyboard.press('Escape');
  await waitForConfig(c=>(graph(c,id)?.edges.length||0)>=(item.room?5:2));await useTool(host,'select');await settle(host);
  const before=await planConfig(),g=graph(before.config,id),node=g.nodes.find(n=>JSON.stringify(n.p)===JSON.stringify(wire(source.b)));expect(node).toBeTruthy();
  const target={x:hostLine.a.x+(hostLine.b.x-hostLine.a.x)/3,y:hostLine.a.y+(hostLine.b.y-hostLine.a.y)/3};
  const from=await centreOf(host.locator(hp('wall-node',{node:node.id})).first()),to=await toClient(host,target.x,target.y);
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:10});
  await expect(host.locator(hp('node-attach-target'))).toBeVisible();expect(graph((await planConfig()).config,id)).toEqual(g);
  if(item.name==='horizontal'){await page.keyboard.press('Escape');await page.mouse.up();await settle(host);expect(graph((await planConfig()).config,id)).toEqual(g);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:10});await expect(host.locator(hp('node-attach-target'))).toBeVisible();}
  await page.mouse.up();const committed=await waitForConfig(c=>graph(c,id)?.edges.length===g.edges.length+1,{message:'real attach ACK'}),after=graph(committed,id);
  const emitted=requests.findLast(m=>m.space_id===id&&m.direction==='apply');expect(emitted).toBeTruthy();
  const stored=after.nodes.find(n=>n.id===node.id).p;expect(stored).toEqual(emitted.intent.target_p);
  const frac=p=>p[0]==='l'?[[BigInt(p[1]),240n],[BigInt(p[2]),240n]]:[[BigInt(p[1]),BigInt(p[2])],[BigInt(p[3]),BigInt(p[4])]];
  const edge=g.edges.find(e=>e.id===emitted.intent.attach_edge.id),a=frac(g.nodes.find(n=>n.id===edge.from).p),b=frac(g.nodes.find(n=>n.id===edge.to).p),z=frac(stored),[tn,td]=emitted.intent.attach_edge.tq.map(BigInt);
  expect(tn>0n&&tn<td).toBe(true);
  for(let i=0;i<2;i++){const[an,ad]=a[i],[bn,bd]=b[i],[zn,zd]=z[i];expect(zn*(ad*bd*td)).toBe((an*bd*td+(bn*ad-an*bd)*tn)*zd);}
  expect(after.edges.filter(e=>e.from===node.id||e.to===node.id)).toHaveLength(3);
  for(const n of g.nodes.filter(n=>n.id!==node.id))expect(after.nodes.find(x=>x.id===n.id)).toEqual(n);
  if(item.room)expect(after.rooms[0].edges.length).toBe(g.rooms[0].edges.length+1);
  for(const[action,expected]of[['geometry-undo',g],['geometry-redo',after]]){const b=host.locator(HP.action(action)).first();await expect(b).toBeEnabled();await b.click();await expect.poll(async()=>graph((await planConfig()).config,id)).toEqual(expected);}
  const request=requests.findLast(m=>m.space_id===id&&m.direction!=='undo');expect(request).toBeTruthy();const accepted=await planConfig();
  await expect(wsCall({...request,expected_rev:before.rev})).rejects.toThrow(/conflict|revision|stale/i);
  await expect(wsCall({...request,expected_rev:accepted.rev},'viewer')).rejects.toThrow(/unauthor|forbidden|permission/i);
  expect(graph((await planConfig()).config,id)).toEqual(after);
  await page.reload();await expect(card(page).locator(HP.ready)).toBeVisible({timeout:60000});await selectSpace(host,id);expect(graph((await planConfig()).config,id)).toEqual(after);
  await evidence(info,page,'185-attach-'+item.name.replaceAll(' ','-'));
 }
});

test('Straight and Spiral hover have one owner, no write, native cancellation and durable placement',async({page},info)=>{
 test.setTimeout(240000);const{host,id}=await annex(page,'1.85 stair hover');
 await useTool(host,'draw');await field(host,'wall-thickness').fill('0');await field(host,'wall-thickness').press('Enter');
 const wall=await stage(host).evaluate(visiblePlanSegment,{step:await gridStep(host),pixels:65,pattern:[[[0,0],[1,0]],[[1,0],[1,1]]]});
 for(const p of[wall.segments[0].a,wall.segments[0].b,wall.segments[1].b])await clickFloor(page,host,p.x,p.y);await page.keyboard.press('Escape');await waitForConfig(c=>graph(c,id)?.edges.length===2);
 const arm=async kind=>{await useTool(host,'stairs');await host.locator(hp('tray')).locator('[data-group-item="'+kind+'"]').click();await settle(host);};
 const signature=locator=>locator.evaluate(node=>({kind:node.dataset.kind,outline:node.querySelector('.hp-stair-outline').getAttribute('points'),treads:node.querySelector('.hp-stair-tread')?.getAttribute('d')||''}));
 for(const kind of['straight','spiral']){
  await arm(kind);const before=await planConfig(),at=await pointerFree(host);await page.mouse.move(at.x,at.y);await expect(preview(host)).toHaveCount(1);
  await expect(preview(host)).toHaveAttribute('pointer-events','none');await expect(preview(host).locator(hp('stair'))).toHaveAttribute('data-kind',kind);
  expect((await planConfig()).config).toEqual(before.config);expect((await planConfig()).rev).toBe(before.rev);
  const lamp='light.wall_lamp_1',old=await getState(lamp),next=old.state==='on'?'off':'on';
  try{await callService('light','turn_'+next,{entity_id:lamp});await waitForState(lamp,next);await expect.poll(()=>host.evaluate((c,e)=>c.hass.states[e]?.state,lamp)).toBe(next);await expect(preview(host)).toHaveCount(1);}finally{await callService('light','turn_'+(old.state==='on'?'on':'off'),{entity_id:lamp});}
  const nodeAt=await toClient(host,wall.segments[0].b.x,wall.segments[0].b.y);await page.mouse.click(nodeAt.x,nodeAt.y,{button:'right'});
  const menu=host.locator(hp('node-context-menu'));await expect(menu).toBeVisible();await expect(menu.locator('[data-action="node-delete"]')).toBeEnabled();
  expect((await planConfig()).config).toEqual(before.config);await page.keyboard.press('Escape');await expect(menu).toBeHidden();
  await page.mouse.move(at.x,at.y);await expect(preview(host)).toHaveCount(1);const shown=await signature(preview(host).locator(hp('stair')));
  await page.mouse.click(at.x,at.y);const saved=await waitForConfig(c=>(spaceOf(c,id).stairs||[]).length===(spaceOf(before.config,id).stairs||[]).length+1),placed=spaceOf(saved,id).stairs.at(-1);
  expect(placed.kind).toBe(kind);const drawn=await signature(host.locator('.hp-stairs-layer > '+hp('stair',{id:placed.id})));
  for(const key of['outline','treads']){const nums=s=>(s.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)||[]).map(Number),a=nums(shown[key]),b=nums(drawn[key]);expect(b.length).toBe(a.length);for(let i=0;i<a.length;i++)expect(Math.abs(a[i]-b[i])).toBeLessThan(.000002);}
  await page.keyboard.press('Control+z');await expect.poll(async()=>spaceOf((await planConfig()).config,id).stairs||[]).toEqual(spaceOf(before.config,id).stairs||[]);await page.keyboard.press('Control+Shift+z');await expect.poll(async()=>spaceOf((await planConfig()).config,id).stairs).toEqual(spaceOf(saved,id).stairs);
  const point=await pointerFree(host);await page.mouse.move(point.x,point.y);await expect(preview(host)).toHaveCount(1);const cancel=await planConfig();
  await page.mouse.down();await page.mouse.move(point.x+30,point.y+25,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();await settle(host);
  expect((await planConfig()).config).toEqual(cancel.config);await expect(preview(host)).toHaveCount(0);
  await page.mouse.move(point.x-10,point.y-10);await expect(preview(host)).toHaveCount(1);await page.keyboard.press('Escape');await expect(preview(host)).toHaveCount(0);
  await useTool(host,'select');const free=await pointerFree(host);await page.mouse.click(free.x,free.y);await settle(host);const camera=await stage(host).getAttribute('viewBox');
  await page.mouse.move(free.x-25,free.y-20);await settle(host);expect(await stage(host).getAttribute('viewBox')).toBe(camera);
  await arm(kind);await page.mouse.move(free.x,free.y);await expect(preview(host)).toHaveCount(1);await leaveEditor(host);await expect(preview(host)).toHaveCount(0);await enterEditor(host,'plan');
  await page.reload();await expect(card(page).locator(HP.ready)).toBeVisible({timeout:60000});await selectSpace(host,id);expect(spaceOf((await planConfig()).config,id).stairs).toEqual(spaceOf(saved,id).stairs);
  await enterEditor(host,'plan');await evidence(info,page,'185-stair-'+kind+'-reloaded');
 }
});
test('Shift rotation is absolute 45 degrees for all decor families and backdrop with one history action',async({page},info)=>{
 test.setTimeout(360000);await page.setViewportSize({width:1600,height:1000});const seed=(await planConfig()).config.spaces.find(s=>s.plan_url);expect(seed?.plan_url).toBeTruthy();let asset;
 for(const kind of ['rect','ellipse','text','furniture','image','backdrop']){
  const{host,id}=await annex(page,'1.85 rotation '+kind);await leaveEditor(host);await enterEditor(host,'decor');
  if(kind==='image'){
   await useTool(host,'image');await host.locator(hp('image-upload',{kind:'decor'})).setInputFiles(new URL('../fixtures/images/e2e-tile.png',import.meta.url).pathname);
   await expect(host.locator(HP.action('image-palette-select')).first()).toBeVisible();const at=await pointerFree(host);await page.mouse.click(at.x,at.y);
   const saved=await waitForConfig(c=>spaceOf(c,id).decor?.some(d=>d.kind==='image'));asset=spaceOf(saved,id).decor.find(d=>d.kind==='image').asset_id;
  }
  await updateSpace(id,s=>{
   if(kind==='backdrop')Object.assign(s,{plan_url:seed.plan_url,plan_x:0,plan_y:0,plan_scale_x:1,plan_scale_y:1,plan_angle:17});
   else s.decor=[{id:'rotate185',kind,x:.4,y:.4,w:.2,h:.15,angle:17,color:'#d04632',...(kind==='text'?{text:'Rotate',size:'m',scale:1}:{}),...(kind==='furniture'?{symbol:'sofa'}:{}),...(kind==='image'?{asset_id:asset}:{})}];
  });
  await page.reload();await expect(card(page).locator(HP.ready)).toBeVisible({timeout:60000});await selectSpace(host,id);await enterEditor(host,'decor');
  const angle=async()=>{const s=spaceOf((await planConfig()).config,id);return kind==='backdrop'?s.plan_angle:s.decor.find(d=>d.id==='rotate185').angle;};
  const select=async()=>{if(kind==='backdrop')await useTool(host,'backdrop');else{await useTool(host,'select');await page.keyboard.press('Control+a');}await settle(host);};
  await select();const box=await stage(host).boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);for(let z=0;z<8;z++){await page.mouse.wheel(0,120);await settle(host);}const frame=host.locator(kind==='backdrop'?'.bdframe':'.dtframe').last(),handle=frame.locator('.dtrot');await expect(handle).toBeVisible();
  const shown=()=>frame.evaluate(n=>Number(n.getAttribute('transform').match(/rotate\(([^ ,]+)/)[1]));
  const gesture=async(delta)=>{
   const start=await centreOf(handle),pivot=await frame.evaluate(n=>{const a=n.getAttribute('transform').match(/rotate\(([^)]+)\)/)[1].split(/[ ,]+/).map(Number);const p=new DOMPoint(a[1],a[2]).matrixTransform(n.getScreenCTM());return{x:p.x,y:p.y};});
   const a=delta*Math.PI/180,v={x:start.x-pivot.x,y:start.y-pivot.y},end={x:pivot.x+v.x*Math.cos(a)-v.y*Math.sin(a),y:pivot.y+v.x*Math.sin(a)+v.y*Math.cos(a)};
   await handle.hover();await expect(handle).toBeVisible();await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:8});
  };
  await gesture(12.3);if(['furniture','image'].includes(kind))await expect.poll(shown).not.toBe(17);else await expect.poll(shown).toBe(30);const normal=await shown();if(['furniture','image'].includes(kind))expect(normal%5).not.toBe(0);
  expect(await angle()).toBe(17);await page.keyboard.down('Shift');await expect.poll(shown).toBe(45);expect(await angle()).toBe(17);
  await page.keyboard.up('Shift');await expect.poll(shown).toBe(normal);await page.keyboard.down('Shift');await expect.poll(shown).toBe(45);await page.mouse.up();await page.keyboard.up('Shift');await expect.poll(angle).toBe(45);
  await page.keyboard.press('Control+z');await expect.poll(angle).toBe(17);await page.keyboard.press('Control+Shift+z');await expect.poll(angle).toBe(45);
  await select();const before=await planConfig();await gesture(20);await page.keyboard.down('Shift');await page.keyboard.press('Escape');await page.mouse.up();await page.keyboard.up('Shift');await settle(host);expect((await planConfig()).config).toEqual(before.config);
  await page.reload();await expect(card(page).locator(HP.ready)).toBeVisible({timeout:60000});await selectSpace(host,id);expect(await angle()).toBe(45);await evidence(info,page,'185-rotation-'+kind);
 }
});