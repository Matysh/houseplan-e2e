import test from 'node:test';
import assert from 'node:assert/strict';
import { historicalHp, hp, missingHooks } from '../tests/lib/contract.mjs';
import { hasBeta4PanelContract, hasBeta5UiPolishContract } from '../tests/lib/panel-release-contract.mjs';
import { lintText } from '../scripts/contract-lint.mjs';

const previous = { hooks: { 'panel-title': {} } };
const current = {
  hooks: {},
  retiredHooks: { 'panel-title': { retired: '1.83.0-beta.4', issue: 1120 } },
};

test('pre-release source runs the panel contract declared by that installed source', () => {
  assert.equal(hasBeta4PanelContract('1.83.0-beta.3', current), true);
  assert.equal(hasBeta4PanelContract('1.83.0-beta.3', previous), false);
  assert.equal(hasBeta4PanelContract('1.82.0', previous), false);
  assert.equal(hasBeta4PanelContract('1.83.0-beta.4', previous), true,
    'a release that promises the feature must execute and expose a regression');
  assert.equal(hasBeta4PanelContract('', null), true, 'foreign HA uses newest expectations');
  assert.equal(hasBeta4PanelContract('1.83.0-beta.3', {
    ...current, retiredHooks: { 'panel-title': { retired: '1.83.0-beta.4', issue: 999 } },
  }), false, 'an unrelated retirement is not evidence of this contract');
});

test('historical selectors permit declared retirement without making it a live hook', () => {
  const expected = '[data-hp="panel-title"]';
  assert.equal(historicalHp('panel-title', previous), expected);
  assert.equal(historicalHp('panel-title', current), expected);
  assert.throws(() => historicalHp('absent', current), /not declared or retired/);
  assert.throws(() => historicalHp('bad"]', current), /invalid historical/);
  assert.throws(() => historicalHp('panel-title', { hooks: {}, retiredHooks: { 'panel-title': {} } }),
    /not declared or retired/);
  // The ordinary builders and required live-hook checks remain strict.
  assert.throws(() => hp('no-such-hook'), /not declared/);
  assert.deepEqual(missingHooks(['stage'], { hooks: {}, retiredHooks: { stage: { retired: '1.0' } } }),
    ['stage']);
});

test('lint validates the explicit historical selector while live requirements reject retirement', () => {
  assert.deepEqual(lintText("historicalHp('panel-title')", '<test>', current), []);
  assert.equal(lintText("historicalHp('absent')", '<test>', current).length, 1);
  assert.equal(lintText("requireHooks(test, 'panel-title')", '<test>', current).length, 1);
});

test('#1132 routes only the shipped beta.5/stable UI expectations, retaining older releases',()=>{
  for(const v of ['1.82.0','1.83.0-beta.4','']) assert.equal(hasBeta5UiPolishContract(v),false);
  for(const v of ['1.83.0-beta.5','1.83.0-beta.6','1.83.0','1.84.0']) assert.equal(hasBeta5UiPolishContract(v),true);
});