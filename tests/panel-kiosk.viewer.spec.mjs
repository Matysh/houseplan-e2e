import {test,expect} from '@playwright/test';
import {HP,hp} from './lib/hooks.mjs';
import {planConfig,wsCall} from './lib/ha-ws.mjs';
import {expectPlanDrawn} from './lib/ha-page.mjs';
import {requirePanelBeta4,restorePanelPlan,orderedFixture,openKiosk,card,writeConfig,expectKiosk,expectFloor} from './lib/panel-kiosk-journeys.mjs';
test.beforeEach(()=>requirePanelBeta4(test));restorePanelPlan(test);test.setTimeout(150_000);

test('1103-9 viewer kiosk cannot expose editors or write; empty plan offers no creation',async({page})=>{
  const config=await orderedFixture();await openKiosk(page,'/houseplan/kiosk/2',config.spaces[1]);const host=card(page);
  for(const selector of [HP.editorTabs,HP.settings,HP.spaceAdd,HP.createSpace])await expect(host.locator(selector)).toHaveCount(0);
  const before=await planConfig();await expect(wsCall({type:'houseplan/config/set',config:before.config,expected_rev:before.rev},'viewer')).rejects.toThrow(/unauthorized|permission|forbidden/i);
  expect((await planConfig()).rev).toBe(before.rev);
  await writeConfig(c=>{c.spaces=[];c.markers=[];});await page.reload();await expect(host.locator(HP.ready)).toBeVisible();await expect(host.locator(HP.empty)).toBeVisible();
  await expect(host.locator(HP.createSpace)).toHaveCount(0);await expect(host.locator(HP.editorTabs)).toHaveCount(0);
});

test('1103-9 ordinary Lovelace kiosk cycle/floor/rotation contract and strict bad floor remain',async({page})=>{
  const config=await orderedFixture();const created=await wsCall({type:'lovelace/dashboards/create',title:'E2E kiosk contract',url_path:'e2e-kiosk-contract',mode:'storage',show_in_sidebar:false,require_admin:false});
  try{
    await wsCall({type:'lovelace/config/save',url_path:'e2e-kiosk-contract',config:{views:[
      {title:'Valid',path:'valid',type:'panel',cards:[{type:'custom:houseplan-card',kiosk:true,cycle:0,floor:'f1',rotation:90}]},
      {title:'Cycle',path:'cycle',type:'panel',cards:[{type:'custom:houseplan-card',kiosk:true,cycle:2}]},
      {title:'Invalid',path:'invalid',type:'panel',cards:[{type:'custom:houseplan-card',kiosk:true,floor:'definitely-missing-floor'}]},
    ]}});
    await page.goto('/e2e-kiosk-contract/valid');await expectPlanDrawn(page);await expectKiosk(card(page));
    await expectFloor(card(page),config.spaces.find(space=>space.id==='f1'));
    await expect.poll(()=>card(page).locator(hp('room')).first().evaluate(room=>{
      const m=room.getScreenCTM();return Math.abs(m.a)<.00001&&m.b>0&&m.c<0&&Math.abs(m.d)<.00001;
    }),{message:'the real painted room coordinate frame is rotated90'}).toBe(true);
    // Lovelace has its own HA host. #1120 does not remove that dashboard shell.
    await expect(page.locator('hui-root')).toBeVisible();
    await page.goto('/e2e-kiosk-contract/cycle');await expectPlanDrawn(page);await expectKiosk(card(page));
    const cycleBefore=await card(page).locator(hp('room')).evaluateAll(nodes=>nodes.map(node=>node.dataset.id).sort());
    await expect.poll(()=>card(page).locator(hp('room')).evaluateAll(nodes=>nodes.map(node=>node.dataset.id).sort()),
      {message:'ordinary Lovelace kiosk cycle must advance a real painted floor',timeout:15_000}).not.toEqual(cycleBefore);
    await page.goto('/e2e-kiosk-contract/invalid');await expect(card(page).getByRole('alert')).toContainText(/floor|space/i);
    await expect(card(page).locator(HP.editorTabs)).toHaveCount(0);
  }finally{await wsCall({type:'lovelace/dashboards/delete',dashboard_id:created.id});}
});
