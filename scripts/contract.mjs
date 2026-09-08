#!/usr/bin/env node
/**
 * The product's declared DOM test contract (houseplan-card#489):
 * docs/data-hp-contract.json. `sync` refreshes the vendored copy from a ref;
 * `lint` checks that every data-hp value the journeys rely on is declared —
 * a renamed hook fails here, in seconds, not in a 5-minute HA run.
 *
 *   node scripts/contract.mjs sync [--ref=dev]
 *   node scripts/contract.mjs lint
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(ROOT, 'contract/data-hp-contract.json');
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const cmd = process.argv[2];

if (cmd === 'sync') {
  const ref = arg('ref', 'dev');
  const url = `https://raw.githubusercontent.com/Matysh/houseplan-card/${ref}/docs/data-hp-contract.json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const text = await r.text();
  JSON.parse(text);
  writeFileSync(FILE, text.endsWith('\n') ? text : `${text}\n`);
  console.log(`contract ← ${ref}`);
} else if (cmd === 'lint') {
  const contract = JSON.parse(readFileSync(FILE, 'utf8'));
  const declared = new Set(Object.keys(contract.hooks));
  const roots = contract.rootAttributes || {};
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.m?js$/.test(name)) files.push(path);
    }
  };
  walk(resolve(ROOT, 'tests'));
  const problems = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/data-hp="([a-z0-9-]+)"/g)) {
      if (!declared.has(m[1])) problems.push(`${file}: data-hp="${m[1]}" is not declared`);
    }
    for (const m of text.matchAll(/(data-hp-[a-z]+)="([a-z0-9-]+)"/g)) {
      const root = roots[m[1]];
      if (!root) problems.push(`${file}: ${m[1]} is not a declared root attribute`);
      else if (!root.values.includes(m[2])) problems.push(`${file}: ${m[1]}="${m[2]}" is not a declared value`);
    }
    for (const m of text.matchAll(/data-kind="([a-z0-9-]+)"/g)) {
      const kinds = new Set([
        ...(contract.hooks.dialog?.attributes?.['data-kind'] || []),
        ...(contract.hooks.toolbar?.attributes?.['data-kind'] || []),
        ...(contract.hooks.toast?.attributes?.['data-kind'] || []),
        ...(contract.hooks.opening?.attributes?.['data-kind'] || []),
        ...(contract.hooks.decor?.attributes?.['data-kind'] || []),
      ]);
      if (!kinds.has(m[1])) problems.push(`${file}: data-kind="${m[1]}" is not declared for any hook`);
    }
  }
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log(`hooks lint: ${files.length} files, all data-hp selectors declared (contract ${contract.schemaVersion})`);
} else {
  console.error('usage: contract.mjs sync|lint');
  process.exit(2);
}
