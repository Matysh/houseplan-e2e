#!/usr/bin/env node
/**
 * Put the integration under test into the run directory, the way users get it.
 *
 *   node scripts/install-houseplan.mjs --ref=latest   newest GitHub release, prereleases included (HACS beta channel)
 *   node scripts/install-houseplan.mjs --ref=stable   newest non-prerelease
 *   node scripts/install-houseplan.mjs --ref=v1.73.0-beta.6
 *   node scripts/install-houseplan.mjs --ref=dev      branch snapshot (the bundle is committed, no build needed)
 *   node scripts/install-houseplan.mjs --ref=/path/to/houseplan-card   local checkout
 *
 * Releases are installed from the `houseplan.zip` asset — the exact bytes HACS
 * downloads — so the frontend bundle, its assets and the version pin are the
 * shipped ones, not a rebuild.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireVersion } from './release-plan.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'Matysh/houseplan-card';
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const ref = arg('ref', process.env.HOUSEPLAN_REF || 'latest');
const out = resolve(ROOT, arg('out', 'run'));
const target = join(out, 'custom_components', 'houseplan');
const headers = { 'User-Agent': 'houseplan-e2e', Accept: 'application/vnd.github+json' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const fetchJson = async (url) => {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
};
const download = async (url, file) => {
  const r = await fetch(url, { headers: { 'User-Agent': 'houseplan-e2e' } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
};

async function resolveRelease() {
  if (ref === 'latest' || ref === 'stable') {
    const releases = await fetchJson(`https://api.github.com/repos/${REPO}/releases?per_page=20`);
    const pick = releases.find((r) => !r.draft && (ref === 'latest' || !r.prerelease));
    if (!pick) throw new Error(`no ${ref} release found`);
    return pick;
  }
  return fetchJson(`https://api.github.com/repos/${REPO}/releases/tags/${ref}`);
}

rmSync(target, { recursive: true, force: true });
const work = mkdtempSync(join(tmpdir(), 'hp-e2e-'));
let installed;
if (existsSync(ref) && existsSync(join(ref, 'custom_components', 'houseplan'))) {
  cpSync(join(ref, 'custom_components', 'houseplan'), target, { recursive: true });
  installed = `local ${ref}`;
} else if (/^[A-Za-z0-9_.\/-]+$/.test(ref) && !ref.startsWith('v') && ref !== 'latest' && ref !== 'stable') {
  // a branch or commit: codeload tarball, the committed bundle rides along
  const tgz = join(work, 'src.tgz');
  await download(`https://codeload.github.com/${REPO}/tar.gz/${ref}`, tgz);
  execFileSync('tar', ['-xzf', tgz, '-C', work, '--wildcards', '*/custom_components/houseplan/*']);
  const dir = execFileSync('sh', ['-c', `ls -d ${work}/*/custom_components/houseplan`]).toString().trim();
  cpSync(dir, target, { recursive: true });
  installed = `branch ${ref}`;
} else {
  const release = await resolveRelease();
  const asset = release.assets.find((a) => a.name === 'houseplan.zip');
  if (!asset) throw new Error(`${release.tag_name}: no houseplan.zip asset`);
  const zip = join(work, 'houseplan.zip');
  await download(asset.browser_download_url, zip);
  execFileSync('unzip', ['-q', zip, '-d', join(work, 'zip')]);
  // the zip is the integration folder itself (manifest.json at the top level)
  const root = existsSync(join(work, 'zip', 'manifest.json'))
    ? join(work, 'zip') : join(work, 'zip', 'custom_components', 'houseplan');
  cpSync(root, target, { recursive: true });
  installed = `release ${release.tag_name}${release.prerelease ? ' (prerelease)' : ''}`;
}
rmSync(work, { recursive: true, force: true });
const manifest = JSON.parse(readFileSync(join(target, 'manifest.json'), 'utf8'));
requireVersion(manifest.version, arg('expect-version'));
writeFileSync(join(out, '.e2e-houseplan.json'), JSON.stringify({ ref, installed, version: manifest.version }, null, 2));
console.log(`houseplan ${manifest.version} ← ${installed} → ${target}`);
