#!/usr/bin/env node
/**
 * Build the Home Assistant config directory an E2E run boots from.
 *
 *   node scripts/prepare-seed.mjs [--out=run]
 *
 * `seed/` is the pristine tree (derived from the public demo stand). It is
 * copied verbatim, then the parts that must never be committed are written:
 * the password hashes of the two test users and a fresh instance uuid.
 * Everything else — plan, areas, devices, dashboards, the House Plan config
 * entry — is the seed's own business.
 */
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { USERS } from './users.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const out = resolve(ROOT, arg('out', 'run'));

if (existsSync(out)) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(resolve(ROOT, 'seed'), out, { recursive: true });

// Home Assistant stores bcrypt hashes base64-encoded (auth_provider.homeassistant).
const hash = (password) => Buffer.from(bcrypt.hashSync(password, 12)).toString('base64');
const provider = {
  version: 1,
  minor_version: 1,
  key: 'auth_provider.homeassistant',
  data: {
    users: Object.values(USERS).map((u) => ({ username: u.username, password: hash(u.password) })),
  },
};
mkdirSync(resolve(out, '.storage'), { recursive: true });
writeFileSync(resolve(out, '.storage/auth_provider.homeassistant'), JSON.stringify(provider, null, 2) + '\n');
writeFileSync(resolve(out, '.storage/core.uuid'), JSON.stringify({
  version: 1, minor_version: 1, key: 'core.uuid', data: { uuid: randomBytes(16).toString('hex') },
}, null, 2) + '\n');

console.log(`seed → ${out} (users: ${Object.values(USERS).map((u) => u.username).join(', ')})`);
