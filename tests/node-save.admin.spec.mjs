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

requireHooks(test,'wall-node@data-node','wall-node-layer','stage','action');
restoreSeedAfterEach(test);
test.beforeEach(async()=>test.skip((await planConfig()).wall_node_merge_api!==1,'requires node merge capability; skip is not evidence'));
const point=p=>p[0]==='l'?[Number(p[1])/240,Number(p[2])/240]:[Number(p[1])/Number(p[2]),Number(p[3])/Number(p[4])];
const node=(config,p)=>{const n=config.spaces[0].plan_graph.nodes.find(n=>point(n.p).every((v,i)=>Math.abs(v-p[i])<1e-10));expect(n).toBeTruthy();return n;};
const handle=(host,id)=>host.locator(hp('wall-node',{'data-node':id}));
async function drag(page,host,source,target,{offset=0,merge=false}={}){
  const from=await centreOf(handle(host,source).first()),to=typeof target==='string'?await centreOf(handle(host,target).first()):await toClient(host,target[0]*1000,target[1]*1000);
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x+offset,to.y,{steps:8});
  if(merge)await expect.poll(async()=>{const box=await handle(host,source).last().boundingBox();return box?Math.hypot(box.x+box.width/2-to.x,box.y+box.height/2-to.y):Infinity;}).toBeLessThan(1);
  await page.mouse.up();
}
async function pending(page,host,hold,source,target,options={}){
  const reached=hold.arm({command:'houseplan/wall/node_move',staleRevision:!!options.staleRevision});
  await drag(page,host,source,target,options);
  const result=await reached;
  expect(result.request.type).toBe('houseplan/wall/node_move');
  await expect(action(host,'geometry-undo')).toBeDisabled();
  return result;
}
async function reload(page){await page.reload();const host=card(page);await expect(host.locator(HP.ready)).toBeVisible();return host;}

test('ordinary node save and independent merge wait for real ACK and retain exact history across spaces',async({page})=>{
  const hold=await holdConfigReply(page);let host=await installFixture(page,'node-save-independent');await useTool(host,'select');
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
  const hold=await holdConfigReply(page);const host=await installFixture(page,'node-save-adjacent');await useTool(host,'select');
  const before=(await planConfig()).config,source=node(before,[.5,.2]).id,target=node(before,[.8,.2]).id;
  const connecting=before.spaces[0].plan_graph.edges.find(e=>[e.from,e.to].includes(source)&&[e.from,e.to].includes(target));expect(connecting).toBeTruthy();
  try{
    const refused=await pending(page,host,hold,source,target,{offset:8,merge:true,staleRevision:true});
    expect(refused.reply.success).toBe(false);expect(refused.reply.errorCode).toBe('conflict');hold.release();
    await expect(host.locator(hp('toast')).last()).toBeVisible();expect((await planConfig()).config).toEqual(before);
    await expect(action(host,'geometry-undo')).toBeDisabled();
    // A fresh page/session avoids judging a still-retiring refusal gesture.
    const current=await reload(page);await enterEditor(current,'plan');await useTool(current,'select');await settledViewport(current);
    const accepted=await pending(page,current,hold,source,target,{offset:8,merge:true});expect(accepted.reply.success).toBe(true);hold.release();
    const after=await waitForConfig(c=>!c.spaces[0].plan_graph.nodes.some(n=>n.id===source));
    expect(after.spaces[0].plan_graph.edges.some(e=>e.id===connecting.id&&e.kind===connecting.kind)).toBe(false);
    await history(current,'undo');await waitForConfig(c=>equal(c,before));
    await history(current,'redo');await waitForConfig(c=>equal(c,after));
    await reload(page);expect((await planConfig()).config).toEqual(after);
  }finally{if(hold.pending?.release)hold.release();}
});

test('unsafe foreign contact refuses the whole node gesture without a write',async({page})=>{
  const hold=await holdConfigReply(page),host=await installFixture(page,'node-save-foreign');await useTool(host,'select');
  const before=(await planConfig()).config,source=node(before,[.2,.2]).id,target=node(before,[.5,.5]).id,count=hold.writes.length;
  await drag(page,host,source,target,{offset:8,merge:true});
  await expect(host.locator(hp('toast')).last()).toBeVisible();
  await expect(action(host,'geometry-undo')).toBeDisabled();
  expect((await planConfig()).config).toEqual(before);expect(hold.writes.length).toBe(count);
});
