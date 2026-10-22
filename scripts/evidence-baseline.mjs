#!/usr/bin/env node
/**
 * Make the frames of a green stable-release gate the new "last stable"
 * baseline (houseplan-card#1010): `evidence/stable/<tag>/` holds exactly the
 * frames of that run, every older tag directory is removed from the tree (git
 * history keeps them). Run by the `evidence-baseline` job of e2e.yml after all
 * suites of the gate passed; the job commits and pushes the result to main.
 *
 *   node scripts/evidence-baseline.mjs --tag=v1.83.0 --from=downloaded-evidence [--root=evidence/stable]
 *
 * `--from` holds the merged evidence artifacts of the run: `<project>/<spec>/<frame>.png`.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listPngs } from './evidence-diff.mjs';
import { compareTags } from './tags.mjs';

export function promoteBaseline({ tag, from, root }) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error(`not a stable tag: ${tag}`);
  const frames = listPngs(from);
  if (!frames.length) throw new Error(`no evidence frames under ${from}`);
  // a gate re-run for an older stable tag (a hotfix line, a repair) never
  // replaces the frames of a newer one: the baseline only moves forward
  const newer = existsSync(root) ? readdirSync(root).filter((name) => compareTags(name, tag) > 0) : [];
  if (newer.length) return { tag, frames: 0, skipped: `newer baseline ${newer.sort(compareTags).at(-1)}` };
  if (existsSync(root)) {
    for (const name of readdirSync(root)) rmSync(join(root, name), { recursive: true, force: true });
  }
  const target = join(root, tag);
  mkdirSync(target, { recursive: true });
  for (const frame of frames) {
    mkdirSync(join(target, frame, '..'), { recursive: true });
    cpSync(join(from, frame), join(target, frame));
  }
  return { tag, frames: frames.length };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (name, fallback) => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : fallback;
  };
  const result = promoteBaseline({
    tag: arg('tag', ''), from: resolve(arg('from', 'downloaded-evidence')), root: resolve(arg('root', 'evidence/stable')),
  });
  console.log(result.skipped ? `evidence/stable/${result.tag}: skipped, ${result.skipped}` : `evidence/stable/${result.tag}: ${result.frames} frames`);
}
