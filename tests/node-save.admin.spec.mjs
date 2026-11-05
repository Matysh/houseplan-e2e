// #1305/#1306 real HA node writer; no card-private fields or synthetic ACK.
import {test,expect} from '@playwright/test';
import {isDeepStrictEqual as equal} from 'node:util';
import {hp,HP} from './lib/hooks.mjs';
import {requireHooks} from './lib/contract.mjs';
import {planConfig,waitForConfig} from './lib/ha-ws.mjs';
import {restoreSeedAfterEach} from './lib/seed-guard.mjs';
import {installFixture,history,settledViewport} from './lib/beta4-regressions.mjs';
import {useTool,toClient,centreOf,action,enterEditor} from './lib/plan.mjs';
import {card} from './lib/ha-page.mjs';
import {holdConfigReply} from './lib/held-config-reply.mjs';

requireHooks(test,'wall-node@data-node','wall-node-layer','stage','action','zoom-out','node-context-menu');
restoreSeedAfterEach(test);
test.beforeEach(async()=>test.skip((await planConfig()).wall_node_merge_api!==1,'requires node merge capability; skip is not evidence'));
const point=p=>p[0]==='l'?[Number(p[1])/240,Number(p[2])/240]:[Number(p[1])/Number(p[2]),Number(p[3])/Number(p[4])];
const node=(config,p)=>{const n=config.spaces[0].plan_graph.nodes.find(n=>point(n.p).every((v,i)=>Math.abs(v-p[i])<1e-10));expect(n).toBeTruthy();return n;};
const handle=(host,id)=>host.locator(hp('wall-node',{'data-node':id}));
async function frameNodes(host){
  const nodes=host.locator(hp('wall-node'));
  await expect(nodes.first()).toBeVisible();
  for(let step=0;step<10;step++){
    const box=await host.locator(HP.stage??hp('stage')).first().boundingBox();
    const inside=box&&await nodes.evaluateAll((items,b)=>items.length>0&&items.every(item=>{
      const r=item.getBoundingClientRect();return r.left>=b.x+16&&r.top>=b.y+16&&r.right<=b.x+b.width-16&&r.bottom<=b.y+b.height-16;
    }),box);
    if(inside)return;
    await host.locator(hp('zoom-out')).first().click();await settledViewport(host);
  }
  throw Error('fixture nodes did not fit the visible stage through native zoom controls');
}

async function drag(page,host,source,target,{offset=0,merge=false}={}){
  await expect(handle(host,source).first()).toBeInViewport({ratio:1});
  if(typeof target==='string')await expect(handle(host,target).first()).toBeInViewport({ratio:1});
  const from=await centreOf(handle(host,source).first()),to=typeof target==='string'?await centreOf(handle(host,target).first()):await toClient(host,target[0]*1000,target[1]*1000);
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x+offset,to.y,{steps:8});
  if(merge)await expect.poll(async()=>{const box=await handle(host,source).last().boundingBox();return box?Math.hypot(box.x+box.width/2-to.x,box.y+box.height/2-to.y):Infinity;}).toBeLessThan(1);
  await page.mouse.up();
}
async function pending(page,host,hold,source,target,options={}){
  const reached=hold.arm({command:'houseplan/wall/node_move',staleRevision:!!options.staleRevision});
  await drag(page,host,source,target,options);
  await expect.poll(()=>!!hold.pending?.reply,{message:'real HA node writer reply reached'}).toBe(true);
  const result=await reached;
  expect(result.request.type).toBe('houseplan/wall/node_move');
  await expect(action(host,'geometry-undo')).toBeDisabled();
  return result;
}
async function reload(page){await page.reload();const host=card(page);await expect(host.locator(HP.ready)).toBeVisible();return host;}

test('ordinary node save and independent merge wait for real ACK and retain exact history across spaces',async({page})=>{
  const hold=await holdConfigReply(page);let host=await installFixture(page,'node-save-independent');await frameNodes(host);await useTool(host,'select');
  const before=(await planConfig()).config,source=node(before,[.2,.2]).id,target=node(before,[.5,.5]).id,hidden=structuredClone(before.spaces[1]);
  try{
    const reply=await pending(page,host,hold,source,[.25,.3]);expect(reply.reply.success).toBe(true);hold.release();
    const ordinary=await waitForConfig(c=>c.spaces[0].plan_graph.nodes.some(n=>n.id===source&&equal(n.p,['l','60','72'])));
    await expect(action(host,'geometry-undo')).toBeEnabled();expect(ordinary.spaces[1]).toEqual(hidden);
    await history(host,'undo');await waitForConfig(c=>equal(c,before));
    await history(host,'redo');await waitForConfig(c=>equal(c,ordinary));
    await history(host,'undo');await waitForConfig(c=>equal(c,before));
    const mergedReply=await pending(page,host,hold,source,target,{offset:8,merge:true});expect(mergedReply.reply.success).toBe(true);hold.release();
    const merged=await waitForConfig(c=>!c.spaces[0].plan_graph.nodes.some(n=>n.id===source));
    expect(merged.spaces[0].plan_graph.nodes.find(n=>n.id===target).p).toEqual(['l','120','120']);
    expect(merged.spaces[0].plan_graph.edges.filter(e=>e.from===target||e.to===target)).toHaveLength(2);
    expect(merged.spaces[1]).toEqual(hidden);
    await history(host,'undo');await waitForConfig(c=>equal(c,before));
    await history(host,'redo');await waitForConfig(c=>equal(c,merged));
    host=await reload(page);expect((await planConfig()).config).toEqual(merged);
    expect(hold.writes.filter(w=>w.type==='houseplan/config/set')).toHaveLength(0);
  }finally{if(hold.pending?.release)hold.release();}
});

test('adjacent merge removes its connecting edge atomically and stale CAS cannot enter history',async({page})=>{
  const hold=await holdConfigReply(page);const host=await installFixture(page,'node-save-adjacent');await frameNodes(host);await useTool(host,'select');
  const before=(await planConfig()).config,source=node(before,[.5,.2]).id,target=node(before,[.8,.2]).id;
  const connecting=before.spaces[0].plan_graph.edges.find(e=>[e.from,e.to].includes(source)&&[e.from,e.to].includes(target));expect(connecting).toBeTruthy();
  try{
    const refused=await pending(page,host,hold,source,target,{offset:8,merge:true,staleRevision:true});
    expect(refused.reply.success).toBe(false);expect(refused.reply.errorCode).toBe('conflict');hold.release();
    await expect(host.locator(hp('toast')).last()).toBeVisible();expect((await planConfig()).config).toEqual(before);
    await expect(action(host,'geometry-undo')).toBeDisabled();
    // A fresh page/session avoids judging a still-retiring refusal gesture.
    const current=await reload(page);await enterEditor(current,'plan');await frameNodes(current);await useTool(current,'select');await settledViewport(current);
    const accepted=await pending(page,current,hold,source,target,{offset:8,merge:true});expect(accepted.reply.success).toBe(true);hold.release();
    const after=await waitForConfig(c=>!c.spaces[0].plan_graph.nodes.some(n=>n.id===source));
    expect(after.spaces[0].plan_graph.edges.some(e=>e.id===connecting.id&&e.kind===connecting.kind)).toBe(false);
    await history(current,'undo');await waitForConfig(c=>equal(c,before));
    await history(current,'redo');await waitForConfig(c=>equal(c,after));
    await reload(page);expect((await planConfig()).config).toEqual(after);
  }finally{if(hold.pending?.release)hold.release();}
});

test('unsafe foreign contact refuses the whole node gesture without a write',async({page})=>{
  const hold=await holdConfigReply(page),host=await installFixture(page,'node-save-foreign');await frameNodes(host);await useTool(host,'select');
  const before=(await planConfig()).config,source=node(before,[.2,.2]).id,target=node(before,[.5,.5]).id,count=hold.writes.length;
  await drag(page,host,source,target,{offset:8,merge:true});
  await expect(host.locator(hp('toast')).last()).toBeVisible();
  await expect(action(host,'geometry-undo')).toBeDisabled();
  expect((await planConfig()).config).toEqual(before);expect(hold.writes.length).toBe(count);
});


test('painted node edge at high zoom moves only that endpoint and opens its menu without a write on cancel', async ({page}) => {
  const hold=await holdConfigReply(page),host=await installFixture(page,'node-save-independent');
  await frameNodes(host);await useTool(host,'select');
  const before=(await planConfig()).config,source=node(before,[.5,.5]).id;
  const geometry=()=>handle(host,source).first().evaluate(h=>{
    const root=h.getRootNode(),x=Number(h.getAttribute('cx')),y=Number(h.getAttribute('cy'));
    const marker=[...root.querySelectorAll('.plan-snap-node')].find(n=>Math.abs(Number(n.getAttribute('cx'))-x)<1e-6&&Math.abs(Number(n.getAttribute('cy'))-y)<1e-6);
    if(!marker)throw Error('painted source endpoint is absent');
    const m=marker.getScreenCTM(),p=new DOMPoint(x,y).matrixTransform(m);
    return{x:p.x,y:p.y,r:Number(marker.getAttribute('r'))*Math.hypot(m.a,m.b)};
  });
  let g;
  for(let step=0;step<18;step++){
    g=await geometry();if(g.r>14)break;
    await page.mouse.move(g.x,g.y);await page.mouse.wheel(0,-120);await settledViewport(host);
  }
  expect(g.r,'the painted edge must exceed the old 12px picker').toBeGreaterThan(14);
  const fixed=await host.locator(hp('wall-node')).evaluateAll(items=>items.map(h=>{const r=h.getBoundingClientRect();return{id:h.dataset.node,x:r.x+r.width/2,y:r.y+r.height/2};}));
  const edge={x:g.x+g.r+.25,y:g.y},stageBox=await host.locator(HP.stage??hp('stage')).first().boundingBox();
  expect(stageBox).toBeTruthy();expect(edge.x).toBeGreaterThan(stageBox.x);expect(edge.x).toBeLessThan(stageBox.x+stageBox.width);expect(edge.y).toBeGreaterThan(stageBox.y);expect(edge.y+60).toBeLessThan(stageBox.y+stageBox.height);
  await page.mouse.move(edge.x,edge.y);await page.mouse.down();await page.mouse.move(g.x+40,g.y+60,{steps:8});
  await expect.poll(async()=>{const p=await centreOf(handle(host,source).last());return Math.hypot(p.x-g.x,p.y-g.y);}).toBeGreaterThan(8);
  for(const n of fixed.filter(n=>n.id!==source)){
    const p=await centreOf(handle(host,n.id).first());expect(Math.hypot(p.x-n.x,p.y-n.y),'the wall body must not move the other endpoint').toBeLessThan(1);
  }
  await page.keyboard.press('Escape');await page.mouse.up();await settledViewport(host);
  expect((await planConfig()).config).toEqual(before);expect(hold.writes).toHaveLength(0);await expect(action(host,'geometry-undo')).toBeDisabled();
  g=await geometry();await page.mouse.click(g.x+g.r+.25,g.y,{button:'right'});
  await expect(host.locator(hp('node-context-menu')).last()).toBeVisible();await page.keyboard.press('Escape');
  expect((await planConfig()).config).toEqual(before);expect(hold.writes).toHaveLength(0);
});
