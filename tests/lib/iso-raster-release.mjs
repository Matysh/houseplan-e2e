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

// A settled, painted canvas beside the declared plan stage witnesses the
// live 3D renderer. The old gesture-only raster does not occupy this surface.
// Test the actual visible output; a canvas element alone can be blank.
export function liveFrame(svg,{green=true}={}) {
  // The 3D canvas sits beside the scene wrapper, not inside its hit SVG.
  for(const source of svg.parentElement.parentElement.children){
    if(!(source instanceof HTMLCanvasElement)||!source.width||!source.height)continue;
    const rect=source.getBoundingClientRect(),style=getComputedStyle(source);
    if(!rect.width||!rect.height||style.visibility==='hidden'||style.display==='none'||Number(style.opacity)===0)continue;
    const small=document.createElement('canvas');
    small.width=160;small.height=Math.max(1,Math.round(160*source.height/source.width));
    const ctx=small.getContext('2d');ctx.drawImage(source,0,0,small.width,small.height);
    const data=ctx.getImageData(0,0,small.width,small.height).data;
    let wall=0,painted=0,signature=0;
    for(let i=0;i<data.length;i+=4){
      if(data[i+3]>=246&&data[i+1]>data[i]+12&&data[i+1]>data[i+2]+8)wall++;
      if(data[i+3]>=246)painted++;
      signature=(Math.imul(signature,31)+data[i]+3*data[i+1]+5*data[i+2]+7*data[i+3])|0;
    }
    if((green?wall:painted)>30)return {wall,painted,signature,view:svg.getAttribute('viewBox'),size:[source.width,source.height]};
  }
  return null;
}

export async function observeNativeWheel(host,options={}){
  const frames=[];
  const until=Date.now()+3500;
  while(Date.now()<until){
    const frame=await stage(host).evaluate(liveFrame,options);
    if(frame)frames.push(frame);
    await new Promise(resolve=>setTimeout(resolve,45));
  }
  return {active:frames.length,coloured:Math.max(0,...frames.map(frame=>frame.wall)),
    vectorChanges:new Set(frames.map(frame=>frame.view)).size,paints:new Set(frames.map(frame=>frame.signature)).size};
}

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
    // The seed stores the installed image on a different floor. Reuse that
    // real HA asset on the measured floor, without creating or mocking one.
    const backdrop=config.spaces.find(space=>space.plan_url);
    expect(backdrop?.plan_url,'the real seed must retain an installed floor-plan image').toBeTruthy();
    floor.plan_url=backdrop.plan_url;
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
    let renderer;
    await expect.poll(async()=>{
      renderer=await stage(host).evaluate(liveFrame)?'webgl'
        :await page.evaluate(()=>window.__releaseRasterSources.length)?'svg-raster':null;
      return renderer;
    },{timeout:60000,message:'the settled HA floor must paint a coloured live 3D canvas or build the legacy gesture raster'}).toBeTruthy();
    const samples=[];
    for(const direction of [1,-1]){
      const observing=renderer==='webgl'?observeNativeWheel(host):stage(host).evaluate(async svg=>{
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
      expect(result.active,'real HA panel must paint during wheel').toBeGreaterThan(0);
      expect(result.coloured,'the visible output retains opaque coloured wall pixels').toBeGreaterThan(30);
      if(renderer==='webgl'){
        expect(result.vectorChanges,'the live plan responds to wheel input').toBeGreaterThan(1);
        expect(result.paints,'the canvas must repaint as the camera changes').toBeGreaterThan(1);
      }
      samples.push({direction,...result});
      await settle(host);
      if(renderer==='webgl'){
        await expect(stage(host)).toHaveAttribute('data-projection','iso');
        await expect.poll(()=>stage(host).evaluate(liveFrame)).toBeTruthy();
      }else await expect.poll(()=>stage(host).evaluate(svg=>getComputedStyle(svg.parentElement).opacity)).toBe('1');
    }
    const sources=await page.evaluate(()=>window.__releaseRasterSources);
    if(renderer==='webgl')expect(sources,'the live renderer needs no legacy SVG bitmap').toEqual([]);
    else expect(sources.length).toBeGreaterThan(0);
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
    await info.attach('iso-raster-real-ha.json',{body:JSON.stringify({version,renderer,samples,sources:sources.length,storedPairUnchanged:true},null,2),contentType:'application/json'});
  }finally{
    await page.goto('about:blank');
    await callService('light',originalLight.state==='on'?'turn_on':'turn_off',{entity_id:lamp});
    await importDocument(saved.document,{confirmMissingContent:true});
  }
}
