// #1120: the real HA host owns narrow/sidebar state. The fixture uses HA's
// native browser preference switch; it never edits storage or a private hass
// property. Primary API/DOM source: home-assistant/frontend
// src/panels/profile/ha-force-narrow-row.ts, ha-profile-dashboard.ts.
import { test, expect } from '@playwright/test';
import { historicalHp, requireHooks } from './lib/contract.mjs';
import { HP } from './lib/hooks.mjs';
import { card, expectPlanDrawn, spaceEntries, evidence } from './lib/ha-page.mjs';
import { hasBeta4PanelContract, hasBeta5UiPolishContract, hasNamedSpaceHeaderContract, hasHeaderPolishContract } from './lib/panel-release-contract.mjs';
import { expectPanelShell, expectNativeDrawerEntry } from './lib/panel-shell.mjs';
import { enterEditor } from './lib/plan.mjs';
import { headerActionTarget, expectIntrinsicHeader } from './lib/header-actions.mjs';

requireHooks(test, 'panel-menu', 'stage', 'space-select', 'space-tab', 'mode-tab@data-mode', 'editor-close', 'properties-panel');

async function browserSidebarPreference(page) {
  await page.goto('/profile/browser');
  const control = page.locator('ha-force-narrow-row').getByRole('switch');
  await expect(control).toBeVisible({ timeout: 60_000 });
  return control;
}
async function setHiddenPreference(page, hidden) {
  const control = await browserSidebarPreference(page);
  await expect(control).toBeEnabled();
  // HA's native switch paints its thumb over the internal input. Click the
  // custom-element host: its label activates that input through real pointer
  // input. Keep the semantic input as the checked-state oracle (no force).
  if (await control.isChecked() !== hidden) await page.locator('ha-force-narrow-row ha-switch').click();
  if (hidden) await expect(control).toBeChecked();
  else await expect(control).not.toBeChecked();
}
async function ordinaryPanel(page) {
  await page.goto('/houseplan');
  const panel = page.locator('houseplan-panel'), host = panel.locator('houseplan-card');
  await expectPlanDrawn(page, host);
  await expectPanelShell(panel, host);
  return { panel, host, menu: host.locator(HP.panelMenu).first() };
}
async function menuTarget(menu) {
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  // Compositor transforms can return 43.999996 px for a 44 px target.
  // Normalize sub-millipixel arithmetic noise, retaining the 44 CSS px contract.
  expect(Math.round(box.width * 1000) / 1000).toBeGreaterThanOrEqual(44);
  expect(Math.round(box.height * 1000) / 1000).toBeGreaterThanOrEqual(44);
  return box;
}
const sidebarEntry = page => page.locator('ha-sidebar a[href="/houseplan"]');

test('the native HA menu follows width and the real sidebar preference, and stays outside Lovelace', async ({ page }, testInfo) => {
  test.skip(!hasBeta4PanelContract(), 'installed product predates the #1120 header contract; a skip is not proof');
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1920, height: 1000 });
  // Playwright gives this test its own disposable BrowserContext. The native
  // switch restores only the hidden boolean (auto and docked both read false);
  // closing the context discards browser preferences without changing saved auth.
  const original = await (await browserSidebarPreference(page)).isChecked();
  let failed = false;
  try {
    await setHiddenPreference(page, false);
    const { panel, host, menu } = await ordinaryPanel(page);
    // Wide auto/docked HA keeps its own sidebar; House Plan adds no duplicate.
    await expect(menu).toBeHidden();

    // A real HA viewport transition reaches the existing panel without a new
    // page, injected state, or a fixed-width rule in the test implementation.
    await page.setViewportSize({ width: 390, height: 844 });
    if (hasNamedSpaceHeaderContract()) await expectIntrinsicHeader(host);
    const narrowMenu = await headerActionTarget(host, HP.panelMenu);
    await menuTarget(narrowMenu);
    await expectPlanDrawn(page, host);
    if (hasBeta5UiPolishContract()) {
      for (const action of [HP.modeTab('plan'),HP.modeTab('devices'),HP.modeTab('decor'),HP.settings,'[data-hp="pdf"]','[data-hp="support"]']) {
        await expect(await headerActionTarget(host, action)).toBeVisible();
      }
      expect(await host.locator('.hdr').evaluate(e=>e.scrollWidth<=e.getBoundingClientRect().width+1)).toBe(true);
      await expect(host.locator(historicalHp('header-menu'))).toBeHidden();
    }
    await page.keyboard.press('Escape'); // Close commands before exercising the separate native drawer control.
    await expect(sidebarEntry(page)).not.toBeInViewport();
    await narrowMenu.click();
    await expectNativeDrawerEntry(page);
    await page.keyboard.press('Escape');
    await expect(sidebarEntry(page)).not.toBeInViewport();
    await evidence(testInfo, page, 'native-ha-narrow-menu');

    await page.setViewportSize({ width: 1920, height: 1000 });
    await expect(menu).toBeHidden();
    await expectPlanDrawn(page, host);

    // Separate lifecycle witness through HA's public event port. The native
    // switch lives on another page; this is deliberately not called a UI click.
    // HA's real sidebar-mixin receives the same event and updates its provider.
    // Sources: frontend/20260930.5 src/state/sidebar-mixin.ts and
    // src/panels/profile/ha-force-narrow-row.ts (also present in 20240605.0).
    const mounted = await host.elementHandle(), beforeUrl = page.url();
    let navigations = 0;
    const onNavigation = frame => { if (frame === page.mainFrame()) navigations++; };
    page.on('framenavigated', onNavigation);
    try {
      await panel.evaluate(el => el.dispatchEvent(new CustomEvent('hass-dock-sidebar', {
        detail: { dock: 'always_hidden' }, bubbles: true, composed: true,
      })));
      await menuTarget(menu);
      await expect(sidebarEntry(page)).not.toBeInViewport();
      expect(await host.evaluate((el, previous) => el === previous, mounted)).toBe(true);
      await menu.click();
      await expectNativeDrawerEntry(page);
      await page.keyboard.press('Escape');
      await expect(sidebarEntry(page)).not.toBeInViewport();
      await panel.evaluate(el => el.dispatchEvent(new CustomEvent('hass-dock-sidebar', {
        detail: { dock: 'auto' }, bubbles: true, composed: true,
      })));
      await expect(menu).toBeHidden();
      await expectNativeDrawerEntry(page);
      expect(await host.evaluate((el, previous) => el === previous, mounted)).toBe(true);
      expect(page.url()).toBe(beforeUrl);
      expect(navigations).toBe(0);
      await expectPanelShell(panel, host);
    } finally {
      page.off('framenavigated', onNavigation);
      await mounted.dispose();
    }

    // HA's ordinary switch emits its native hass-dock-sidebar event and stores
    // the browser preference itself. A cold panel must honor it as well.
    await setHiddenPreference(page, true);
    const hidden = await ordinaryPanel(page), menuBox = await menuTarget(hidden.menu);
    const firstSpace = await spaceEntries(hidden.host).first().boundingBox();
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(firstSpace.x + 1);
    await hidden.menu.click();
    await expectNativeDrawerEntry(page);
    await page.keyboard.press('Escape');
    await expect(sidebarEntry(page)).not.toBeInViewport();
    await evidence(testInfo, page, 'native-ha-wide-hidden-sidebar-menu');

    await page.goto('/house-plan');
    const lovelace = card(page);
    await expectPlanDrawn(page, lovelace);
    await expect(lovelace.locator(HP.panelMenu)).toHaveCount(0);
    await evidence(testInfo, page, 'lovelace-has-no-houseplan-menu');
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    // A failed/timed-out test discards its whole BrowserContext. Do not mask
    // the original failure with cleanup against an already closed page.
    if (!failed && !page.isClosed()) {
      await page.setViewportSize({ width: 1920, height: 1000 });
      await setHiddenPreference(page, original);
    }
  }
});

test('editor close glyph stays centered in full and compact modes with real HA icons', async ({ page }, testInfo) => {
  test.skip(!hasBeta4PanelContract(), 'installed product predates the #1120 header contract; a skip is not proof');
  test.setTimeout(180_000);
  const receipts=[],toolbarHeights=[];
  for(const modeName of ['plan','devices','decor']) {
    await page.setViewportSize({width:2560,height:1000});
    const {host}=await ordinaryPanel(page),sharedBefore=await host.locator(HP.settings).boundingBox();
    await enterEditor(host,modeName);
    await expect.poll(async()=>Math.abs((await host.locator(HP.settings).boundingBox()).y-sharedBefore.y)).toBeLessThanOrEqual(.5);
    const toolbar=host.locator(HP.toolbar(modeName==='devices'?'device':modeName));
    await expect(toolbar).toBeVisible();toolbarHeights.push({mode:modeName,height:(await toolbar.boundingBox()).height});
    const mode=host.locator(HP.modeTab(modeName)),group=mode.locator('..'),ordinaryClose=group.locator(HP.editorClose);
    let iconWidth;
    for(const width of [1920,1800,1600,1440,1280,1100]) {
      await page.setViewportSize({width,height:1000});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      if(await mode.isVisible() && !await mode.innerText().then(s=>s.trim().length>0)){iconWidth=width;break;}
    }
    expect(iconWidth,'a real icons-only ordinary layout is exercised').toBeTruthy();
    const centered=async(close,tab,{width,presentation,size})=>{
      await expect(close).toBeVisible();
      const icon=close.locator('ha-icon');await expect(icon).toHaveAttribute('icon','mdi:close');
      const path=icon.locator('path').first();await expect.poll(()=>path.getAttribute('d')).toBeTruthy();
      for(const state of ['normal','hover','keyboard-focus']) {
        if(state==='hover')await close.hover();
        if(state==='keyboard-focus'){await close.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(close).toBeFocused();}
        let observed;
        await expect.poll(async()=>{
          const button=await close.boundingBox(),tabBox=tab&&await tab.boundingBox();
          const painted=await path.evaluate(node=>{const b=node.getBBox(),m=node.getScreenCTM();if(!m||!b.width||!b.height)return null;const c=new DOMPoint(b.x+b.width/2,b.y+b.height/2).matrixTransform(m);return{x:c.x,y:c.y};});
          if(!button||!painted||tab&&!tabBox)return Infinity;
          observed={mode:modeName,width,presentation,state,button,tab:tabBox||null,painted};
          return Math.max(Math.abs(painted.x-button.x-button.width/2),Math.abs(painted.y-button.y-button.height/2),
            tabBox?Math.abs(button.y+button.height/2-tabBox.y-tabBox.height/2):0);
        },{message:'painted SVG stays centered in its owning close target'}).toBeLessThanOrEqual(.5);
        expect(observed.button.width).toBeCloseTo(size,1);expect(observed.button.height).toBeCloseTo(size,1);receipts.push(observed);
      }
    };
    for(const [width,presentation] of [[2560,'full'],[iconWidth,'compact-icons']]) {
      await page.setViewportSize({width,height:1000});await expect(host.locator('[data-hp="properties-panel"]')).toBeVisible();
      await expect(ordinaryClose).toBeVisible();
      await expect.poll(()=>mode.evaluate(el=>el.innerText.trim().length>0)).toBe(presentation==='full');
      await centered(ordinaryClose,mode,{width,presentation,size:hasBeta5UiPolishContract()?44:24});
      await testInfo.attach('close-'+modeName+'-'+presentation,{body:await group.screenshot(),contentType:'image/png'});
    }
    if(hasNamedSpaceHeaderContract()) {
      let layout;
      for(const width of [700,500,390,320]){await page.setViewportSize({width,height:1000});layout=await expectIntrinsicHeader(host);if(layout.compact)break;}
      expect(layout.compact,'the actual disclosure presentation is exercised').toBe(true);
      await expect(ordinaryClose).toBeHidden();
      if(hasHeaderPolishContract()) {
        const close=host.locator('.editbar-end '+HP.editorClose);
        await centered(close,null,{width:page.viewportSize().width,presentation:'stacked-controls',size:40});
        await expect.poll(()=>close.evaluate(button=>{
          const rows=[...button.parentElement.querySelectorAll('button')].map(el=>({close:el===button,r:el.getBoundingClientRect()}))
            .filter(v=>v.r.width).sort((a,b)=>a.r.y-b.r.y);
          return rows.length===3&&rows[0].close&&rows.every((v,i)=>Math.abs(v.r.width-40)<.01&&Math.abs(v.r.height-40)<.01
            &&Math.abs(v.r.x-rows[0].r.x)<.01&&(i===0||Math.abs(v.r.y-rows[i-1].r.y-44)<.01));
        }),{message:'Close/Undo/Redo keep40px targets on one axis with4px gaps'}).toBe(true);
        const box=await close.boundingBox(),owner=await host.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(owner.x);expect(box.x+box.width).toBeLessThanOrEqual(owner.x+owner.width+1);
        await testInfo.attach('close-'+modeName+'-stacked',{body:await close.locator('..').screenshot(),contentType:'image/png'});
      } else await menuTarget(await headerActionTarget(host,HP.editorClose));
    }
    await (await headerActionTarget(host,HP.editorClose)).click();await expect(host.locator(HP.mode('view'))).toBeVisible();
  }
  expect(Math.max(...toolbarHeights.map(v=>v.height))-Math.min(...toolbarHeights.map(v=>v.height))).toBeLessThanOrEqual(.5);
  for(const value of toolbarHeights)expect(value.height).toBeCloseTo(57,0);
  await testInfo.attach('real-ha-toolbar-heights',{body:JSON.stringify(toolbarHeights,null,2),contentType:'application/json'});
  await testInfo.attach('real-ha-close-centres',{body:JSON.stringify(receipts,null,2),contentType:'application/json'});
});
