import {expect} from '@playwright/test';
import {hp} from './hooks.mjs';
import {planConfig,planLayout,wsCall} from './ha-ws.mjs';

export const A='e_light_hallway_lamp_5', B='e_light_hallway_lamp_4';
export const ENTITY='light.hallway_lamp_5';
export const NAMES={[A]:'Tooltip 50 A',[B]:'Tooltip 50 B'};
export const marker=(host,id=A)=>host.locator(hp('device',{id})).first();
export const tooltip=host=>host.locator(hp('live-tooltip')).first();

/** Public integration API setup on the disposable HA, never a card-state write. */
export async function installTooltipFixture() {
 const current=await planConfig(),config=structuredClone(current.config);
 config.settings={...config.settings,group_lights:false,show_lqi:false};
 config.markers=config.markers.map(m=>[A,B].includes(m.id)?{...m,space:'f1',hidden:false,
  name:NAMES[m.id],model:'Tooltip witness with a long model description',size:2,tap_action:'toggle',
  value_badge:{...m.value_badge,enabled:false,position:'bottom'}}:{...m,hidden:true});
 await wsCall({type:'houseplan/config/set',config,expected_rev:current.rev,
  ...(current.opening_features_api===1?{opening_features_api:1}:{})});
 await placeMarkers({[A]:{s:'f1',x:.4,y:.45},[B]:{s:'f1',x:.65,y:.45}});
}
export async function placeMarkers(patch) {
 const current=await planLayout();
 await wsCall({type:'houseplan/layout/set',layout:{...current.layout,...patch},expected_rev:current.rev});
}
export async function observeMotion(page) {
 await page.addInitScript(()=>{
  window.__tooltip50=[];
  window.__tooltip50Events=[];
  for(const type of ['pointerover','pointermove','pointerleave','focusin'])document.addEventListener(type,event=>{
   const target=event.composedPath().find(node=>node instanceof Element&&node.matches('[data-hp="device"]'));
   if(target)window.__tooltip50Events.push({type,at:performance.now(),trusted:event.isTrusted,
    x:event.clientX,y:event.clientY,id:target.getAttribute('data-id')});
  },true);
  const animate=Element.prototype.animate;
  Element.prototype.animate=function(frames,options){
   if(this.matches('[data-hp="live-tooltip"]'))window.__tooltip50.push({at:performance.now(),
    duration:options?.duration,frames:Array.isArray(frames)?frames.map(f=>({...f})):frames});
   return animate.call(this,frames,options);
  };
 });
}
export async function point(host,id=A) {
 const node=marker(host,id);await expect(node).toBeVisible();
 await node.scrollIntoViewIfNeeded();
 const box=await node.boundingBox();expect(box?.width).toBeGreaterThan(0);
 return {x:box.x+box.width/2,y:box.y+box.height/2};
}
export const move=(page,p)=>page.mouse.move(p.x,p.y);
export async function outside(page,host) {
 await page.mouse.move(3,3);await expect(tooltip(host)).toBeHidden();
}
export async function shown(host,id=A) {
 const tip=tooltip(host);await expect(tip).toBeVisible();
 await expect(tip).not.toHaveAttribute('aria-hidden','true');
 await expect(tip.locator('b').first()).toHaveText(NAMES[id]);
 return tip;
}
export async function painted(host) {
 await tooltip(host).evaluate(async el=>{await Promise.allSettled(el.getAnimations().map(a=>a.finished));});
}
export async function openTip(page,host,id=A) {
 await outside(page,host);await move(page,await point(host,id));await shown(host,id);await painted(host);
 return readTip(host);
}
export const sameAnchor=(a,b)=>Math.abs(a.x-b.x)<.75&&Math.abs(a.y-b.y)<.75;
export async function readTip(host) {
 return tooltip(host).evaluate(el=>{const r=el.getBoundingClientRect();return{
  x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight,
  hidden:el.hidden,active:!el.hidden&&el.getAttribute('aria-hidden')!=='true',text:el.textContent,
  opacity:Number(getComputedStyle(el).opacity),motionCount:window.__tooltip50.length,
  motions:window.__tooltip50.map(m=>({...m})),
  events:window.__tooltip50Events.slice(-20),
  running:el.getAnimations().filter(a=>a.playState==='running').map(a=>({duration:a.effect.getTiming().duration,
   frames:a.effect.getKeyframes().map(f=>({opacity:Number(f.opacity),translate:f.translate}))}))};});
}
