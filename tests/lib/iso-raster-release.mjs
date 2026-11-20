// #88 / product #1485/#1486. Real HA and real wheel input; only the isolated
// loopback seed is changed. The observer forwards SVG URLs unchanged.
import {expect} from '@playwright/test';
import {HA_URL} from '../../scripts/users.mjs';
import {installedRecord} from './contract.mjs';
import {callService,getState,waitForState} from './ha-api.mjs';
import {card,deviceMarker,expectPlanDrawn,evidence} from './ha-page.mjs';
import {importDocument,planConfig,snapshotPlan,spaceOf,wsCall} from './ha-ws.mjs';
import {stage,selectSpace,settle} from './plan.mjs';
import {pair,watchWrites} from './beta4-regressions.mjs';

export async function checkReleaseRaster(page,info){
  const version=installedRecord()?.version;
  if(version&&Number(version.split('.')[0])===1&&Number(version.split('.')[1])<86){
    await info.attach('raster-release-not-applicable',{body:`#1485/#1486 release journey starts at 1.86.0-beta.1, installed ${version}`,contentType:'text/plain'});
    return;
  }
  expect(['localhost','127.0.0.1','[::1]']).toContain(new URL(HA_URL).hostname);
  const saved=await snapshotPlan(),lamp='light.wall_lamp_1',originalLight=await getState(lamp);
  const writes=watchWrites(page),services=[];
  page.on('websocket',socket=>socket.on('framesent',frame=>{
    let value;try{value=JSON.parse(String(frame.payload));}catch{return;}
    if(value.type==='call_service')services.push(value.domain+'.'+value.service);
  }));
  try{
    const current=await planConfig(),config=structuredClone(current.config),floor=spaceOf(config,'f1');
    expect(floor.plan_url,'the real seed must retain an installed floor-plan image').toBeTruthy();
    floor.settings={...floor.settings,show_borders:true,room_color:'#481477',room_opacity:1,
      wall_fill:{c:'#246844',a:1},opening_accent_3d:{c:'#a32a59',a:1}};
    config.settings={...config.settings,volumetric_view:true};
    await wsCall({type:'houseplan/config/set',config,expected_rev:current.rev,
      furniture_workstation_api:1,opening_features_api:1});
    await page.addInitScript(()=>{
      document.addEventListener('DOMContentLoaded',()=>document.documentElement.style.setProperty(
        '--wa-form-control-padding-inline','12px@layer wa-utilities{@supports (scrollbar-gutter:'),{once:true});
      window.__releaseRasterSources=[];
      const create=URL.createObjectURL;
      URL.createObjectURL=function(blob){
        if(blob.type.includes('image/svg+xml'))void blob.text().then(xml=>{
          const doc=new DOMParser().parseFromString(xml,'image/svg+xml'),group=doc.querySelector('g.stage');
          if(!group)return;
          window.__releaseRasterSources.push({
            materials:Object.fromEntries([...group.style].filter(n=>n.startsWith('--iso-')).map(n=>[n,group.style.getPropertyValue(n)])),
            unrelated:group.style.getPropertyValue('--wa-form-control-padding-inline'),
            images:[...doc.querySelectorAll('image')].map(el=>el.getAttribute('href')),
          });
        });
        return create.call(this,blob);
      };
    });
    await page.setViewportSize({width:1408,height:952});
    await page.goto('/houseplan');const host=card(page);await expectPlanDrawn(page,host);await selectSpace(host,'f1');
    await expect(stage(host)).toHaveAttribute('data-projection','iso');await settle(host);
    expect(await page.evaluate(()=>innerWidth*innerHeight*devicePixelRatio**2),'the whole window is below the old 6M cutoff').toBeLessThan(6000000);
    const truth=await pair(),writeCount=writes.length;
    await expect.poll(()=>page.evaluate(()=>window.__releaseRasterSources.length),{timeout:60000}).toBeGreaterThan(0);
    const samples=[];
    for(const direction of [1,-1]){
      const observing=stage(host).evaluate(async svg=>{
        const root=svg.getRootNode(),end=performance.now()+3500;
        let active=0,coloured=0,maxArea=0,vectorChanges=0,view=svg.getAttribute('viewBox');
        const observer=new MutationObserver(()=>{const next=svg.getAttribute('viewBox');if(next!==view){vectorChanges++;view=next;}});
        observer.observe(svg,{attributes:true,attributeFilter:['viewBox']});
        try{
          while(performance.now()<end){
            // Read the rendered canvas and its composited SVG surface, not
            // private card/camera fields or a synthetic readiness flag.
            if(getComputedStyle(svg.parentElement).opacity==='0'){
              for(const canvas of root.querySelectorAll('canvas')){
                const box=canvas.getBoundingClientRect();
                if(!box.width||!box.height||getComputedStyle(canvas).opacity==='0')continue;
                active++;maxArea=Math.max(maxArea,box.width*box.height*devicePixelRatio**2);
                if(!coloured){
                  const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;
                  const ctx=copy.getContext('2d');ctx.drawImage(canvas,0,0);
                  const p=ctx.getImageData(0,0,copy.width,copy.height).data;
                  for(let i=0;i<p.length;i+=4)if(p[i+3]===255&&[36,104,68].every((c,j)=>Math.abs(c-p[i+j])<10))coloured++;
                }
              }
            }
            await new Promise(resolve=>setTimeout(resolve,30));
          }
        }finally{observer.disconnect();}
        return{active,coloured,maxArea,vectorChanges};
      });
      const box=await stage(host).boundingBox();await page.mouse.move(box.x+box.width*.75,box.y+box.height*.72);
      let lightUpdate;
      for(let i=0;i<12;i++){
        await page.mouse.wheel(0,direction*100);
        if(direction===1&&i===3)lightUpdate=callService('light',originalLight.state==='on'?'turn_off':'turn_on',{entity_id:lamp});
        await page.waitForTimeout(100);
      }
      await lightUpdate;
      const result=await observing;
      expect(result.active,'real HA panel must show a bitmap during wheel').toBeGreaterThan(0);
      expect(result.coloured,'the actual bitmap retains opaque coloured wall pixels').toBeGreaterThan(30);
      samples.push({direction,...result});
      await settle(host);
      await expect.poll(()=>stage(host).evaluate(svg=>getComputedStyle(svg.parentElement).opacity)).toBe('1');
    }
    const sources=await page.evaluate(()=>window.__releaseRasterSources);
    expect(sources.length).toBeGreaterThan(0);
    for(const source of sources){
      expect(source.materials['--iso-side-mid']).toBe('#246844');
      expect(source.materials['--iso-top-hi']).toBe('#481477');
      expect(source.materials['--iso-wall-side-op']).toBe('1');
      expect(source.materials['--iso-opening-leaf']).toBeTruthy();
      expect(source.unrelated).toBe('');
      expect(source.images.length).toBeGreaterThan(0);
      expect(source.images.every(href=>href?.startsWith('data:image/'))).toBe(true);
    }
    const newLight=originalLight.state==='on'?'off':'on';await waitForState(lamp,newLight);
    await expect(deviceMarker(host,lamp)).toHaveAttribute('data-state',newLight==='on'?'working':'neutral');
    expect(await pair()).toEqual(truth);
    expect(writes.slice(writeCount)).toEqual([]);expect(services).toEqual([]);
    await evidence(info,page,'iso-raster-after-real-wheel');
    await info.attach('iso-raster-real-ha.json',{body:JSON.stringify({version,samples,sources:sources.length,storedPairUnchanged:true},null,2),contentType:'application/json'});
  }finally{
    await page.goto('about:blank');
    await callService('light',originalLight.state==='on'?'turn_on':'turn_off',{entity_id:lamp});
    await importDocument(saved.document,{confirmMissingContent:true});
  }
}
