// Evidence frames and their diff to the last stable release (houseplan-card#1010).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';
import {
  compareTags, comparePng, diffEvidence, DIFF_COLOR, gallery, stableTag, summaryMarkdown,
} from '../scripts/evidence-diff.mjs';
import { promoteBaseline } from '../scripts/evidence-baseline.mjs';

/** A solid PNG with optional single-pixel overrides `{ x, y, rgb }`. */
function png(width, height, rgb = [200, 200, 200], dots = []) {
  const image = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) image.data.set([...rgb, 255], i * 4);
  for (const { x, y, rgb: c } of dots) image.data.set([...c, 255], (y * width + x) * 4);
  return PNG.sync.write(image);
}
const write = (root, rel, buffer) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), buffer);
};
const pixel = (buffer, x, y) => {
  const image = PNG.sync.read(buffer);
  return [...image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 3)];
};

test('versions order like releases: beta < rc < stable, numerically', () => {
  const tags = ['v1.83.0', 'v1.82.0', 'v1.83.0-beta.2', 'v1.10.0', 'v1.83.0-rc.1', 'v1.83.0-beta.10'];
  assert.deepEqual([...tags].sort(compareTags),
    ['v1.10.0', 'v1.82.0', 'v1.83.0-beta.2', 'v1.83.0-beta.10', 'v1.83.0-rc.1', 'v1.83.0']);
});

test('identical frames have no differing pixels; a changed pixel is pink on grey', () => {
  const same = comparePng(png(8, 6), png(8, 6));
  assert.equal(same.diffPixels, 0);
  const changed = comparePng(png(8, 6), png(8, 6, [200, 200, 200], [{ x: 3, y: 2, rgb: [0, 0, 0] }]));
  assert.equal(changed.diffPixels, 1);
  assert.deepEqual(pixel(changed.diff, 3, 2), DIFF_COLOR);
  const [r, g, b] = pixel(changed.diff, 0, 0);
  assert.ok(r === g && g === b && r > 200, `background is light grey, got ${[r, g, b]}`);
});

test('a frame of another size is reported, not compared', () => {
  const result = comparePng(png(8, 6), png(9, 6));
  assert.equal(result.sizeMismatch, true);
  assert.equal(result.stableWidth, 8);
  assert.equal(result.width, 9);
});

test('the run is diffed against the highest stable tag, scoped to its own projects', () => {
  const root = mkdtempSync(join(tmpdir(), 'evidence-'));
  const current = join(root, 'current');
  const stable = join(root, 'stable');
  write(join(stable, 'v1.81.0'), 'admin/plan/old.png', png(4, 4, [0, 0, 0]));
  write(join(stable, 'v1.82.0'), 'admin/plan/same.png', png(4, 4));
  write(join(stable, 'v1.82.0'), 'admin/plan/changed.png', png(4, 4));
  write(join(stable, 'v1.82.0'), 'admin/plan/gone.png', png(4, 4));
  write(join(stable, 'v1.82.0'), 'admin/plan/resized.png', png(4, 4));
  write(join(stable, 'v1.82.0'), 'upgrade/upgrade/after.png', png(4, 4)); // another job's project
  write(current, 'admin/plan/same.png', png(4, 4));
  write(current, 'admin/plan/changed.png', png(4, 4, [200, 200, 200], [{ x: 1, y: 1, rgb: [10, 10, 10] }]));
  write(current, 'admin/plan/resized.png', png(5, 4));
  write(current, 'admin/plan/fresh.png', png(4, 4));
  const out = join(root, 'out');
  const report = diffEvidence({ current, stable, out });
  assert.equal(stableTag(stable), 'v1.82.0');
  assert.equal(report.stable, 'v1.82.0');
  assert.deepEqual(report.counts, { size: 1, changed: 1, missing: 1, new: 1, same: 1 });
  assert.deepEqual(report.frames.map((f) => `${f.status}:${f.frame}`), [
    'size:admin/plan/resized.png', 'changed:admin/plan/changed.png', 'missing:admin/plan/gone.png',
    'new:admin/plan/fresh.png', 'same:admin/plan/same.png',
  ]);
  const changed = report.frames.find((f) => f.status === 'changed');
  assert.equal(changed.diffPixels, 1);
  assert.equal(changed.ratio, 1 / 16);
  for (const rel of [changed.diff, changed.stable, changed.current, 'diff.json', 'index.html']) {
    assert.ok(existsSync(join(out, rel)), `${rel} written`);
  }
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'diff.json'), 'utf8')).counts, report.counts);
  const html = gallery(report);
  assert.ok(html.indexOf('resized.png') < html.indexOf('changed.png'), 'largest difference first');
  assert.match(summaryMarkdown(report, 'journeys'), /`admin\/plan\/changed\.png` \| changed \| 6\.25 %/);
});

test('without a stable baseline every frame is new', () => {
  const root = mkdtempSync(join(tmpdir(), 'evidence-'));
  write(join(root, 'current'), 'admin/x/a.png', png(2, 2));
  const report = diffEvidence({ current: join(root, 'current'), stable: join(root, 'none'), out: join(root, 'out') });
  assert.equal(report.stable, null);
  assert.deepEqual(report.counts, { size: 0, changed: 0, missing: 0, new: 1, same: 0 });
  assert.match(summaryMarkdown(report), /no baseline yet/);
  assert.match(summaryMarkdown(report, 't', { artifact: 'evidence-7-journeys-ha-stable', link: 'https://x/runs/1#artifacts' }),
    /Gallery: `diff\/index\.html` in \[`evidence-7-journeys-ha-stable`\]\(https:\/\/x\/runs\/1#artifacts\)/);
});

test('a green stable gate replaces the baseline with its own frames only', () => {
  const root = mkdtempSync(join(tmpdir(), 'baseline-'));
  const from = join(root, 'downloaded');
  const stable = join(root, 'stable');
  write(join(stable, 'v1.82.0'), 'admin/plan/old.png', png(2, 2));
  write(from, 'admin/plan/new.png', png(2, 2));
  write(from, 'first-run-admin/first-space/created.png', png(2, 2));
  assert.deepEqual(promoteBaseline({ tag: 'v1.83.0', from, root: stable }), { tag: 'v1.83.0', frames: 2 });
  assert.equal(existsSync(join(stable, 'v1.82.0')), false);
  assert.ok(existsSync(join(stable, 'v1.83.0', 'admin/plan/new.png')));
  assert.throws(() => promoteBaseline({ tag: 'v1.84.0-beta.1', from, root: stable }), /not a stable tag/);
  assert.throws(() => promoteBaseline({ tag: 'v1.84.0', from: join(root, 'empty'), root: stable }), /no evidence frames/);
  // never backwards: an older stable gate leaves the newer baseline alone
  assert.deepEqual(promoteBaseline({ tag: 'v1.82.1', from, root: stable }), { tag: 'v1.82.1', frames: 0, skipped: 'newer baseline v1.83.0' });
  assert.ok(existsSync(join(stable, 'v1.83.0', 'admin/plan/new.png')));
  assert.equal(existsSync(join(stable, 'v1.82.1')), false);
});
