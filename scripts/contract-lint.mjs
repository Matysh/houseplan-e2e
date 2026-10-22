/**
 * Static check of the journeys against the vendored contract: every literal
 * selector a test spells — `data-hp="…"`, `hp('…', { … })`, the `HP.*`
 * shorthands, `requireHooks(test, …)` — is run through the same builder the
 * tests use at run time (tests/lib/contract.mjs), before any HA is started.
 */
import { CONTRACT, hp, root } from '../tests/lib/contract.mjs';

const SHORTHANDS = {
  tool: ['tool', 'tool'], modeTab: ['mode-tab', 'mode'], toolbar: ['toolbar', 'kind'],
  dialog: ['dialog', 'kind'], field: ['field', 'field'], action: ['action', 'action'],
};

const literalAttrs = (body = '') => Object.fromEntries([...body.matchAll(/([A-Za-z][\w-]*|'[^']+')\s*:\s*'([^']*)'/g)]
  .map(([, key, value]) => [key.replace(/'/g, ''), value]));

export function lintText(text, file = '<text>', contract = CONTRACT) {
  const problems = [];
  const declared = new Set(Object.keys(contract.hooks));
  const roots = contract.rootAttributes || {};
  const kinds = new Set(Object.values(contract.hooks).flatMap((h) => h.attributes?.['data-kind'] || []));
  const check = (what, fn) => {
    try { fn(); } catch (error) { problems.push(`${file}: ${what}: ${error.message}`); }
  };
  for (const m of text.matchAll(/data-hp="([a-z0-9-]+)"/g)) {
    if (!declared.has(m[1])) problems.push(`${file}: data-hp="${m[1]}" is not declared`);
  }
  for (const m of text.matchAll(/(data-hp-(?:mode|state))="([a-z0-9-]+)"/g)) {
    const rootAttr = roots[m[1]];
    if (!rootAttr) problems.push(`${file}: ${m[1]} is not a declared root attribute`);
    else if (!rootAttr.values.includes(m[2])) problems.push(`${file}: ${m[1]}="${m[2]}" is not a declared value`);
  }
  for (const m of text.matchAll(/data-kind="([a-z0-9-]+)"/g)) {
    if (!kinds.has(m[1])) problems.push(`${file}: data-kind="${m[1]}" is not declared for any hook`);
  }
  for (const m of text.matchAll(/\bhp\(\s*'([a-z0-9-]+)'\s*(?:,\s*\{([^}]*)\})?/g)) {
    check(`hp('${m[1]}')`, () => hp(m[1], literalAttrs(m[2])));
  }
  for (const m of text.matchAll(/\bHP\.(tool|modeTab|toolbar|dialog|field|action)\(\s*'([^']+)'/g)) {
    const [hook, attr] = SHORTHANDS[m[1]];
    check(`HP.${m[1]}('${m[2]}')`, () => hp(hook, { [attr]: m[2] }));
  }
  for (const m of text.matchAll(/\bHP\.mode\(\s*'([^']+)'/g)) check(`HP.mode('${m[1]}')`, () => root('data-hp-mode', m[1]));
  for (const m of text.matchAll(/\b(?:requireHooks|missingHooks)\(\s*(?:test\s*,)?([^)]*)\)/g)) {
    for (const spec of m[1].matchAll(/'([^']+)'/g)) {
      const [name, attr] = spec[1].split('@');
      const hook = contract.hooks[name];
      if (!hook) problems.push(`${file}: '${spec[1]}' names an undeclared hook`);
      else if (attr && !hook.attributes?.[attr] && !hook.attributeMetadata?.[attr]) {
        problems.push(`${file}: '${spec[1]}' names an attribute the hook does not declare`);
      }
    }
  }
  return problems;
}
