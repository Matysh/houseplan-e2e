/** Build a branch/SHA frontend; legacy source snapshots remain reproducible. */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { sameTree, treeDigest } from './tree-digest.mjs';

export function buildSourceFrontend(src, { ref = src, log = console.log, run = (cmd, args) =>
  execFileSync(cmd, args, { cwd: src, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, CI: '1' } }) } = {}) {
  const pkg = JSON.parse(readFileSync(join(src, 'package.json'), 'utf8'));
  if (!pkg.scripts?.['bundle:release']) return 'committed (no bundle:release script in this ref)';
  const frontend = join(src, 'custom_components', 'houseplan', 'frontend');
  const hasCommitted = existsSync(frontend);
  const committed = hasCommitted ? treeDigest(frontend) : null;
  log(`building the frontend of ${ref} from source…`);
  run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  run('npm', ['run', 'build']);
  const keep = join(src, '.committed-frontend');
  if (hasCommitted) cpSync(frontend, keep, { recursive: true });
  run('node', ['scripts/bundle-sync.mjs', '--release']);
  if (hasCommitted && sameTree(committed, treeDigest(frontend))) {
    rmSync(frontend, { recursive: true, force: true });
    cpSync(keep, frontend, { recursive: true });
    return 'committed (the build reproduces it byte for byte)';
  }
  return hasCommitted ? 'built from source (the committed bundle lags behind this commit)'
    : 'built from source (no committed frontend snapshot)';
}
