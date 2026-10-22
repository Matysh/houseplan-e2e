// The journeys read the product only through its declared contract
// (houseplan-card#489, #1011): selectors are validated when built, scenarios
// are gated on what the installed product declares (houseplan-card#1010).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { CONTRACT, declares, gate, hp, missingHooks, root, sinceOf } from '../tests/lib/contract.mjs';
import { lintText } from '../scripts/contract-lint.mjs';
import { sameTree, treeDigest } from '../scripts/tree-digest.mjs';

test('selectors are built from declared hooks, attributes and closed values only', () => {
  assert.equal(hp('tool', { tool: 'draw' }), '[data-hp="tool"][data-tool="draw"]');
  assert.equal(hp('device', { entity: 'light.a', 'hp-device-component': 'm1' }),
    '[data-hp="device"][data-entity="light.a"][data-hp-device-component="m1"]');
  assert.equal(hp('device', { 'hp-device-contact': true }), '[data-hp="device"][data-hp-device-contact]');
  assert.equal(root('data-hp-mode', 'plan'), 'ha-card[data-hp-mode="plan"]');
  assert.throws(() => hp('no-such-hook'), /not declared/);
  assert.throws(() => hp('tool', { tool: 'teleport' }), /not a declared value/);
  assert.throws(() => hp('stage', { 'grid-size': '5' }), /data-grid-size is not declared/);
  assert.throws(() => root('data-hp-mode', 'edit'), /not declared/);
});

test('scenarios are gated on the installed product contract, not on its version', () => {
  const installed = { hooks: { stage: { attributes: {} }, room: {} } };
  assert.deepEqual(missingHooks(['stage', 'room'], installed), []);
  assert.deepEqual(missingHooks(['stage@data-grid-step', 'wall-node'], installed), ['stage@data-grid-step', 'wall-node']);
  assert.deepEqual(missingHooks(['stage@data-grid-step'], null), [], 'unknown product: nothing skipped');
  assert.throws(() => missingHooks(['stage@data-nope'], installed), /not declared in the vendored contract/);
  assert.equal(declares(CONTRACT, 'stage@data-grid-step'), true);
});

test('the lint judges literal selectors with the run-time builder', () => {
  const good = `hp('tool', { tool: 'draw' }); HP.modeTab('plan'); requireHooks(test, 'stage@data-grid-step');
    '[data-hp="room"]'; HP.mode('view');`;
  assert.deepEqual(lintText(good), []);
  const bad = `hp('tool', { tool: 'teleport' }); HP.dialog('nope'); '[data-hp="ghost"]';
    requireHooks(test, 'stage@data-nope', 'phantom'); HP.mode('edit');`;
  const problems = lintText(bad, 'x.mjs');
  assert.equal(problems.length, 6, problems.join('\n'));
});

test('a build that reproduces the committed bundle is recognised byte for byte', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tree-'));
  const make = (name, files) => {
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, name, rel)), { recursive: true });
      writeFileSync(join(dir, name, rel), body);
    }
    return treeDigest(join(dir, name));
  };
  const committed = make('committed', { 'houseplan-card.js': 'a', 'assets/x-1.js': 'b' });
  assert.equal(sameTree(committed, make('same', { 'houseplan-card.js': 'a', 'assets/x-1.js': 'b' })), true);
  assert.equal(sameTree(committed, make('changed', { 'houseplan-card.js': 'a', 'assets/x-1.js': 'c' })), false);
  assert.equal(sameTree(committed, make('renamed', { 'houseplan-card.js': 'a', 'assets/x-2.js': 'b' })), false);
  assert.equal(sameTree(committed, make('extra', { 'houseplan-card.js': 'a', 'assets/x-1.js': 'b', 'y.js': '' })), false);
  assert.deepEqual(treeDigest(join(dir, 'absent')), {});
});

test('a hook newer than the installed release skips; a hook its version should have fails', () => {
  const installed = { hooks: { stage: { elements: ['svg'] } } };
  assert.equal(sinceOf('stage'), CONTRACT.hooks.stage.since);
  assert.equal(sinceOf('summary-metric@data-id'), CONTRACT.hooks['summary-metric'].attributeMetadata?.['data-id']?.since || CONTRACT.hooks['summary-metric'].since);
  // 1.82.0 under test: the 1.83 hooks are newer — skip, never fail
  assert.deepEqual(gate(['stage', 'summary-metric@data-id'], installed, '1.82.0'), { newer: ['summary-metric@data-id'], lost: [] });
  // the same hook missing from 1.84.0: removed or renamed — fail
  assert.deepEqual(gate(['summary-metric@data-id'], installed, '1.84.0'), { newer: [], lost: ['summary-metric@data-id'] });
  // a prerelease of the version that introduced it counts as older
  const since = sinceOf('summary-metric@data-id');
  assert.deepEqual(gate(['summary-metric@data-id'], installed, `${since}-beta.1`).lost, []);
  // an unknown product version: nothing is called a regression
  assert.deepEqual(gate(['summary-metric@data-id'], installed, undefined), { newer: ['summary-metric@data-id'], lost: [] });
});

test('the latest stable contract (v1.82.0) never turns a journey of this suite into a regression', () => {
  const v182 = JSON.parse(readFileSync(new URL('./fixtures/data-hp-contract-v1.82.0.json', import.meta.url), 'utf8'));
  // the closed value list on an old hook was declared later: unknown age, skipped
  assert.equal(sinceOf('decor@data-kind'), null);
  assert.deepEqual(gate(['decor@data-kind'], v182, '1.82.1'), { newer: ['decor@data-kind'], lost: [] });
  // every requireHooks of every journey, against the release the nightly runs
  const dir = new URL('../tests/', import.meta.url);
  const files = readdirSync(dir, { recursive: true }).filter((f) => /\.(spec|setup)\.mjs$/.test(f));
  let calls = 0;
  for (const file of files) {
    const text = readFileSync(new URL(file, dir), 'utf8');
    for (const [, args] of text.matchAll(/requireHooks\(\s*\w+\s*,([^)]*)\)/g)) {
      const specs = [...args.matchAll(/'([^']+)'/g)].map((m) => m[1]);
      calls++;
      for (const version of ['1.82.0', '1.82.1']) assert.deepEqual(gate(specs, v182, version).lost, [], `${file}: ${specs.join(', ')} on ${version}`);
    }
  }
  assert.ok(calls >= 13, `found ${calls} requireHooks calls`);
});
