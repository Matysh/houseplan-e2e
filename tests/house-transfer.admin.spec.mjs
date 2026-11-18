// houseplan-card#1464 / houseplan-e2e#76. New optional transfer, not a changed
// full-backup expectation. The only browser input is a downloaded real ZIP.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { requireHooks } from './lib/contract.mjs';
import { archive, complexPlan, seedExport } from './lib/backup-fixtures.mjs';
import { chooseBackup, footerCancel, kindField, openArchive, openMaintenance, restoreArchive } from './lib/backup.mjs';
import { accessToken } from './lib/ha-api.mjs';
import { evidence, expectPlanDrawn } from './lib/ha-page.mjs';
import { planConfig, planLayout } from './lib/ha-ws.mjs';
import { HP, hp } from './lib/hooks.mjs';
import { action } from './lib/plan.mjs';
import { restoreSeedAfterEach } from './lib/seed-guard.mjs';
import { HA_URL } from '../scripts/users.mjs';

requireHooks(test, 'action', 'field', 'settings-section', 'toast@data-id');
restoreSeedAfterEach(test);

const houseReply = page => page.waitForResponse(response =>
  response.url().includes('/api/houseplan/transfer/import/preview') && response.request().method() === 'POST');

test('a plan-only house ZIP preserves images and inter-floor stairs, cancels, then appends without replacing the home', async ({ page }, testInfo) => {
  const capability = await planConfig();
  test.skip(capability.house_transfer_api !== 1, 'Installed backend does not advertise optional house_transfer_api=1; no first-stable version is assumed');
  await restoreArchive(archive(complexPlan(await seedExport())));
  const before = await planConfig(), beforeLayout = await planLayout();
  let { host, settings } = await openMaintenance(page);
  await action(settings, 'backup-export-open').click();
  let dialog = host.locator(HP.dialog('backup')).first();
  await kindField(dialog, 'house').check();
  const description = kindField(dialog, 'house').locator('..').locator('small');
  await expect(description).toBeVisible();
  expect(await description.evaluate(element => ({
    wraps: getComputedStyle(element).whiteSpace === 'normal',
    fits: element.scrollWidth <= element.clientWidth + 1,
  }))).toEqual({ wraps: true, fits: true });
  await expect(dialog).toContainText('Whole house — plan only');
  await expect(dialog).toContainText('EXIF');
  await evidence(testInfo, page, 'house-export-dialog');
  const downloading = page.waitForEvent('download');
  await dialog.locator(HP.dialogConfirm).first().click();
  const downloaded = await downloading;
  const bytes = readFileSync(await downloaded.path());
  await testInfo.attach(downloaded.suggestedFilename(), { body: bytes, contentType: 'application/zip' });
  const opened = openArchive(bytes);
  expect(opened.entries.mimetype.toString()).toBe('application/vnd.houseplan.plan+zip;version=1');
  expect(opened.manifest).toMatchObject({ format: 'houseplan-plan-transfer', archive_version: 1, complete: true });
  expect(opened.document).toMatchObject({ kind: 'house', export_version: 4, transfer: { plan_only: true }, required_api: { house_transfer_api: 1 } });
  expect(opened.entries['zigbee.json']).toBeUndefined();
  expect(opened.document.payload.config.markers).toEqual([]);
  expect(opened.document.payload.config.settings).toEqual({});
  expect(opened.document.payload.config.spaces).toHaveLength(before.config.spaces.length);
  expect(opened.document.payload.config.spaces.flatMap(space => space.stairs || []).filter(stair => stair.target_space_id).length).toBeGreaterThanOrEqual(2);
  for (const space of opened.document.payload.config.spaces) {
    for (const room of space.rooms || []) expect(room.area ?? null).toBeNull();
    for (const opening of space.openings || []) {
      expect(opening.contact ?? null).toBeNull(); expect(opening.lock ?? null).toBeNull();
    }
  }
  expect(Object.keys(opened.manifest.blobs).length).toBeGreaterThanOrEqual(2);
  for (const [entry, metadata] of Object.entries(opened.manifest.blobs)) {
    expect(createHash('sha256').update(opened.entries[entry]).digest('hex')).toBe(metadata.sha256);
    expect(opened.entries[entry].length).toBe(metadata.bytes);
  }

  ({ host, settings } = await openMaintenance(page));
  let replied = houseReply(page);
  dialog = await chooseBackup(page, host, settings, { name: 'house-plan.zip', mimeType: 'application/zip', buffer: bytes });
  let response = await replied, reply = await response.json();
  expect(response.status(), JSON.stringify(reply)).toBe(200);
  expect(reply.preview.kind).toBe('house');
  expect(reply.preview.counts.walls).toBeGreaterThan(0);
  expect(reply.preview.spaces).toHaveLength(before.config.spaces.length);
  for (const floor of reply.preview.spaces) await expect(dialog).toContainText(floor.title);
  await expect(dialog.locator(HP.dialogConfirm).first()).toHaveText(/Add house/);
  expect((await planConfig()).config).toEqual(before.config);
  expect((await planLayout()).layout).toEqual(beforeLayout.layout);
  await evidence(testInfo, page, 'house-import-preview');
  await footerCancel(dialog).click();
  await expect(dialog).toBeHidden();

  // No ten-minute wait and no hidden full-backup upload on the second attempt.
  const uploads = [];
  const observe = request => { if (request.method() === 'POST' && request.url().includes('/import/preview')) uploads.push(request.url()); };
  page.on('request', observe);
  ({ host, settings } = await openMaintenance(page));
  replied = houseReply(page);
  dialog = await chooseBackup(page, host, settings, { name: 'house-plan.zip', mimeType: 'application/zip', buffer: bytes });
  response = await replied; reply = await response.json();
  page.off('request', observe);
  expect(response.status(), JSON.stringify(reply)).toBe(200);
  expect(uploads).toHaveLength(1); expect(uploads[0]).toContain('/transfer/import/preview');
  const names = reply.preview.spaces;
  await dialog.locator(HP.dialogConfirm).first().click();
  await expect(host.locator(hp('toast', { id: 'backup.house_done' }))).toBeVisible();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expectPlanDrawn(page);
  const after = await planConfig(), afterLayout = await planLayout();
  expect(after.config.spaces.slice(0, before.config.spaces.length)).toEqual(before.config.spaces);
  expect(after.config.markers).toEqual(before.config.markers);
  expect(after.config.settings).toEqual(before.config.settings);
  for (const [key, position] of Object.entries(beforeLayout.layout)) expect(afterLayout.layout[key]).toEqual(position);
  const added = after.config.spaces.slice(before.config.spaces.length);
  expect(added.map(space => space.id)).toEqual(names.map(row => row.space_id));
  const mapped = new Map(names.map(row => [row.source_id, row.space_id]));
  for (const source of opened.document.payload.config.spaces) {
    const target = added.find(space => space.id === mapped.get(source.id));
    expect(target.title).toBe(names.find(row => row.source_id === source.id).title);
    expect((target.stairs || []).map(stair => stair.target_space_id)).toEqual((source.stairs || []).map(stair => mapped.get(stair.target_space_id) ?? null));
    if (target.plan_url) {
      const response = await fetch(`${HA_URL}${target.plan_url}`, { headers: { Authorization: `Bearer ${await accessToken('admin')}` } });
      expect(response.status).toBe(200);
      const actual = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
      const sourceImage = opened.manifest.images.find(row => row.ref.kind === 'plan' && row.ref.owner_id === source.id);
      expect(actual).toBe(opened.manifest.blobs[sourceImage.blob].sha256);
    }
  }
  await evidence(testInfo, page, 'house-after-reload');
});
