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
  const { lintText } = await import('./contract-lint.mjs');
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.m?js$/.test(name) && path !== resolve(ROOT, 'tests/lib/contract.mjs')) files.push(path);
    }
  };
  walk(resolve(ROOT, 'tests'));
  const problems = files.flatMap((file) => lintText(readFileSync(file, 'utf8'), file));
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  const contract = JSON.parse(readFileSync(FILE, 'utf8'));
  console.log(`hooks lint: ${files.length} files, all data-hp selectors declared (contract ${contract.schemaVersion})`);
} else {
  console.error('usage: contract.mjs sync|lint');
  process.exit(2);
}
