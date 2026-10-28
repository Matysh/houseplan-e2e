import {test,expect} from '@playwright/test';
import {HP} from './lib/hooks.mjs';
import {evidence,expectPlanDrawn} from './lib/ha-page.mjs';
import {requirePanelBeta4,restorePanelPlan,orderedFixture,card,stage,settle,camera,expectFloor,expectKiosk,swipe,touch,navigateInApp} from './lib/panel-kiosk-journeys.mjs';
test.beforeEach(()=>requirePanelBeta4(test));restorePanelPlan(test);test.setTimeout(150_000);

test('1103-6 mobile all/fixed native swipe, pinch, pan, double tap, local sizes and orientation',async({page},info)=>{
  const config=await orderedFixture();await page.goto('/houseplan/kiosk');let host=card(page);await expectPlanDrawn(page,host);await expectKiosk(host);
  const before=await host.locator(HP.room).evaluateAll(nodes=>nodes.map(n=>n.dataset.id).sort());await swipe(page,host);
  await expect.poll(()=>host.locator(HP.room).evaluateAll(nodes=>nodes.map(n=>n.dataset.id).sort())).not.toEqual(before);
  await navigateInApp(page,'/houseplan/kiosk/2');await expectFloor(host,config.spaces[1]);await swipe(page,host);await expectFloor(host,config.spaces[1]);
  const box=await stage(host).boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2,fit=await camera(host);
  await touch(page,[[{x:x-25,y},{x:x+25,y}],[{x:x-45,y},{x:x+45,y}],[{x:x-75,y},{x:x+75,y}],[]]);await settle(host);
  expect(await camera(host)).not.toEqual(fit);
  const zoomed=await camera(host);await touch(page,[[{x,y}],[{x:x+30,y:y+15}],[{x:x+60,y:y+25}],[]]);await settle(host);expect(await camera(host)).not.toEqual(zoomed);
  const session=await page.context().newCDPSession(page);
  try{await session.send('Input.synthesizeTapGesture',{x,y,tapCount:2,gestureSourceType:'touch'});}finally{await session.detach();}
  await settle(host);expect((await camera(host)).viewBox).toBe(fit.viewBox);
  const hold=async()=>{const b=await stage(host).boundingBox(),session=await page.context().newCDPSession(page);
    try{await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+5,y:b.y+5,id:1}]});await page.waitForTimeout(3200);await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}finally{await session.detach();}
    const d=host.locator(HP.dialog('kiosk')).first();await expect(d).toBeVisible();return d;};
  let dialog=await hold();const slider=dialog.getByRole('slider').first(),sliderBox=await slider.boundingBox();
  await expect(slider).toBeEnabled();await page.touchscreen.tap(sliderBox.x+sliderBox.width*.7,sliderBox.y+sliderBox.height/2);const value=await slider.inputValue();
  await dialog.locator(HP.dialogCancel).first().tap();await page.reload();host=card(page);await expectPlanDrawn(page,host);
  dialog=await hold();await expect(dialog.getByRole('slider').first()).toHaveValue(value);await dialog.locator(HP.dialogCancel).first().tap();
  for(const size of [{width:800,height:393},{width:393,height:800}]){
    await page.setViewportSize(size);await settle(host);const b=await stage(host).boundingBox();
    expect(b.width).toBeGreaterThan(size.width*.8);expect(b.height).toBeGreaterThan(size.height*.6);expect(b.y).toBeGreaterThanOrEqual(-1);expect(b.y+b.height).toBeLessThanOrEqual(size.height+1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await expectFloor(host,config.spaces[1]);await expectKiosk(host);
  }
  await evidence(info,page,'native-mobile-kiosk');
});
