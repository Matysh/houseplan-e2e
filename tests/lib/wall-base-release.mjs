/** #115 / product #1555: actual 2.5D panel paint and raster handoff at DPR 2. */
import { expect } from '@playwright/test';
import { HA_URL } from '../../scripts/users.mjs';
import { compareTags } from '../../scripts/tags.mjs';
import { installedRecord } from './contract.mjs';
import { pair, watchWrites } from './beta4-regressions.mjs';
import { card, evidence, expectPlanDrawn } from './ha-page.mjs';
import { importDocument, planConfig, snapshotPlan, spaceOf, wsCall } from './ha-ws.mjs';
import { selectSpace, settle, stage } from './plan.mjs';
import { hp } from './hooks.mjs';

export async function checkWallBaseRelease(page, info) {
  const version = installedRecord()?.version;
  if (version && compareTags('v'+version,'v1.86.1-beta.9') < 0) return;
  expect(['localhost','127.0.0.1','[::1]']).toContain(new URL(HA_URL).hostname);
  const saved = await snapshotPlan();
  let context;
  try {
    const current = await planConfig(), config = structuredClone(current.config);
    const floor = spaceOf(config,'f1');
    const at = floor.openings.filter(opening => ['window','door'].includes(opening.type));
    // The seed's north wall carries the first door and first window.
    const [door, window] = ['door','window'].map(type => at.find(item => item.type===type));
    expect(door?.angle).toBe(0);
    expect(window?.y).toBe(door?.y);
    expect(floor.walls.length).toBeGreaterThan(0);
    floor.settings = { ...floor.settings, show_borders:true, transparent_walls_3d:true,
      room_opacity:.55, wall_fill:{c:'#516273',a:.38} };
    config.settings = { ...config.settings, volumetric_view:true };
    await wsCall({type:'houseplan/config/set',config,expected_rev:current.rev,
      ...(current.furniture_workstation_api===1?{furniture_workstation_api:1}:{}),
      ...(current.opening_features_api===1?{opening_features_api:1}:{})});
    const truth = await pair();
    context = await page.context().browser().newContext({baseURL:HA_URL,
      storageState:await page.context().storageState(),viewport:{width:684,height:893},deviceScaleFactor:2});
    await context.addInitScript(() => {
      const original = globalThis.createImageBitmap.bind(globalThis);
      globalThis.createImageBitmap = async (...args) => {
        if (globalThis.__wallBaseWaitForBitmap) await new Promise(r=>setTimeout(r,850));
        return original(...args);
      };
    });
    const subject=await context.newPage(), writes=watchWrites(subject);
    const errors=[];
    subject.on('pageerror',error=>errors.push(error.message));
    await subject.goto('/houseplan');
    const host=card(subject);
    await expectPlanDrawn(subject,host);await selectSpace(host,'f1');
    const svg=stage(host);
    await expect(svg).toHaveAttribute('data-projection','iso');
    expect(await subject.evaluate(()=>devicePixelRatio)).toBe(2);
    const walls=host.locator(hp('wall',{kind:'union'}));
    const inspect=()=>walls.evaluateAll((paths,points)=>{
      const contains=({x,y})=>paths.some(path=>path.isPointInFill(new DOMPoint(x*1000,y*1000)));
      return { window: contains(points.window), door: contains(points.door),
        shoulders: points.shoulders.every(contains), paths:paths.map(path=>path.getAttribute('d')) };
    },{window,door,shoulders:[{x:window.x,y:window.y-.003},{x:window.x,y:window.y+.003}]});
    const geometry=await inspect();
    expect(geometry.paths.length).toBeGreaterThan(0);
    expect(geometry).toMatchObject({window:true,door:false,shoulders:true});
    await selectSpace(host,'f2');await selectSpace(host,'f1');
    expect(await inspect()).toEqual(geometry);
    await evidence(info,subject,'iso-wall-base-real-panel');
    // Warm one sharp bitmap at a serious zoom, then zoom out near a corner
    // while new bitmaps decode slowly; observe the actual retained pair.
    const box=await svg.boundingBox();
    await subject.mouse.move(box.x+box.width*.52,box.y+box.height*.56);
    for(let i=0;i<13;i++) {
      await subject.mouse.wheel(0,-100);
      await subject.waitForTimeout(85);
    }
    await settle(host);
    await subject.evaluate(()=>{globalThis.__wallBaseWaitForBitmap=true;});
    const view=await svg.getAttribute('viewBox');
    const record=()=>svg.evaluate(node=>{
      if (getComputedStyle(node.parentElement).opacity!=='0') return null;
      const masks=[...node.getRootNode().querySelectorAll('canvas')].flatMap(canvas=>{
        const style=getComputedStyle(canvas.parentElement);
        return style.maskImage==='none'||!canvas.width||!canvas.height?[]:
          [{image:style.maskImage,operation:style.maskComposite}];
      });
      return masks.find(m=>m.operation.startsWith('subtract'))&&
        masks.find(m=>m.operation.startsWith('intersect')) ? masks : null;
    });
    let split=null;
    for(const [x,y] of [[.87,.66],[.18,.35]]) {
      await subject.mouse.move(box.x+box.width*x,box.y+box.height*y);
      for(let i=0;i<9;i++) {
        await subject.mouse.wheel(0,100);
        await subject.waitForTimeout(60);
        split ??= await record();
        if(split)break;
      }
      if(split)break;
    }
    expect(split,'a genuine detail/overview bitmap pair is visible in the HA panel').not.toBeNull();
    await subject.evaluate(()=>{globalThis.__wallBaseWaitForBitmap=false;});
    await expect.poll(()=>svg.evaluate(node=>getComputedStyle(node.parentElement).opacity)).toBe('1');
    await expect(svg).not.toHaveAttribute('viewBox',view);
    expect(await inspect()).toEqual(geometry);
    expect(await pair()).toEqual(truth);
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
    await info.attach('wall-base-real-ha.json',{body:JSON.stringify({version,dpr:2,split,
      windowContinuous:geometry.window,doorUnfilled:!geometry.door,sameGeometryAfterHandoff:true},null,2),
      contentType:'application/json'});
  } finally {
    await context?.close();
    await importDocument(saved.document,{confirmMissingContent:true});
  }
}
