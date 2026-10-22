import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planRun, githubOps, requireVersion } from '../scripts/release-plan.mjs';

const TARGET_SHA = 'a'.repeat(40);
const DEV_SHA = 'b'.repeat(40);
const release = (tag_name, extra = {}) => ({ tag_name, draft: false, prerelease: false, ...extra });
const defaultReleases = () => [release('v1.79.0'), release('v1.78.0'), release('v1.77.0')];

function fixture({ releases = defaultReleases(), versions = {}, commits = {} } = {}) {
  const calls = { releases: 0, commits: [], versions: [], sequence: [] };
  const knownCommits = { dev: DEV_SHA, candidate: TARGET_SHA, abc1234: TARGET_SHA, [TARGET_SHA]: TARGET_SHA, ...commits };
  const knownVersions = { [TARGET_SHA]: '1.80.0-beta.1', [DEV_SHA]: '1.81.0-beta.1', ...versions };
  const ops = {
    async releases() {
      calls.releases++;
      return releases;
    },
    async commit(ref) {
      calls.commits.push(ref);
      calls.sequence.push(['commit', ref]);
      assert.ok(Object.hasOwn(knownCommits, ref), `Unexpected commit lookup: ${ref}`);
      return knownCommits[ref];
    },
    async version(ref) {
      calls.versions.push(ref);
      calls.sequence.push(['version', ref]);
      if (Object.hasOwn(knownVersions, ref)) return knownVersions[ref];
      assert.ok(ref.startsWith('v'), `Manifest must use a pinned tag or SHA, not ${ref}`);
      return ref.slice(1);
    },
  };
  return { ops, calls };
}

function row(plan, suite, ha = 'stable') {
  const matches = plan.matrix.include.filter((entry) => entry.suite === suite && entry.ha === ha);
  assert.equal(matches.length, 1, `Exactly one ${suite}/${ha} job is required`);
  return matches[0];
}

test('latest equal to stable plans a real upgrade from the preceding stable release', async () => {
  const { ops, calls } = fixture();
  const plan = await planRun({}, ops);
  assert.deepEqual(plan.upgrade, {
    source: { ref: 'v1.78.0', version: '1.78.0' },
    target: { ref: 'v1.79.0', version: '1.79.0' },
  });
  assert.equal(plan.matrix.include.length, 3);
  for (const suite of ['journeys', 'first-run']) {
    const entry = row(plan, suite);
    assert.equal(entry.ref, 'latest');
    assert.equal(entry.install_ref, 'v1.79.0');
    assert.equal(entry.target_ref, 'v1.79.0');
    assert.equal(entry.install_version, '1.79.0');
    assert.equal(entry.target_version, '1.79.0');
  }
  const upgrade = row(plan, 'upgrade');
  assert.equal(upgrade.ref, 'v1.78.0');
  assert.equal(upgrade.install_ref, 'v1.78.0');
  assert.equal(upgrade.install_version, '1.78.0');
  assert.equal(upgrade.target_ref, 'v1.79.0');
  assert.equal(upgrade.target_version, '1.79.0');
  assert.equal(calls.releases, 1, 'latest, stable and fallback must share one catalog');
  assert.equal(calls.versions.filter((ref) => ref === 'v1.79.0').length, 1);
  assert.deepEqual(calls.commits, [], 'release tags must remain HACS release installs');
});

test('latest prerelease keeps stable as the source and skips drafts', async () => {
  const { ops } = fixture({ releases: [
    release('v9.0.0', { draft: true }),
    release('v1.80.0-beta.2', { prerelease: true }),
    ...defaultReleases(),
  ] });
  const plan = await planRun({}, ops);
  assert.deepEqual(plan.upgrade, {
    source: { ref: 'v1.79.0', version: '1.79.0' },
    target: { ref: 'v1.80.0-beta.2', version: '1.80.0-beta.2' },
  });
});

test('stable target also uses the previous stable, excluding drafts and prereleases', async () => {
  const { ops } = fixture({ releases: [
    release('v1.80.0-beta.1', { prerelease: true }),
    release('v1.79.0'),
    release('v1.78.9', { draft: true }),
    release('v1.78.5-beta.1', { prerelease: true }),
    release('v1.78.0'),
  ] });
  const plan = await planRun({ targetRef: 'stable' }, ops);
  assert.equal(plan.upgrade.source.ref, 'v1.78.0');
  assert.equal(plan.upgrade.target.ref, 'v1.79.0');
  assert.equal(row(plan, 'journeys').ref, 'stable');
});

test('fallback skips another release carrying the same manifest version', async () => {
  const { ops } = fixture({
    releases: [release('v1.79.0'), release('v1.78.1'), release('v1.78.0')],
    versions: { 'v1.78.1': '1.79.0' },
  });
  const plan = await planRun({}, ops);
  assert.equal(plan.upgrade.source.ref, 'v1.78.0');
  assert.equal(plan.upgrade.source.version, '1.78.0');
});

test('a distinct explicit source is respected without consulting the release catalog', async () => {
  const { ops, calls } = fixture();
  const plan = await planRun({ targetRef: 'v1.79.0', upgradeFrom: 'v1.77.0', haVersion: '2026.9.4' }, ops);
  assert.equal(plan.upgrade.source.ref, 'v1.77.0');
  assert.equal(plan.matrix.include.length, 3);
  assert.ok(plan.matrix.include.every((entry) => entry.ha === '2026.9.4'));
  assert.equal(calls.releases, 0);
  assert.equal(row(plan, 'journeys', '2026.9.4').ref, 'v1.79.0');
});

test('explicit identical refs fail instead of silently selecting another source', async () => {
  const { ops, calls } = fixture();
  await assert.rejects(planRun({ targetRef: 'v1.79.0', upgradeFrom: 'v1.79.0' }, ops), /version|same|different/i);
  assert.equal(calls.releases, 0);
});

test('explicit different refs with the same manifest version also fail', async () => {
  const { ops, calls } = fixture({ versions: { [TARGET_SHA]: '1.79.0' } });
  await assert.rejects(planRun({ targetRef: 'candidate', upgradeFrom: 'v1.79.0' }, ops), /version|same|different/i);
  assert.equal(calls.releases, 0, 'an explicit source must never trigger the stable fallback');
});

test('the latest alias is not eligible for the stable-only source fallback', async () => {
  const { ops } = fixture();
  await assert.rejects(planRun({ targetRef: 'latest', upgradeFrom: 'latest' }, ops), /version|same|different/i);
});

test('branches resolve to SHA before reading the manifest, retaining the requested label', async () => {
  const { ops, calls } = fixture();
  const plan = await planRun({ targetRef: 'candidate' }, ops);
  assert.deepEqual(calls.sequence.slice(0, 2), [['commit', 'candidate'], ['version', TARGET_SHA]]);
  assert.ok(!calls.versions.includes('candidate'));
  for (const suite of ['journeys', 'first-run']) {
    assert.equal(row(plan, suite).ref, 'candidate');
    assert.equal(row(plan, suite).install_ref, TARGET_SHA);
    assert.equal(row(plan, suite).target_ref, TARGET_SHA);
  }
  assert.equal(plan.upgrade.target.version, '1.80.0-beta.1');
});

test('a shortened commit label remains intact for the product release gate', async () => {
  const { ops } = fixture();
  const plan = await planRun({ targetRef: 'abc1234' }, ops);
  assert.equal(row(plan, 'journeys').ref, 'abc1234');
  assert.equal(row(plan, 'first-run').ref, 'abc1234');
  assert.equal(row(plan, 'journeys').install_ref, TARGET_SHA);
});

test('snapshot target with the stable manifest version triggers the stable fallback', async () => {
  const { ops } = fixture({ versions: { [TARGET_SHA]: '1.79.0' } });
  const plan = await planRun({ targetRef: TARGET_SHA }, ops);
  assert.deepEqual(plan.upgrade, {
    source: { ref: 'v1.78.0', version: '1.78.0' },
    target: { ref: TARGET_SHA, version: '1.79.0' },
  });
});

test('nightly has six release jobs plus one pinned dev job', async () => {
  const { ops, calls } = fixture();
  const plan = await planRun({ event: 'schedule', haVersion: 'ignored-for-nightly' }, ops);
  assert.equal(plan.matrix.include.length, 7);
  for (const ha of ['stable', 'beta']) {
    for (const suite of ['journeys', 'first-run', 'upgrade']) {
      const entry = row(plan, suite, ha);
      assert.equal(entry.target_ref, 'v1.79.0');
      assert.equal(entry.target_version, '1.79.0');
    }
  }
  const dev = row(plan, 'journeys-dev');
  assert.equal(dev.ref, 'dev');
  assert.equal(dev.install_ref, DEV_SHA);
  assert.equal(dev.target_ref, DEV_SHA);
  assert.equal(dev.install_version, '1.81.0-beta.1');
  assert.equal(dev.target_version, '1.81.0-beta.1');
  assert.equal(dev.variant, 'house');
  assert.equal(dev.projects, '--project=admin --project=viewer --project=mobile');
  assert.deepEqual(calls.commits, ['dev']);
  assert.equal(calls.releases, 1);
});

test('push and dispatch preserve the three existing suites and project selection', async () => {
  for (const event of ['push', 'workflow_dispatch']) {
    const { ops, calls } = fixture();
    const plan = await planRun({ event }, ops);
    assert.equal(plan.matrix.include.length, 3);
    assert.equal(row(plan, 'journeys').variant, 'house');
    assert.equal(row(plan, 'journeys').projects, '--project=admin --project=viewer --project=mobile');
    assert.equal(row(plan, 'first-run').variant, 'empty');
    assert.equal(row(plan, 'first-run').projects, '--project=first-run-admin');
    assert.equal(row(plan, 'upgrade').variant, 'house');
    assert.equal(row(plan, 'upgrade').projects, '--project=upgrade');
    assert.ok(!calls.commits.includes('dev'));
  }
});

test('missing previous stable fails closed, even when prereleases or drafts exist', async () => {
  const { ops } = fixture({ releases: [
    release('v1.79.0'),
    release('v1.78.0-beta.1', { prerelease: true }),
    release('v1.77.0', { draft: true }),
  ] });
  await assert.rejects(planRun({}, ops), /previous|stable|source/i);
});

test('missing latest or stable release fails closed', async () => {
  const empty = fixture({ releases: [] });
  await assert.rejects(planRun({}, empty.ops), /release|latest/i);
  const onlyBeta = fixture({ releases: [release('v1.80.0-beta.1', { prerelease: true })] });
  await assert.rejects(planRun({}, onlyBeta.ops), /stable|release/i);
});

test('invalid commit IDs are rejected before attempting a manifest read', async () => {
  const { ops, calls } = fixture({ commits: { candidate: 'short-sha' } });
  await assert.rejects(planRun({ targetRef: 'candidate' }, ops), /commit|sha/i);
  assert.deepEqual(calls.versions, []);
});

test('missing, non-string or blank manifest versions fail closed', async () => {
  for (const version of [undefined, null, 179, '', '   ']) {
    const { ops } = fixture({ versions: { [TARGET_SHA]: version } });
    await assert.rejects(planRun({ targetRef: 'candidate' }, ops), /manifest|version/i);
  }
});

test('catalog and manifest errors propagate without trying an alternate source', async () => {
  const { ops, calls } = fixture();
  const denied = new Error('HTTP 403');
  ops.releases = async () => { throw denied; };
  await assert.rejects(planRun({}, ops), (error) => error === denied);
  assert.deepEqual(calls.versions, []);

  const failingManifest = fixture();
  const unavailable = new Error('HTTP 500 reading manifest');
  failingManifest.ops.version = async () => { throw unavailable; };
  await assert.rejects(planRun({}, failingManifest.ops), (error) => error === unavailable);
  assert.deepEqual(failingManifest.calls.commits, []);
});

function fakeFetch(handler) {
  const requests = [];
  return {
    requests,
    fetchImpl: async (url, init) => {
      const request = { url: new URL(url), headers: new Headers(init?.headers) };
      requests.push(request);
      return handler(request, requests.length);
    },
  };
}

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

test('GitHub release catalog fetches beyond 100 entries and stops at a short page', async () => {
  const firstPage = Array.from({ length: 100 }, (_, i) => release(`v1.80.0-beta.${100 - i}`, { prerelease: true }));
  const secondPage = defaultReleases();
  const fake = fakeFetch(({ url }) => {
    assert.equal(url.origin, 'https://api.github.com');
    assert.equal(url.pathname, '/repos/Matysh/houseplan-card/releases');
    assert.equal(url.searchParams.get('per_page'), '100');
    const page = Number(url.searchParams.get('page'));
    assert.ok(page === 1 || page === 2, 'no unnecessary third request');
    return jsonResponse(page === 1 ? firstPage : secondPage);
  });
  const actual = await githubOps({ fetchImpl: fake.fetchImpl }).releases();
  assert.deepEqual(actual, [...firstPage, ...secondPage]);
  assert.equal(fake.requests.length, 2);
});

test('a full release page requires fetching the next page even if it is empty', async () => {
  const page = Array.from({ length: 100 }, (_, i) => release(`v1.${i}.0`));
  const fake = fakeFetch((request, call) => jsonResponse(call === 1 ? page : []));
  assert.deepEqual(await githubOps({ fetchImpl: fake.fetchImpl }).releases(), page);
  assert.equal(fake.requests.length, 2);
});

test('GitHub API 403 aborts planning without a snapshot or unpinned fallback', async () => {
  const fake = fakeFetch(() => jsonResponse({ message: 'Forbidden' }, 403));
  await assert.rejects(planRun({}, githubOps({ token: 'fake-test-token', fetchImpl: fake.fetchImpl })), /403/);
  assert.equal(fake.requests.length, 1);
  assert.equal(fake.requests[0].headers.get('authorization'), 'Bearer fake-test-token');
  assert.equal(fake.requests[0].url.pathname, '/repos/Matysh/houseplan-card/releases');
});

test('a pagination failure is not silently replaced by the partial release catalog', async () => {
  const page = Array.from({ length: 100 }, (_, i) => release(`v1.${i}.0`));
  const fake = fakeFetch((request, call) => call === 1 ? jsonResponse(page) : jsonResponse({ message: 'Forbidden' }, 403));
  await assert.rejects(githubOps({ fetchImpl: fake.fetchImpl }).releases(), /403/);
  assert.equal(fake.requests.length, 2);
});

test('GitHub adapter rejects a malformed release catalog', async () => {
  const fake = fakeFetch(() => jsonResponse({ releases: defaultReleases() }));
  await assert.rejects(githubOps({ fetchImpl: fake.fetchImpl }).releases(), /catalog|release|array/i);
});

test('GitHub adapter encodes refs and obtains manifest JSON through the raw Contents API', async () => {
  const fake = fakeFetch(({ url, headers }, call) => {
    if (call === 1) {
      assert.equal(url.pathname, '/repos/Matysh/houseplan-card/commits/feature%2Fupgrade');
      return jsonResponse({ sha: TARGET_SHA });
    }
    assert.equal(url.pathname, '/repos/Matysh/houseplan-card/contents/custom_components/houseplan/manifest.json');
    assert.equal(url.searchParams.get('ref'), TARGET_SHA);
    assert.match(headers.get('accept'), /raw/);
    return jsonResponse({ domain: 'houseplan', version: '1.80.0-beta.1' });
  });
  const ops = githubOps({ token: 'fake-test-token', fetchImpl: fake.fetchImpl });
  const sha = await ops.commit('feature/upgrade');
  assert.equal(sha, TARGET_SHA);
  assert.equal(await ops.version(sha), '1.80.0-beta.1');
  assert.equal(fake.requests.length, 2);
  assert.ok(fake.requests.every(({ headers }) => headers.get('authorization') === 'Bearer fake-test-token'));
});

test('malformed manifest JSON from GitHub fails instead of inferring a version from the ref', async () => {
  const fake = fakeFetch(() => new Response('{not-json', { status: 200 }));
  await assert.rejects(githubOps({ fetchImpl: fake.fetchImpl }).version(TARGET_SHA), SyntaxError);
});

test('GitHub manifest without a version fails planning before a source can be chosen', async () => {
  const fake = fakeFetch(({ url }) => {
    if (url.pathname.includes('/commits/')) return jsonResponse({ sha: TARGET_SHA });
    assert.ok(url.pathname.includes('/contents/'));
    return jsonResponse({ domain: 'houseplan' });
  });
  await assert.rejects(planRun({ targetRef: 'candidate' }, githubOps({ fetchImpl: fake.fetchImpl })), /manifest|version/i);
  assert.equal(fake.requests.length, 2);
});

test('requireVersion validates planned versions and keeps callers without an expectation compatible', () => {
  assert.doesNotThrow(() => requireVersion('1.79.0', '1.79.0'));
  for (const expected of [undefined, null, '']) {
    assert.doesNotThrow(() => requireVersion('1.79.0', expected));
  }
  assert.throws(() => requireVersion('1.78.0', '1.79.0'), /version|expected|mismatch/i);
  assert.throws(() => requireVersion(undefined, '1.79.0'), /version|expected|mismatch/i);
});

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('workflow uses the real planner and pinned install/target refs without changing gate job labels', () => {
  const workflow = source('.github/workflows/e2e.yml');
  assert.match(workflow, /run:\s*node scripts\/plan-run\.mjs(?:\r?\n|$)/);
  assert.match(workflow, /node --test test\/\*\.test\.mjs/);
  assert.match(workflow, /HOUSEPLAN_REF:\s*\$\{\{\s*matrix\.target_ref\s*\}\}/);
  assert.match(workflow, /INSTALL_REF:\s*\$\{\{\s*matrix\.install_ref\s*\}\}/);
  assert.match(workflow, /INSTALL_VERSION:\s*\$\{\{\s*matrix\.install_version\s*\}\}/);
  assert.match(workflow, /HOUSEPLAN_EXPECTED_VERSION:\s*\$\{\{\s*matrix\.target_version\s*\}\}/);
  assert.match(workflow, /node scripts\/install-houseplan\.mjs --ref="\$INSTALL_REF" --expect-version="\$INSTALL_VERSION" --out=run/);
  assert.match(source('scripts/install-houseplan.mjs'), /requireVersion\(manifest\.version, arg\('expect-version'\)\)/);
  assert.match(source('tests/lib/ha-ctl.mjs'), /--expect-version=\$\{process\.env\.HOUSEPLAN_EXPECTED_VERSION\}/);
  assert.ok(workflow.includes('name: "${{ matrix.suite }} · HP ${{ matrix.ref }} · HA ${{ matrix.ha }}"'));
  const planner = source('scripts/plan-run.mjs');
  assert.match(planner, /from ['"]\.\/release-plan\.mjs['"]/);
  assert.match(planner, /\bplanRun\s*\(/);
  assert.match(planner, /GITHUB_OUTPUT/);
  assert.match(planner, /GITHUB_STEP_SUMMARY/);
});

test('upgrade browser contract retains version/fingerprint oracles, restart and ordinary reload', () => {
  const upgrade = source('tests/upgrade/upgrade.admin.spec.mjs');
  assert.match(upgrade, /const TARGET = process\.env\.HOUSEPLAN_REF \|\| 'latest'/);
  assert.match(upgrade, /expect\(after\.version\)\.not\.toBe\(before\.version\)/);
  assert.match(upgrade, /expect\(fpAfter\)\.not\.toBe\(fpBefore\)/);
  assert.match(upgrade, /expect\(await pageFingerprint\(page\)\)\.toBe\(fpBefore\)/);
  assert.match(upgrade, /restartHa\(\)/);
  assert.match(upgrade, /await page\.reload\(\)/);
  assert.match(upgrade, /expect\.poll\(\(\) => pageFingerprint\(page\), \{ timeout: 60_000 \}\)\.toBe\(fpAfter\)/);
  assert.ok(upgrade.includes('u.includes(`v=${after.version}`)'));
  assert.doesNotMatch(upgrade, /\btest\.(?:skip|fixme)\s*\(/);
  assert.ok(upgrade.indexOf('expect(fpAfter).not.toBe(fpBefore)') < upgrade.indexOf('restartHa()'));
  assert.ok(upgrade.indexOf('restartHa()') < upgrade.indexOf('await page.reload()'));
});

// houseplan-card#1010: the stable gate's frames become the "last stable" baseline
test('a dispatched stable candidate SHA names its stable tag; aliases and schedules do not', async () => {
  const tags = async () => [
    { name: 'v1.80.0-beta.1', commit: { sha: TARGET_SHA } },
    { name: 'v1.80.0', commit: { sha: TARGET_SHA } },
    { name: 'v1.79.0', commit: { sha: 'c'.repeat(40) } },
  ];
  const { ops } = fixture({ versions: { [TARGET_SHA]: '1.80.0' } });
  ops.tags = tags;
  const gate = await planRun({ event: 'workflow_dispatch', targetRef: TARGET_SHA, upgradeFrom: 'v1.79.0' }, ops);
  assert.equal(gate.stableTag, 'v1.80.0');
  const explicit = await planRun({ event: 'workflow_dispatch', targetRef: 'v1.79.0', upgradeFrom: 'v1.78.0' }, ops);
  assert.equal(explicit.stableTag, 'v1.79.0');
  const alias = await planRun({ event: 'workflow_dispatch', targetRef: 'latest' }, ops);
  assert.equal(alias.stableTag, '');
  const beta = await planRun({ event: 'workflow_dispatch', targetRef: 'v1.80.0-beta.1', upgradeFrom: 'v1.79.0' }, ops);
  assert.equal(beta.stableTag, '');
  const nightly = await planRun({ event: 'schedule', targetRef: 'latest' }, ops);
  assert.equal(nightly.stableTag, '');
  const untagged = fixture({ versions: { [TARGET_SHA]: '1.80.0' } }).ops;
  untagged.tags = async () => [];
  assert.equal((await planRun({ event: 'workflow_dispatch', targetRef: TARGET_SHA, upgradeFrom: 'v1.79.0' }, untagged)).stableTag, '');
});
