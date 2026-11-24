import {test, expect, devices} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {HA_URL, USERS} from '../scripts/users.mjs';
import {card, expectPlanDrawn} from './lib/ha-page.mjs';
import {accessToken, getState} from './lib/ha-api.mjs';
import {importDocument, planConfig, snapshotPlan, wsCall} from './lib/ha-ws.mjs';
import {restoreSeedAfterEach} from './lib/seed-guard.mjs';
import {screenDefaults, viewDefaults} from './lib/profile-fixtures.mjs';
import {installedRecord} from './lib/contract.mjs';
import {compareTags} from '../scripts/tags.mjs';

test.beforeEach(() => {
  const version = installedRecord()?.version;
  test.skip(!!version && compareTags('v' + version, 'v1.86.1-beta.2') < 0,
    'Server startup previews first ship in 1.86.1-beta.2; an older release skip is not evidence');
});
restoreSeedAfterEach(test);
const authOnly = () => {
  const state = JSON.parse(readFileSync(USERS.admin.storageState, 'utf8'));
  for (const origin of state.origins) {
    origin.localStorage = origin.localStorage.filter(({name}) => !name.toLowerCase().includes('houseplan') && !name.startsWith('hp:'));
    delete origin.indexedDB;
  }
  return state;
};
const viewport = {width:1440,height:900};
const downlink = (page, hook, latency = 0) => page.routeWebSocket('**/api/websocket', ws => {
  const server = ws.connectToServer();
  const deliver = (route, data) => {
    if(!latency) return route.send(data);
    setTimeout(()=>route.send(data),latency/2);
  };
  ws.onMessage(raw => {
    const message = JSON.parse(String(raw));
    if (hook?.(message, ws)) return;
    deliver(server,raw);
  });
  if(latency) server.onMessage(raw=>deliver(ws,raw));
});
const facts = host => host.evaluate(c => c.houseplanStartupFloorDiagnostics());
const status = host => host.evaluate(c => {
  const selection=c._startupSelection();
  return {facts:c.houseplanStartupFloorDiagnostics(), selection,
    proof:c._startupSourceProof?.revision===selection?.revision,
    remoteInput:{backdrop:!!c._curSpaceCfg?.bg, decor:[...new Set(c._decorList.map(d=>d.kind))],
      contactBasis:Object.values(c._layout).filter(p=>p?.s===c._space&&p?.contact_basis).length,
      placed:c._displayDevices.length,mounted:c._renderDevices.length}};
});
const avoid = new Set(['houseplan/startup_floor/get','houseplan/startup_floor/put']);
const ignore = (message, ws) => {
  if (!avoid.has(message.type)) return false;
  ws.send(JSON.stringify({id:message.id,type:'result',success:true,result:{packet:null,stored:false}}));
  return true;
};

async function setHouse(projection, rotation, profile, centered = profile) {
  const current = await planConfig(), config = structuredClone(current.config);
  const floor = config.spaces.find(s => s.id === 'f1');
  floor.decor.push(
    {id:'t1522-tv',kind:'furniture',symbol:'tv',x:.28,y:.29,w:.09,h:.03,color:'#ab4e72',angle:15},
    {id:'t1522-cabinet',kind:'furniture',symbol:'cabinet_tv',x:.25,y:.275,w:.15,h:.06,color:'#627783'},
  );
  config.settings.volumetric_view = projection === 'iso';
  if (profile) {
    const row = {...screenDefaults(2),default_view:{...viewDefaults(),view:projection,rotation,
      ...(centered?{center_summary:true,summary:'show'}:{})}};
    config.settings.external_screens = {version:3,next_id:3,screens:[row]};
  }
  await wsCall({type:'houseplan/config/set',config,expected_rev:current.rev,
    opening_features_api:1,furniture_workstation_api:1});
}

function measure(root, elements) {
  const rect = root.getBoundingClientRect();
  const p = root.createSVGPoint();
  return {
    viewBox:root.getAttribute('viewBox').trim().split(/[ ,]+/).map(Number),
    size:[rect.width,rect.height],
    samples:elements.map(el => {
      const box=el.getBBox(), matrix=el.getScreenCTM();
      p.x=box.x+box.width/2; p.y=box.y+box.height/2;
      const q=p.matrixTransform(matrix);
      const style=getComputedStyle(el), hatch=style.fill.includes('hp-wall-hatch');
      return [el.tagName,el.getAttribute('d')??el.getAttribute('points'),q.x-rect.x,q.y-rect.y,
        parseFloat(style.strokeWidth),hatch?'hatch':style.fill==='none'?'none':'painted',
        style.stroke!=='none', style.vectorEffect==='non-scaling-stroke'];
    }),
  };
}

const sample = async (host, preview) => host.evaluate(async (c, {preview,measureSource}) => {
  const measure = (0,eval)('('+measureSource+')');
  const stage = c.shadowRoot.querySelector('.stage');
  const live = stage.querySelector('svg.plan-svg');
  const work = root => {
    const drawn = [...root.querySelectorAll('path,polygon')];
    const chroma = el => {
      const resolved=getComputedStyle(el), color=(resolved.fill+' '+resolved.stroke).toLowerCase();
      return color==='#ab4e72' || color==='#627783' || color.includes('171, 78, 114') || color.includes('98, 119, 131');
    };
    const furniture=drawn.filter(chroma);
    const shape=el=>el.hasAttribute('d')||el.hasAttribute('points');
    return {all:drawn.filter(shape),furniture};
  };
  if (!preview) {
    const found=work(live);
    const byId = Object.fromEntries(['t1522-tv','t1522-cabinet'].map(id => [id, measure(live, found.all
      .filter(el=>!!el.closest('[data-hp="decor"][data-id="'+id+'"]'))).samples]));
    return {zoom:c._zoom, anchors:measure(live, found.all), furniture:byId,
      walls:measure(live,[...live.querySelectorAll('.wallbodies path.wallbody')]).samples};
  }
  const img = stage.querySelector('img[data-hp-startup-source="server"]');
  const box = img.getBoundingClientRect(), xml = await (await fetch(img.src)).text();
  const parsed = new DOMParser().parseFromString(xml,'image/svg+xml').documentElement;
  const root = document.importNode(parsed,true);
  const holder = document.createElement('div');
  holder.style.cssText='position:fixed;left:0;top:0;opacity:0;pointer-events:none';
  root.setAttribute('width',String(box.width)); root.setAttribute('height',String(box.height));
  holder.append(root); document.body.append(holder);
  try {
    const found=work(root);
    return {zoom:c._startupStyle.value.zoom, anchors:measure(root,found.all),furniture:measure(root,found.furniture).samples, xml};
  } finally { holder.remove(); }
}, {preview,measureSource:String(measure)});

async function checkScene(browser, projection, rotation, profile, testInfo) {
  expect(new URL(HA_URL).hostname).toBe('127.0.0.1');
  await setHouse(projection,rotation,profile);
  const path = profile ? '/houseplan?hpprofile=2&hpspace=1' : '/houseplan';
  const warm = await browser.newContext({storageState:authOnly(),baseURL:HA_URL,viewport});
  let put;
  try {
    const page = await warm.newPage();
    await downlink(page, message => { if(message.type.endsWith('/put')) put=message; return false; });
    await page.goto(path,{waitUntil:'domcontentloaded'});
    const host=card(page);
    await expectPlanDrawn(page,host);
    await expect.poll(async()=> (await facts(host))?.remote,
      {timeout:10_000,message:JSON.stringify(await status(host))}).toBe('stored');
  } finally { await warm.close(); }
  expect(put).toBeTruthy();
  const key=(({id,type,packet,...a})=>a)(put);
  expect(key.rotation).toBe(rotation);
  const get = {type:'houseplan/startup_floor/get',...key};
  expect((await wsCall(get)).packet).toBe(put.packet);
  expect((await wsCall(get,'viewer')).packet).toBeNull();
  expect((await wsCall({...get,source:['a'.repeat(64),key.source[1]]})).packet).toBeNull();
  const data=[];
  for (const [name, geometry, reducedMotion] of [['desktop',{viewport},'reduce'],
    ['phone',devices['Pixel 7'],'no-preference']]) {
    const ref = await browser.newContext({...geometry,storageState:authOnly(),baseURL:HA_URL,reducedMotion});
    let expected;
    try {
      const page = await ref.newPage();
      await downlink(page,ignore);
      await page.goto(path,{waitUntil:'domcontentloaded'});
      const host=card(page);
      await expectPlanDrawn(page,host);
      expected=await sample(host,false);
    } finally { await ref.close(); }
    const candidate=await browser.newContext({...geometry,storageState:authOnly(),baseURL:HA_URL,reducedMotion});
    try {
      const page=await candidate.newPage();
      let request;
      await downlink(page,message => { if(message.type.endsWith('/get')&&message.type.includes('startup_floor')) request=message; return false; });
      await page.route('**/floor-worker-*.js',async route=>{
        await new Promise(resolve=>setTimeout(resolve,2_400));
        await route.continue();
      });
      await page.goto(path,{waitUntil:'domcontentloaded'});
      const host=card(page);
      const img=host.locator('img[data-hp-startup-source="server"]');
      try { await expect(img).toBeVisible({timeout:12_000}); }
      catch (err) {
        err.message += '\n' + JSON.stringify({name,status:await status(host),
          requested:request?.variant,warmed:key.variant});
        throw err;
      }
      const preview=await sample(host,true);
      expect(request.variant).toBe(key.variant);
      expect(preview.xml).not.toMatch(/houseplan\/content|<image|<text|data-hp-live|<script/);
      const precise = numbers => numbers.map(n=>Math.round(n*1e9));
      expect(precise(preview.anchors.viewBox)).toEqual(precise(expected.anchors.viewBox));
      expect(precise([preview.zoom])).toEqual(precise([expected.zoom]));
      expect(preview.anchors.size).toEqual(expected.anchors.size);
      const common=preview.anchors.samples.filter(x=>expected.anchors.samples.some(y=>x[0]===y[0] && x[1]===y[1]
        && Math.abs(x[2]-y[2])<.01 && Math.abs(x[3]-y[3])<.01));
      expect(common.length).toBeGreaterThanOrEqual(4);
      const furniture=Object.fromEntries(Object.entries(expected.furniture).map(([id,pieces])=>[id,pieces
        .filter(x=>preview.anchors.samples.some(y=>x[0]===y[0] && x[1]===y[1]
          && Math.abs(x[2]-y[2])<.01 && Math.abs(x[3]-y[3])<.01)).length]));
      for (const [id, matched] of Object.entries(furniture)) expect(matched, id).toBeGreaterThan(0);
      const positioned=(x,y)=>x[0]===y[0] && x[1]===y[1] && Math.abs(x[2]-y[2])<.01 && Math.abs(x[3]-y[3])<.01;
      const strokeFurniture=Object.values(expected.furniture).flat().filter(x=>x[6] && x[7]);
      if(projection==='flat') {
        expect(strokeFurniture.length).toBeGreaterThan(0);
        expect(expected.walls.length).toBeGreaterThan(0);
      }
      for(const x of strokeFurniture) expect(preview.anchors.samples.some(y=>positioned(x,y)
        && y[6] && y[7] && Math.abs(x[4]-y[4])<.0001),'non-scaling furniture stroke').toBeTruthy();
      for(const x of expected.walls) expect(preview.anchors.samples.some(y=>positioned(x,y)
        && x[5]===y[5] && y[6]),'wall hatch policy').toBeTruthy();
      await expectPlanDrawn(page,host);
      await expect(img).toHaveCount(0);
      data.push({name,projection,rotation,viewBox:preview.anchors.viewBox,zoom:preview.zoom,
        matched:common.length,furniture, strokeFurniture:strokeFurniture.map(x=>x[4]),
        wallPaint:expected.walls.map(x=>x[5]),facts:await facts(host)});
    } finally { await candidate.close(); }
  }
  await testInfo.attach('1522-exact-'+projection+rotation,{body:JSON.stringify(data,null,2),contentType:'application/json'});
}

for (const [projection,rotation,profile] of [['flat',0,false],['iso',0,false],['iso',45,true]]) {
  test(`#1522 same ${projection} geometry at ${rotation}°, desktop and phone`, async({browser},info)=>{
    await checkScene(browser,projection,rotation,profile,info);
  });
}

test('#1522 local #1520 preview waits for a late centred summary instead of being discarded', async({browser})=>{
  expect(new URL(HA_URL).hostname).toBe('127.0.0.1');
  await setHouse('iso',45,true,true);
  const context=await browser.newContext({storageState:authOnly(),baseURL:HA_URL,viewport,reducedMotion:'reduce'});
  const url='/houseplan?hpprofile=2&hpspace=1';
  try {
    const warm=await context.newPage();
    await warm.goto(url);
    const warmHost=card(warm); await expectPlanDrawn(warm,warmHost);
    await expect.poll(async()=>(await facts(warmHost))?.capture,{timeout:10_000}).toBe('stored');
    await warm.close();
    const cold=await context.newPage();
    let allowSummary;
    const heldSummary=new Promise(resolve=>{allowSummary=resolve;});
    let reads=0;
    await downlink(cold,message=>{if(message.type==='houseplan/startup_floor/get')reads++;return false;});
    await cold.route('**/summary-panel-runtime-entry-*.js',async route=>{
      await Promise.race([heldSummary,new Promise(resolve=>setTimeout(resolve,8_000))]); await route.continue();
    });
    await cold.route('**/floor-worker-*.js',async route=>{
      await new Promise(resolve=>setTimeout(resolve,6_000)); await route.continue();
    });
    await cold.goto(url,{waitUntil:'domcontentloaded'});
    const host=card(cold), image=host.locator('img[data-hp-startup-source="browser"]');
    await expect.poll(()=>host.evaluate(c=>[c._startupFloor?.facts.status,!!c._screenReference]),
      {timeout:5_000}).toEqual(['decoded',false]);
    await expect(image).toHaveCount(0);
    allowSummary();
    await expect(image).toBeVisible({timeout:10_000});
    expect(reads).toBe(0);
    await expectPlanDrawn(cold,host);
    await expect(image).toHaveCount(0);
  } finally { await context.close(); }
});

test('#1522 a delayed 2.5D packet cannot show after a value badge changes footprint', async({browser}) => {
  expect(new URL(HA_URL).hostname).toBe('127.0.0.1');
  const entity='sensor.ground_floor_temperature', original=await getState(entity);
  const change=async value=>{
    const response=await fetch(HA_URL+'/api/states/'+entity,{method:'POST',
      headers:{Authorization:'Bearer '+await accessToken('admin'),'Content-Type':'application/json'},
      body:JSON.stringify({state:value,attributes:original.attributes})});
    expect(response.ok).toBeTruthy();
  };
  const c=await planConfig(), config=structuredClone(c.config);
  const marker=config.markers.find(m=>m.id==='lg_sensor.ground_floor_temperature');
  marker.value_badge={enabled:true,position:'bottom',source:{kind:'entity_state',entity_id:entity}};
  config.settings.volumetric_view=true;
  await wsCall({type:'houseplan/config/set',config,expected_rev:c.rev,opening_features_api:1,furniture_workstation_api:1});
  const options={storageState:authOnly(),baseURL:HA_URL,viewport,reducedMotion:'reduce'};
  let warm, cold;
  try {
    await change('19');
    warm=await browser.newContext(options);
    const warmPage=await warm.newPage(); await warmPage.goto('/houseplan');
    const warmHost=card(warmPage); await expectPlanDrawn(warmPage,warmHost);
    await expect.poll(async()=> (await facts(warmHost))?.remote,{timeout:10_000}).toBe('stored');
    await warmHost.evaluate(c=>{
      const variant=c._startupRemoteVariant;
      c.__warmedStartupVariantReads=0;
      c._startupRemoteVariant=function(...args){c.__warmedStartupVariantReads++;return variant.apply(this,args);};
    });
    for(const value of ['123','345.67','5','19']) {
      await change(value);
      await expect.poll(()=>warmHost.evaluate((c,id)=>c._renderPlanHass.states[id]?.state,entity)).toBe(value);
    }
    expect(await warmHost.evaluate(c=>[c._startupSelection()?.remote??null,c.__warmedStartupVariantReads])).toEqual([null,0]);
    await warm.close(); warm=null;
    cold=await browser.newContext(options);
    const page=await cold.newPage();
    let closeReply, loadedReply;
    const pending=new Promise(resolve=>{loadedReply=resolve;});
    const held=new Promise(resolve=>{closeReply=resolve;});
    let first=true;
    await downlink(page,(request,route)=>{
      if(request.type!=='houseplan/startup_floor/get'||!first) return false;
      first=false;
      const {id,...command}=request;
      void wsCall(command).then(async response=>{
        loadedReply({response,request});
        await held;
        route.send(JSON.stringify({id,type:'result',success:true,result:response}));
      });
      return true;
    });
    await page.route('**/floor-worker-*.js',async route=>{
      await new Promise(resolve=>setTimeout(resolve,3_200)); await route.continue();
    });
    await page.goto('/houseplan',{waitUntil:'domcontentloaded'});
    const host=card(page);
    const stale=await pending;
    expect(typeof stale.response.packet).toBe('string');
    await change('12345.67');
    await expect.poll(async()=> (await status(host)).selection?.remote?.variant,{timeout:2_600})
      .not.toBe(stale.request.variant);
    closeReply();
    await expectPlanDrawn(page,host);
    expect((await facts(host)).shown).toBe(0);
  } finally { await warm?.close(); await cold?.close(); await change(original.state); }
});

const median = values => [...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];

async function largeFloor(view) {
  const source = process.env.HOUSEPLAN_SOURCE_DIR;
  if (!source) throw Error('Set HOUSEPLAN_SOURCE_DIR to the tested Houseplan source and compile test-build');
  const {makeLargeHouseFixture}=await import(pathToFileURL(resolve(source,'demo/fixtures/large-house.mjs')));
  const {commitWallSegmentModel}=await import(pathToFileURL(resolve(source,'test-build/wall-segment-model.js')));
  const c = await snapshotPlan(), fixture = makeLargeHouseFixture(view==='iso'
    ? {devices:0,decor:90,openings:60,partitions:24,columns:12,stairs:1}
    : {devices:0});
  for(const [i,r] of fixture.config.spaces[0].rooms.slice(0,view==='iso'?6:20).entries()){
    const [x,y]=r.poly[0];
    fixture.config.spaces[0].decor.push({id:'cabinet1522-'+i,kind:'furniture',symbol:'cabinet_tv',
      x:x+.045,y:y+.045,w:.044,h:.026,angle:i%3===0?15:0,color:'#627783'});
  }
  const {config}=commitWallSegmentModel(fixture.config);
  config.settings.volumetric_view=view==='iso';
  const document=structuredClone(c.document);
  document.payload={config,layout:{}};
  document.model_version=config.model_version;
  delete config.model_version;
  document.content_manifest=[];
  document.placement_manifest=[];
  await importDocument(document,{confirmMissingContent:true});
}

async function timings(browser, mode, optional) {
  const context = await browser.newContext({storageState:authOnly(),baseURL:HA_URL,viewport,reducedMotion:'reduce'});
  try {
    const page = await context.newPage();
    await downlink(page,optional?null:ignore,mode==='constrained-network'?100:0);
    if (mode==='constrained-network') {
      // All navigation/assets are constrained; the same explicit WS RTT is
      // also applied regardless of which path wins first paint.
      const cdp=await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:100,
        downloadThroughput:1_600_000,uploadThroughput:600_000,connectionType:'cellular4g'});
    }
    await page.goto('/houseplan',{waitUntil:'domcontentloaded',timeout:60_000});
    const host=card(page);
    await expectPlanDrawn(page,host);
    await expect.poll(async()=>(await facts(host))?.live || 0).toBeGreaterThan(0);
    return await facts(host);
  } finally { await context.close(); }
}

// Opt-in diagnostics are listed only for the explicit startup measurement.
const performanceViews = process.env.STARTUP_PERFORMANCE ? ['flat', 'iso'] : [];
for (const view of performanceViews) test(`#1522 real cold performance ${view}`, async({browser},info)=>{
  test.setTimeout(240_000);
  await largeFloor(view);
  const warm=await browser.newContext({storageState:authOnly(),baseURL:HA_URL,viewport,reducedMotion:'reduce'});
  try {
    const page=await warm.newPage(); await page.goto('/houseplan');
    const host=card(page); await expectPlanDrawn(page,host);
    try {
      await expect.poll(async()=>(await facts(host))?.remote,{timeout:20_000}).toBe('stored');
    } catch(error) {
      error.message+='\n'+JSON.stringify(await status(host)); throw error;
    }
  } finally { await warm.close(); }
  for(const mode of (process.env.STARTUP_BENCH_MODE ? [process.env.STARTUP_BENCH_MODE] : ['loopback','constrained-network'])){
    const pairs=[];
    for(let i=0;i<(mode==='loopback'?7:3);i++){
      const first=i%2===0;
      const a=await timings(browser,mode,first), b=await timings(browser,mode,!first);
      const [server,control]=first?[a,b]:[b,a];
      pairs.push({server,control,benefit:control.live-(server.shown || server.live),liveDelta:server.live-control.live});
    }
    const result={view,mode,hits:pairs.filter(p=>p.server.remote==='shown').length,
      medianBenefit:median(pairs.map(p=>p.benefit)),medianLiveDelta:median(pairs.map(p=>p.liveDelta)),pairs};
    await info.attach('1522-performance-'+view+'-'+mode,{body:JSON.stringify(result,null,2),contentType:'application/json'});
    console.log(JSON.stringify(result));
    expect(result.medianBenefit).toBeGreaterThanOrEqual(50);
    expect(result.medianLiveDelta).toBeLessThanOrEqual(Math.max(50, .05*median(pairs.map(p=>p.control.live))));
  }
});
