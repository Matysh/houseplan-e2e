/**
 * The product's declared DOM test contract (houseplan-card#489, #1011) at
 * run time: selector construction validated against the vendored copy, and
 * gating by what the installed product itself declares.
 *
 * The vendored copy (`contract/data-hp-contract.json`, `npm run
 * contract:sync`) is the newest contract the scenarios are written against.
 * The product under test may be older — the nightly runs the latest release,
 * the upgrade suite the previous stable, a 1.82.x hotfix gate a candidate
 * without the 1.83 hooks. The installer stores the contract of the installed
 * ref next to it (`run/.e2e-contract.json`); a scenario whose hooks that
 * contract does not declare is skipped with the reason in the report — never
 * run against a build that cannot satisfy it, never silently passed. Gating
 * by the contract and not by version strings matters: a `dev` snapshot carries
 * the previous release's version (houseplan-card#1010).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CONTRACT = JSON.parse(readFileSync(resolve(ROOT, 'contract/data-hp-contract.json'), 'utf8'));

const runDir = () => process.env.E2E_RUN_DIR || resolve(ROOT, 'run');

/**
 * The installed product's contract and run record; null when unknown (a
 * foreign HA_URL without a run directory) — then nothing is skipped.
 */
export function installedContract() {
  const file = resolve(runDir(), '.e2e-contract.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

export function installedRecord() {
  const file = resolve(runDir(), '.e2e-houseplan.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

/** Does `contract` declare `name` (and, with `name@attr`, that attribute)? */
export function declares(contract, spec) {
  const [name, attr] = spec.split('@');
  const hook = contract?.hooks?.[name];
  if (!hook) return false;
  return !attr || !!(hook.attributes?.[attr] || hook.attributeMetadata?.[attr]);
}

/** Specs (`hook` or `hook@data-attr`) the installed product does not declare. */
export function missingHooks(specs, installed = installedContract()) {
  for (const spec of specs) {
    if (!declares(CONTRACT, spec)) throw new Error(`${spec} is not declared in the vendored contract`);
  }
  if (!installed) return [];
  return specs.filter((spec) => !declares(installed, spec));
}

/**
 * Skip the current file/describe/test when the installed House Plan does not
 * declare every hook it relies on. Call at the top of a file or a describe.
 */
export function requireHooks(test, ...specs) {
  const missing = missingHooks(specs);
  const record = installedRecord();
  test.skip(missing.length > 0,
    `House Plan ${record?.version ?? '?'} (${record?.installed ?? 'unknown ref'}) does not declare ${missing.join(', ')}`);
}

const attrName = (key) => (key.startsWith('data-') ? key : `data-${key}`);
/**
 * The identity every plan object carries (docs/STYLING-HOOKS.md §2): open
 * values, valid on any hook. A closed `data-kind` list, where the JSON has
 * one, is still enforced.
 */
const IDENTITY = new Set(['data-id', 'data-kind', 'data-entity', 'data-area']);

/**
 * `[data-hp="name"][data-…="…"]`, checked against the contract when the
 * selector is built: an undeclared hook, attribute or closed-enum value throws
 * at once instead of waiting out a locator timeout on a real HA. `true` asks
 * for presence only (`[data-hp-device-contact]`-style attributes).
 */
export function hp(name, attrs = {}) {
  const hook = CONTRACT.hooks[name];
  if (!hook) throw new Error(`data-hp="${name}" is not declared in the contract`);
  let selector = `[data-hp="${name}"]`;
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined) continue;
    const attr = attrName(key);
    const closed = hook.attributes?.[attr];
    const open = hook.attributeMetadata?.[attr];
    if (!closed && !open && !IDENTITY.has(attr)) throw new Error(`${attr} is not declared on data-hp="${name}"`);
    if (value === true) {
      selector += `[${attr}]`;
      continue;
    }
    const text = String(value);
    if (closed && !closed.includes(text)) {
      throw new Error(`${attr}="${text}" is not a declared value of data-hp="${name}" (${closed.join(', ')})`);
    }
    selector += `[${attr}="${text.replace(/"/g, '\\"')}"]`;
  }
  return selector;
}

/** Root attributes on the card's ha-card (`data-hp-mode`, `data-hp-state`). */
export function root(attr, value) {
  const declared = CONTRACT.rootAttributes?.[attr];
  if (!declared) throw new Error(`${attr} is not a declared root attribute`);
  if (!declared.values.includes(value)) throw new Error(`${attr}="${value}" is not declared`);
  return `${declared.element}[${attr}="${value}"]`;
}
