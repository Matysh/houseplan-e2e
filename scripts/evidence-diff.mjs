#!/usr/bin/env node
/**
 * Evidence frames of this run next to the frames of the last stable release
 * (houseplan-card#1010): for every frame a grey copy of the stable frame with
 * the differing pixels in pink, a `diff.json` with the count and share of
 * differing pixels per frame, a static `index.html` gallery (stable / current /
 * diff, the largest difference first) and a short table for the job summary.
 *
 *   node scripts/evidence-diff.mjs --current=evidence-out --stable=evidence/stable \
 *     --out=artifacts/evidence [--summary=$GITHUB_STEP_SUMMARY] [--title="journeys · HA stable"] \
 *     [--artifact=<artifact name> --link=<run URL>]
 *
 * Not a gate and not an analysis: no thresholds, no masks, the exit code does
 * not depend on the differences. It is material for the owner's eyes, or for an
 * agent when asked. Antialiasing differences are detected by pixelmatch and
 * left grey; only real differences are painted.
 *
 * The stable baseline is `evidence/stable/<tag>/` committed to this repository
 * by the stable release gate (scripts/evidence-baseline.mjs); with several tag
 * directories the highest version wins, with none every frame is "new".
 */
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { compareTags } from './tags.mjs';

export const DIFF_COLOR = [255, 64, 160]; // pink
export const GREY_ALPHA = 0.35; // how strongly the stable frame shows through
const AA_SENTINEL = [1, 2, 3];

export { compareTags };

/** The tag directory under `stableRoot` that holds the last stable frames. */
export function stableTag(stableRoot) {
  if (!existsSync(stableRoot)) return null;
  const tags = readdirSync(stableRoot).filter((name) => statSync(join(stableRoot, name)).isDirectory());
  return tags.sort(compareTags).at(-1) ?? null;
}

export function listPngs(root) {
  const out = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.png')) out.push(relative(root, path).split('\\').join('/'));
    }
  };
  walk(root);
  return out.sort();
}

/**
 * Compare two PNG buffers. Returns `{ width, height, diffPixels, diff }` where
 * `diff` is a PNG buffer: the stable frame in grey, differences in pink,
 * antialiasing left grey. Different sizes return `{ sizeMismatch: true }`.
 */
export function comparePng(stableBuffer, currentBuffer) {
  const a = PNG.sync.read(stableBuffer);
  const b = PNG.sync.read(currentBuffer);
  if (a.width !== b.width || a.height !== b.height) {
    return { sizeMismatch: true, width: b.width, height: b.height, stableWidth: a.width, stableHeight: a.height };
  }
  const out = new PNG({ width: a.width, height: a.height });
  const diffPixels = pixelmatch(a.data, b.data, out.data, a.width, a.height, {
    threshold: 0.1, includeAA: false, alpha: GREY_ALPHA, aaColor: AA_SENTINEL, diffColor: DIFF_COLOR,
  });
  // pixelmatch paints antialiasing in aaColor; repaint those pixels grey
  for (let i = 0; i < out.data.length; i += 4) {
    if (out.data[i] === AA_SENTINEL[0] && out.data[i + 1] === AA_SENTINEL[1] && out.data[i + 2] === AA_SENTINEL[2]) {
      const y = 0.29889531 * a.data[i] + 0.58662247 * a.data[i + 1] + 0.11448223 * a.data[i + 2];
      const grey = 255 + (y - 255) * GREY_ALPHA * (a.data[i + 3] / 255);
      out.data[i] = out.data[i + 1] = out.data[i + 2] = Math.round(grey);
      out.data[i + 3] = 255;
    }
  }
  return { width: a.width, height: a.height, diffPixels, diff: PNG.sync.write(out) };
}

const STATUS_ORDER = { size: 0, changed: 1, missing: 2, new: 3, same: 4 };

export function diffEvidence({ current, stable: stableRoot, out }) {
  const tag = stableTag(stableRoot);
  const stableDir = tag ? join(stableRoot, tag) : null;
  const currentFrames = listPngs(current);
  // a job compares only its own projects: the journeys job has no first-run
  // or upgrade frames, and their stable frames are not "missing" from it
  const projects = new Set(currentFrames.map((f) => f.split('/')[0]));
  const stableFrames = (stableDir ? listPngs(stableDir) : []).filter((f) => projects.has(f.split('/')[0]));
  const frames = [];
  const place = (frame, name, from) => {
    const target = join(out, 'frames', frame.replace(/\.png$/, ''), name);
    mkdirSync(dirname(target), { recursive: true });
    if (Buffer.isBuffer(from)) writeFileSync(target, from);
    else copyFileSync(from, target);
    return relative(out, target).split('\\').join('/');
  };
  for (const frame of currentFrames) {
    const record = { frame, current: place(frame, 'current.png', join(current, frame)) };
    if (!stableFrames.includes(frame)) {
      const png = PNG.sync.read(readFileSync(join(current, frame)));
      frames.push({ ...record, status: 'new', width: png.width, height: png.height, diffPixels: null, ratio: null });
      continue;
    }
    record.stable = place(frame, 'stable.png', join(stableDir, frame));
    const result = comparePng(readFileSync(join(stableDir, frame)), readFileSync(join(current, frame)));
    if (result.sizeMismatch) {
      frames.push({ ...record, status: 'size', width: result.width, height: result.height,
        stableWidth: result.stableWidth, stableHeight: result.stableHeight, diffPixels: null, ratio: 1 });
      continue;
    }
    const ratio = result.diffPixels / (result.width * result.height);
    frames.push({ ...record, diff: place(frame, 'diff.png', result.diff), status: result.diffPixels ? 'changed' : 'same',
      width: result.width, height: result.height, diffPixels: result.diffPixels, ratio });
  }
  for (const frame of stableFrames) {
    if (!currentFrames.includes(frame)) {
      frames.push({ frame, stable: place(frame, 'stable.png', join(stableDir, frame)), status: 'missing', diffPixels: null, ratio: null });
    }
  }
  frames.sort((x, y) => (STATUS_ORDER[x.status] - STATUS_ORDER[y.status]) || ((y.ratio ?? 0) - (x.ratio ?? 0)) || x.frame.localeCompare(y.frame));
  const counts = Object.fromEntries(Object.keys(STATUS_ORDER).map((s) => [s, frames.filter((f) => f.status === s).length]));
  const report = { stable: tag, generated: new Date().toISOString(), counts, frames };
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'diff.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(out, 'index.html'), gallery(report));
  return report;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (ratio) => (ratio == null ? '—' : `${(ratio * 100).toFixed(ratio > 0 && ratio < 0.0001 ? 4 : 2)} %`);

export function gallery(report) {
  const cell = (src, label) => (src
    ? `<a href="${esc(src)}"><img loading="lazy" src="${esc(src)}" alt="${esc(label)}"></a>`
    : '<div class="none">—</div>');
  const rows = report.frames.map((f) => `<tr class="${f.status}">
<th scope="row"><code>${esc(f.frame)}</code><br><span class="tag">${esc(f.status)}</span> ${pct(f.ratio)}${f.diffPixels ? ` · ${f.diffPixels} px` : ''}</th>
<td>${cell(f.stable, 'stable')}</td><td>${cell(f.current, 'current')}</td><td>${cell(f.diff, 'diff')}</td></tr>`).join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>House Plan E2E evidence — diff to ${esc(report.stable ?? 'no stable baseline')}</title>
<style>
body{font:14px/1.4 system-ui,sans-serif;margin:16px;background:#fff;color:#111}
table{border-collapse:collapse;width:100%}th,td{border-top:1px solid #ddd;padding:8px;vertical-align:top}
th{text-align:left;width:22%;font-weight:400}td{width:26%}img{width:100%;height:auto;border:1px solid #ccc}
.tag{display:inline-block;padding:0 6px;border-radius:8px;background:#eee}.changed .tag,.size .tag{background:#ffd1e6}
.new .tag{background:#d6ecff}.missing .tag{background:#fff0c2}.none{color:#999;padding:24px;text-align:center;border:1px dashed #ccc}
thead th{position:sticky;top:0;background:#fff}
</style></head><body>
<h1>Evidence frames — this run against stable ${esc(report.stable ?? '(none yet)')}</h1>
<p>${Object.entries(report.counts).map(([k, v]) => `${esc(k)}: ${v}`).join(' · ')}. Pink pixels differ from the stable frame;
antialiasing stays grey. Material for review — not a gate, no thresholds.</p>
<table><thead><tr><th>frame</th><th>stable ${esc(report.stable ?? '')}</th><th>this run</th><th>diff</th></tr></thead>
<tbody>
${rows}
</tbody></table></body></html>
`;
}

export function summaryMarkdown(report, title = 'Evidence frames', { artifact = '', link = '' } = {}) {
  const lines = [`### ${title}: frames against stable ${report.stable ? `\`${report.stable}\`` : '(no baseline yet)'}`, '',
    Object.entries(report.counts).map(([k, v]) => `${k}: **${v}**`).join(' · '), ''];
  const shown = report.frames.filter((f) => f.status !== 'same').slice(0, 25);
  if (shown.length) {
    lines.push('| frame | status | differing pixels |', '| --- | --- | --- |');
    for (const f of shown) lines.push(`| \`${f.frame}\` | ${f.status} | ${pct(f.ratio)}${f.diffPixels ? ` (${f.diffPixels})` : ''} |`);
    lines.push('');
  }
  const where = artifact ? (link ? `[\`${artifact}\`](${link})` : `\`${artifact}\``) : 'the evidence artifact';
  lines.push(`Gallery: \`diff/index.html\` in ${where} (stable / this run / diff). Not a gate.`, '');
  return lines.join('\n');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (name, fallback) => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : fallback;
  };
  const report = diffEvidence({
    current: resolve(arg('current', 'evidence-out')),
    stable: resolve(arg('stable', 'evidence/stable')),
    out: resolve(arg('out', 'artifacts/evidence')),
  });
  const md = summaryMarkdown(report, arg('title', 'Evidence frames'), { artifact: arg('artifact', ''), link: arg('link', '') });
  const summary = arg('summary', process.env.GITHUB_STEP_SUMMARY || '');
  if (summary) appendFileSync(summary, `${md}\n`);
  console.log(md);
}
