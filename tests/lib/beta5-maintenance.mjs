/** Beta.5 journeys use real gestures and authenticated config/layout oracles. */
import {expect} from '@playwright/test';
import {installedRecord} from './contract.mjs';
import {compareTags} from '../../scripts/tags.mjs';
import {HP,hp} from './hooks.mjs';
import {planConfig,planLayout,spaceOf,waitForConfig,wsCall} from './ha-ws.mjs';
import {clickFloor,enterEditor,leaveEditor,stage,gridStep,useTool,settle} from './plan.mjs';
import {visiblePlanSegment} from './visible-plan-target.mjs';
import {evidence} from './ha-page.mjs';

export function beta5Maintenance(){
 const version=installedRecord()?.version;
 return !version||compareTags('v'+version,'v1.84.0-beta.5')>=0;
}

export async function nativeDiagonalMaintenance(page,host,info,spaceId){
 if(!beta5Maintenance())return;
 await enterEditor(host,'plan');await useTool(host,'draw');
 const targets=await stage(host).evaluate(visiblePlanSegment,{step:await gridStep(host),clearInterior:true,
  pattern:[[[0,0],[3,2]],[[1.5,1],[1.5,5]]]});
 const [support,branch]=targets.segments;
 await info.attach('beta5-native-diagonal-targets.json',{body:JSON.stringify(targets,null,2),contentType:'application/json'});
 const before=(await planConfig()).config,old=spaceOf(before,spaceId).plan_graph;
 const oldIds=new Set(old.nodes.map(n=>n.id));
 for(const p of [support.a,support.b])await clickFloor(page,host,p.x,p.y);
 await page.keyboard.press('Escape');
 await waitForConfig(c=>spaceOf(c,spaceId).plan_graph.edges.length===old.edges.length+1,{message:'native diagonal support persisted'});
 await useTool(host,'draw');
 for(const p of [branch.a,branch.b])await clickFloor(page,host,p.x,p.y);
 await page.keyboard.press('Escape');
 const saved=await waitForConfig(c=>spaceOf(c,spaceId).plan_graph.edges.length===old.edges.length+3,{message:'native T split and branch persisted'});
 const graph=spaceOf(saved,spaceId).plan_graph;
 const dependent=graph.dependencies.filter(d=>!oldIds.has(d.node));
 expect(dependent.length,'real native Draw creates a dependent T').toBeGreaterThan(0);
 expect(dependent.some(d=>graph.nodes.find(n=>n.id===d.node)?.p[0]==='q'),'diagonal T keeps exact rational coordinates').toBe(true);
 const portable=await wsCall({type:'houseplan/export/create',kind:'full'});
 expect(spaceOf(portable.document.payload.config,spaceId).plan_graph).toEqual(graph);
 await evidence(info,page,'beta5-native-diagonal-saved');
 await leaveEditor(host);await settle(host);
 const [configBefore,layoutBefore]=await Promise.all([planConfig(),planLayout()]);
 await host.locator(HP.settings).first().click();
 const settings=host.locator(HP.dialog('settings')).first();await expect(settings).toBeVisible();
 await settings.locator(hp('settings-section',{kind:'general',section:'data'})).first().click();
 await settings.locator(HP.action('plan-optimize')).click();
 const optimize=host.locator(HP.dialog('settings')).last();
 await expect(optimize).toContainText('All plans already use the current optimized data model.');
 await expect(optimize.locator(HP.dialogConfirm)).toHaveCount(0);
 await evidence(info,page,'beta5-native-optimize-no-op');
 await optimize.locator(HP.dialogCancel).last().click();
 await settings.locator(HP.dialogCancel).last().click();
 const [configAfter,layoutAfter]=await Promise.all([planConfig(),planLayout()]);
 expect(configAfter.config).toEqual(configBefore.config);expect(configAfter.rev).toBe(configBefore.rev);
 expect(layoutAfter.layout).toEqual(layoutBefore.layout);expect(layoutAfter.rev).toBe(layoutBefore.rev);
 await page.reload();
 expect(spaceOf((await planConfig()).config,spaceId).plan_graph).toEqual(graph);
}
