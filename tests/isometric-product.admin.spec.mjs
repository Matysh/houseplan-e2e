// #1451: production 2.5D on real HA. No UI Lab DOM/URL switches, mocked hass,
// private card fields or intercepted writes. Only an isolated loopback seed is
// changed; screenshots are evidence, not an exact-pixel acceptance gate.
import {test,expect} from '@playwright/test';
import {isDeepStrictEqual} from 'node:util';
import {HA_URL} from '../scripts/users.mjs';
import {installedRecord,requireHooks} from './lib/contract.mjs';
import {card,evidence,expectPlanDrawn} from './lib/ha-page.mjs';
import {importDocument,planConfig,planLayout,snapshotPlan,spaceOf,waitForConfig,wsCall} from './lib/ha-ws.mjs';
import {HP,hp} from './lib/hooks.mjs';
import {headerActionTarget} from './lib/header-actions.mjs';
import {enterEditor,field,leaveEditor,openPlan,selectSpace,settle,stage} from './lib/plan.mjs';
import {watchWrites} from './lib/beta4-regressions.mjs';

requireHooks(test,'stage@data-projection','stage@data-yaw','stage@data-rotation','stage@data-floor-scale-y',
  'decor@data-hp-furniture-volume','action','field','settings-section','rotate-right','mode-tab');

const FLOOR='f1',DESK='native-1451-desk',PC='native-1451-computer',SOFA='native-1451-sofa';
const ids=[DESK,PC,SOFA];
let seed;
test.beforeAll(async()=>{
  expect(['localhost','127.0.0.1','[::1]'],'this journey only mutates an isolated local HA').toContain(new URL(HA_URL).hostname);
  seed=await snapshotPlan();
});
test.beforeEach(async()=>{
  // The new DOM contract identifies this product generation. Missing backend
  // capability on that generation is a failure, not a silently passing skip.
  expect((await planConfig()).furniture_workstation_api).toBe(1);
});
test.afterEach(async({page})=>{
  await page.goto('about:blank');
  // Restore this file's own full snapshot, through the current importer. The
  // old generic config writer does not claim workstation capability and must
  // not be used to erase a linked workstation during teardown.
  if(seed)await importDocument(seed.document,{confirmMissingContent:true});
});

const object=(config,id)=>spaceOf(config,FLOOR).decor.find(item=>item.id===id);
const volume=(host,id)=>host.locator(hp('decor',{id,kind:'furniture','data-hp-furniture-volume':true}));
const plain=(host,id)=>host.locator('path'+hp('decor',{id,kind:'furniture'}));
const pair=async()=>{const[c,l]=await Promise.all([planConfig(),planLayout()]);return{config:c.config,layout:l.layout,configRev:c.rev,layoutRev:l.rev};};

async function installFurniture(symbol='desk'){
  const current=await planConfig(),config=structuredClone(current.config);
  const floor=spaceOf(config,FLOOR);expect(floor,'the synthetic seed has a canonical Ground Floor').toBeTruthy();
  expect(floor.rooms.length).toBeGreaterThan(0);
  expect((floor.decor||[]).some(item=>ids.includes(item.id))).toBe(false);
  const corner=symbol==='desk_corner';
  // Added to the already canonical seed: no invented graph or removal of seed
  // images. Desktop centre overlaps the usable rear wing of either desk.
  floor.decor=[...(floor.decor||[]),
    {id:DESK,kind:'furniture',symbol,x:.25,y:.28,w:corner?.16:.14,h:corner?.15:.07,color:'#627783',opacity:1,width_cm:1},
    {id:PC,kind:'furniture',symbol:'computer',x:corner?.29:.28,y:corner?.29:.285,w:.12,h:.06,color:'#627783',opacity:1,width_cm:1},
    {id:SOFA,kind:'furniture',symbol:'sofa',x:.52,y:.29,w:.16,h:.09,color:'#627783',opacity:1,width_cm:1}];
  floor.settings={...floor.settings,show_borders:true};
  config.settings={...config.settings,volumetric_view:false};
  await wsCall({type:'houseplan/config/set',config,expected_rev:current.rev,furniture_workstation_api:1,
    ...(current.opening_features_api===1?{opening_features_api:1}:{})});
  return waitForConfig(c=>!!object(c,SOFA)&&object(c,DESK)?.symbol===symbol);
}

async function enableVolume(host){
  await (await headerActionTarget(host,HP.settings)).click();
  const dialog=host.locator(HP.dialog('settings')).first();await expect(dialog).toBeVisible();
  await dialog.locator(hp('settings-section',{kind:'general',section:'plan'})).click();
  const toggle=field(dialog,'gs-volumetric-view');
  await expect(toggle).toBeVisible();
  if(!await toggle.isChecked())await toggle.click();
  await expect(toggle).toBeChecked();
  await dialog.locator(HP.dialogConfirm).first().click();await expect(dialog).toBeHidden();
  await waitForConfig(c=>c.settings.volumetric_view===true,{message:'ordinary 2.5D setting persisted by real UI'});
  await expect(stage(host)).toHaveAttribute('data-projection','iso');
  for(const id of ids)await expect(volume(host,id).first()).toBeVisible();
}

async function turn(host){
  const before=await stage(host).getAttribute('data-rotation');
  await (await headerActionTarget(host,hp('rotate-right'))).click();
  await expect(stage(host)).not.toHaveAttribute('data-rotation',before);await settle(host);
}

async function assertProfile(host,rotation,profile='iso'){
  await expect(stage(host)).toHaveAttribute('data-projection',profile);
  await expect(stage(host)).toHaveAttribute('data-rotation',String(rotation));
  expect(Number(await stage(host).getAttribute('data-yaw'))).toBe(profile==='iso'?35+rotation:rotation);
  expect(Number(await stage(host).getAttribute('data-floor-scale-y'))).toBeCloseTo(profile==='iso'?Math.sin(40*Math.PI/180):1,8);
}

async function chooseDecor(page,host,id){
  const paths=plain(host,id);await expect(paths.first()).toBeVisible();
  // Use a painted SVG stroke, not the potentially empty centre of a furniture
  // bounding box. This is geometry of the declared public decor element.
  const at=await paths.first().evaluate(element=>{
    const length=element.getTotalLength(),matrix=element.getScreenCTM(),root=element.getRootNode();
    if(!matrix||!length)throw Error('decor has no painted path');
    for(let i=0;i<40;i++){
      const p=element.getPointAtLength(length*(i+.5)/40),screen=new DOMPoint(p.x,p.y).matrixTransform(matrix);
      const hit=root.elementFromPoint(screen.x,screen.y)?.closest('[data-hp="decor"]');
      if(hit?.getAttribute('data-id')===element.getAttribute('data-id'))return{x:screen.x,y:screen.y};
    }
    throw Error('decor has no unobscured native click target');
  });
  await page.mouse.click(at.x,at.y);
  await expect(host.locator(HP.action('desktop-mount')).first()).toBeVisible();
}

async function history(host,direction){
  const button=host.locator(direction==='undo'?HP.action('geometry-undo'):HP.action('geometry-redo')).first();
  await expect(button).toBeEnabled();await button.click();await settle(host);
}

for(const surface of ['panel','card'])test(`native 2.5D ${surface} uses four accepted camera sides and a read-only Flat editor round-trip`,async({page},info)=>{
  test.setTimeout(180000);await page.setViewportSize({width:1480,height:1080});
  await installFurniture();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const writes=watchWrites(page);let dashboard;
  try{
    let host;
    if(surface==='panel')host=await openPlan(page,{space:FLOOR});
    else{
      const urlPath='e2e-native-25d-'+Date.now().toString(36);
      dashboard=await wsCall({type:'lovelace/dashboards/create',title:'Native 2.5D',url_path:urlPath,mode:'storage',show_in_sidebar:false,require_admin:false});
      await wsCall({type:'lovelace/config/save',url_path:urlPath,config:{views:[
        {title:'House Plan',path:'plan',type:'panel',cards:[{type:'custom:houseplan-card',floor:FLOOR,rotation:0}]},
      ]}});
      await page.goto('/'+urlPath+'/plan');host=card(page);await expectPlanDrawn(page,host);
      await expect(page.locator('hui-root')).toBeVisible();
    }
    await expect(stage(host)).toHaveAttribute('data-projection','flat');
    await enableVolume(host);
    expect(await page.locator('html').getAttribute('data-ui-lab-camera1451')).toBeNull();
    expect(new URL(page.url()).searchParams.has('view1451')).toBe(false);
    for(let i=0;i<4&&await stage(host).getAttribute('data-rotation')!=='0';i++)await turn(host);
    const before=await pair(),writeCount=writes.length;
    for(const rotation of [0,90,180,270]){
      await assertProfile(host,rotation);
      for(const id of ids)await expect(volume(host,id).first()).toBeVisible();
      await evidence(info,page,`${surface}-volume-${35+rotation}`);
      await turn(host);
    }
    await assertProfile(host,0);
    await enterEditor(host,'decor');await assertProfile(host,0,'flat');
    for(const id of ids){await expect(volume(host,id)).toHaveCount(0);await expect(plain(host,id).first()).toBeVisible();}
    await evidence(info,page,surface+'-editor-is-flat');
    await leaveEditor(host);await assertProfile(host,0);
    expect(await pair()).toEqual(before);
    expect(writes.slice(writeCount),'view turns and entering/leaving an unchanged editor never save the plan').toEqual([]);
    await page.reload();await expectPlanDrawn(page,host);
    if(surface==='panel')await selectSpace(host,FLOOR);
    await assertProfile(host,0);for(const id of ids)await expect(volume(host,id).first()).toBeVisible();
    expect(await pair()).toEqual(before);expect(errors).toEqual([]);
    await info.attach('native-profile.json',{body:JSON.stringify({surface,productVersion:installedRecord()?.version,
      acceptedYaw:[35,125,215,305],viewWrites:writes.slice(writeCount),sameStoredPair:true},null,2),contentType:'application/json'});
  }finally{if(dashboard)await wsCall({type:'lovelace/dashboards/delete',dashboard_id:dashboard.id});}
});

for(const symbol of ['desk','desk_corner'])test(`native ${symbol} workstation is one saved/undoable operation and survives real HA reload`,async({page},info)=>{
  const evidencePrefix=symbol.replaceAll('_','-');
  test.setTimeout(180000);await page.setViewportSize({width:1480,height:1080});await installFurniture(symbol);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const writes=watchWrites(page);
  let host=await openPlan(page,{space:FLOOR});await enableVolume(host);await enterEditor(host,'decor');
  await chooseDecor(page,host,PC);const before=await planConfig(),source=object(before.config,PC),writeCount=writes.length;
  await host.locator(HP.action('desktop-mount')).first().click();
  const mounted=await waitForConfig(c=>object(c,DESK)?.workstation==='mounted'&&object(c,PC)?.workstation==='tower',
    {message:'workstation roles acknowledged by real HA'});
  expect(object(mounted,DESK).workstation_tower_id).toBe(PC);
  expect(object(mounted,PC).angle??0).toBe(source.angle??0);
  expect(object(mounted,PC).x).toBeCloseTo(source.x+source.w*.75,7);
  expect(object(mounted,PC).y).toBeCloseTo(source.y,7);
  expect(object(mounted,PC).w).toBeCloseTo(source.w/4,7);
  expect(object(mounted,PC).h).toBeCloseTo(source.h,7);
  expect(mounted.spaces.filter(s=>s.id!==FLOOR)).toEqual(before.config.spaces.filter(s=>s.id!==FLOOR));
  expect(writes.slice(writeCount).filter(write=>write.type==='houseplan/config/set')).toHaveLength(1);
  await evidence(info,page,evidencePrefix+'-mounted');
  await history(host,'undo');await waitForConfig(c=>isDeepStrictEqual(c,before.config),{message:'one Undo restores both original objects'});
  await history(host,'redo');await waitForConfig(c=>isDeepStrictEqual(c,mounted),{message:'one Redo restores the whole linked pair'});
  await leaveEditor(host);await page.reload();host=await openPlan(page,{space:FLOOR});
  await expect(volume(host,DESK).first()).toBeVisible();await expect(volume(host,PC).first()).toBeVisible();
  expect((await planConfig()).config).toEqual(mounted);
  await evidence(info,page,evidencePrefix+'-after-reload');
  await enterEditor(host,'decor');await chooseDecor(page,host,DESK);
  await host.locator(HP.action('desktop-mount')).first().click();
  await waitForConfig(c=>!object(c,DESK)?.workstation&&!object(c,PC)?.workstation,
    {message:'detach is persisted after reload'});
  await history(host,'undo');await waitForConfig(c=>isDeepStrictEqual(c,mounted),{message:'detach Undo restores the saved linked pair'});
  const current=await planConfig();
  await expect(wsCall({type:'houseplan/config/set',config:current.config,expected_rev:current.rev,
    furniture_workstation_api:1,opening_features_api:1},'viewer')).rejects.toThrow(/unauthorized|permission|forbidden/i);
  expect((await planConfig()).config).toEqual(mounted);expect(errors).toEqual([]);
  await evidence(info,page,evidencePrefix+'-detachment-undone');
});
