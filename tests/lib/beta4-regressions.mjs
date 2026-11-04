import {readFileSync} from 'node:fs';
import {expect} from '@playwright/test';
import {planConfig,planLayout,wsCall,importDocument} from './ha-ws.mjs';
import {openPlan,enterEditor,settle,action} from './plan.mjs';
import {card,expectPlanDrawn} from './ha-page.mjs';
import {HP} from './hooks.mjs';

export const fixture=name=>JSON.parse(readFileSync(new URL('../../fixtures/regressions/'+name+'.json',import.meta.url),'utf8'));
export async function pair(){const[c,l]=await Promise.all([planConfig(),planLayout()]);return{config:c.config,configRev:c.rev,layout:l.layout,layoutRev:l.rev};}
export async function installFixture(page,name){
 const config=fixture(name),exported=await wsCall({type:'houseplan/export/create',kind:'full'});
 const document=structuredClone(exported.document);document.model_version=config.model_version;
 document.payload.config=config;document.payload.layout={};
 // These fixtures contain no placed markers or image references. The seed's
 // manifests describe its own house and cannot accompany a different payload.
 document.placement_manifest=[];document.content_manifest=[];
 await importDocument(document,{confirmMissingContent:true});
 const saved=(await planConfig()).config;
 expect(saved.model_version).toBe(11);
 await page.setViewportSize({width:2000,height:1100});
 let host;
 if(config.spaces[0].rooms.length)host=await openPlan(page);
 else{
  // An intentionally empty wall fixture has a sized ready stage, not rooms yet.
  await page.goto('/houseplan');host=card(page);
  await expect(host.locator(HP.ready)).toBeVisible();await expect(host.locator('[data-hp="stage"]').first()).toBeVisible();
 }
 await enterEditor(host,'plan');await settledViewport(host);return host;
}
export async function settledViewport(host){
 let previous=null,stable=0;
 await expect.poll(async()=>{
  const current=await host.locator(hpStage).first().evaluate(svg=>{const m=svg.getScreenCTM();return[m.a,m.b,m.c,m.d,m.e,m.f,svg.getAttribute('viewBox')];});
  const key=JSON.stringify(current);stable=key===previous?stable+1:0;previous=key;return stable;
 },{timeout:10000,intervals:[100],message:'public plan camera remains settled before native coordinates are sampled'}).toBeGreaterThanOrEqual(5);
}
const hpStage='[data-hp="stage"]';
export function watchWrites(page){
 const writes=[];
 page.on('websocket',socket=>{const sent=[];socket.on('framesent',frame=>{
  let message;try{message=JSON.parse(String(frame.payload));}catch{return;}
  if(/^houseplan\/(?:config|layout)\/(?:set|patch)$/.test(message.type)||/^houseplan\/wall\/node_/.test(message.type)){
   const row={type:message.type,id:message.id};writes.push(row);sent.push(row);
  }
 });socket.on('framereceived',frame=>{
  let decoded;try{decoded=JSON.parse(String(frame.payload));}catch{return;}
  for(const message of Array.isArray(decoded)?decoded:[decoded]){
   const row=sent.find(row=>row.id===message.id);if(row&&message.type==='result')row.reply={success:message.success,error:message.error?.code,message:message.error?.message};
  }
 });});return writes;
}
export async function history(host,direction){const button=action(host,'geometry-'+direction);await expect(button).toBeEnabled();await button.click();await settle(host);}
export async function reloadUnchanged(page,config){await page.reload();await expectPlanDrawn(page,card(page));expect((await planConfig()).config).toEqual(config);return card(page);}
export async function saveRoom(host,name,{expectHidden=true}={}){
 const dialog=host.locator(HP.dialog('room')).first();
 await expect(dialog).toBeVisible();await dialog.locator(HP.field('room-name')).first().fill(name);
 await dialog.locator(HP.dialogConfirm).filter({hasText:/save room/i}).first().click();
 if(expectHidden)await expect(dialog).toBeHidden();
}

/** Geometric oracle for #1264: positive overlap, not just endpoint identity.
 * Split every finite wall record at room-boundary endpoints and count owners
 * on each resulting open interval. No production converter is used here.
 */
export function materialProblems(space){
 const eps=1e-8,edges=space.rooms.flatMap(room=>room.poly.map((a,i)=>({a,b:room.poly[(i+1)%room.poly.length],room:room.id})));
 const intervals=(a,b)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),out=[];
  for(const e of edges){
   const project=p=>((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length;
   const across=p=>Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/length;
   if(across(e.a)>eps||across(e.b)>eps)continue;
   const lo=Math.max(0,Math.min(project(e.a),project(e.b))),hi=Math.min(length,Math.max(project(e.a),project(e.b)));
   if(hi-lo>eps)out.push({lo,hi,room:e.room});
  }return out;
 };
 const hidden=(space.partitions||[]).filter(p=>intervals(p.a,p.b).some(i=>i.hi-i.lo>1/240+eps)).map(p=>p.id);
 const mixed=[];
 for(const wall of space.walls||[]){
  if(!wall.a||!wall.b)continue;
  const spans=intervals(wall.a,wall.b),cuts=[...new Set(spans.flatMap(i=>[i.lo,i.hi]))].sort((a,b)=>a-b),roles=new Set();
  for(let i=1;i<cuts.length;i++){
   if(cuts[i]-cuts[i-1]<eps)continue;const p=(cuts[i]+cuts[i-1])/2;
   const owners=new Set(spans.filter(s=>p>s.lo&&p<s.hi).map(s=>s.room));if(owners.size)roles.add(owners.size);
  }if(roles.has(1)&&roles.has(2))mixed.push(wall.key);
 }
 return{hidden,mixed};
}
