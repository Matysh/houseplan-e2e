import test from 'node:test';
import assert from 'node:assert/strict';
import { currentSpace } from '../tests/lib/plan.mjs';

function host(kind = 'tab') {
  let state = kind, reads = 0;
  const root = { querySelector(selector) {
    if (selector.includes('space-select-value')) return state === 'select' ? { value: 'floor-b' } : null;
    return state === 'tab' ? { getAttribute: () => 'floor-a' } : null;
  } };
  return { get reads() { return reads; }, evaluate(fn, args) { reads++; return fn({ shadowRoot: root }, args); },
    locator(selector) { return { first() { return this; },
      async count() { if (selector.includes('space-select-value')) return 0; state='select'; return 1; },
      async getAttribute() { throw Error('tab was replaced by compact navigation between awaits'); } }; },
  };
}

test('current space is read atomically before a tab can be replaced by compact navigation', async () => {
  const h=host();assert.equal(await currentSpace(h),'floor-a');assert.equal(h.reads,1);
});
test('current space reads the selected compact value and tolerates an unfinished navigation DOM', async () => {
  assert.equal(await currentSpace(host('select')),'floor-b');
  assert.equal(await currentSpace(host('none')),null);
});
