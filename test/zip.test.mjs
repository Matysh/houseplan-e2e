// The ZIP helpers of the backup journeys (tests/lib/zip.mjs) and the archive
// builder of the backup fixtures: round trip, and a manifest that agrees with
// the entries the way the integration's reader demands (backup_archive.py).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readZip, writeZip } from '../tests/lib/zip.mjs';
import { readFileSync } from 'node:fs';
import { archive, PLAN, TILE } from '../tests/lib/backup-fixtures.mjs';
import { repairsBackups } from '../tests/lib/contract.mjs';

const sha = (raw) => createHash('sha256').update(raw).digest('hex');

test('a written ZIP reads back entry by entry, in order, byte for byte', () => {
  const files = [['a/b.txt', Buffer.from('hello '.repeat(100))], ['empty.json', Buffer.alloc(0)], ['bin', Buffer.from([0, 255, 1, 254])]];
  const zip = writeZip(files);
  const read = readZip(zip);
  assert.deepEqual(Object.keys(read), files.map(([name]) => name));
  for (const [name, data] of files) assert.ok(read[name].equals(data), name);
  assert.ok(writeZip(files).equals(zip), 'same input, same bytes');
});

test('a truncated ZIP is refused', () => {
  const zip = writeZip([['x', Buffer.from('x'.repeat(1000))]]);
  assert.throws(() => readZip(zip.subarray(0, zip.length - 30)));
});

test('the archive manifest describes exactly the packed entries; missing and external images are named', () => {
  const document = {
    format: 'houseplan-export', export_version: 2, kind: 'full', model_version: 10,
    payload: {
      config: {
        spaces: [
          { id: 'a', title: 'A', plan_url: '/api/houseplan/content/plans/_/a.svg', decor: [{ id: 'p', kind: 'image', asset_id: sha(TILE) }, { id: 'q', kind: 'image', asset_id: 'f'.repeat(64) }] },
          { id: 'b', title: 'B', plan_url: 'https://example.com/b.png', decor: [] },
        ],
        markers: [],
      },
      layout: {},
    },
  };
  const files = new Map([['/api/houseplan/content/plans/_/a.svg', PLAN], [sha(TILE), TILE]]);
  const entries = readZip(archive({ document, files, topics: { z2m: { obtained_at: 1, map: { nodes: [], links: [] } } } }));
  const manifest = JSON.parse(entries['manifest.json']);
  assert.equal(Object.keys(entries).at(-1), 'manifest.json');
  assert.equal(manifest.complete, false);
  assert.deepEqual(manifest.images.map((row) => row.blob ? 'blob' : row.reason), ['blob', 'blob', 'missing', 'external']);
  const described = { 'document.json': manifest.document, 'zigbee.json': manifest.snapshot, ...manifest.blobs };
  assert.deepEqual(Object.keys(entries).filter((name) => name !== 'manifest.json').sort(), Object.keys(described).sort());
  for (const [name, meta] of Object.entries(described)) {
    assert.equal(meta.entry, name);
    assert.equal(meta.bytes, entries[name].length);
    assert.equal(meta.sha256, sha(entries[name]));
  }
  assert.ok(entries[`images/${sha(TILE)}.png`].equals(TILE));
  assert.ok(entries[`images/${sha(PLAN)}.svg`].equals(PLAN));
  // houseplan-card#1033 packs the seed backdrop as it ships, labels included;
  // an older product needs it without its <text> (F125)
  const seed = readFileSync(new URL('../seed/houseplan/plans/first-floor.svg', import.meta.url));
  if (repairsBackups()) assert.ok(PLAN.equals(seed), 'the fixture backdrop is the seed SVG byte for byte');
  else assert.ok(!PLAN.toString('utf8').includes('<text'), 'the fixture backdrop carries no <text> (F125)');
});
