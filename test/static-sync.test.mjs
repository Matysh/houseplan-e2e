// Fixture guards only; these are not a substitute for the five real-HA journeys.
import test from 'node:test';
import assert from 'node:assert/strict';
import { StaticSyncWire, supportsStaticSync } from '../tests/lib/static-sync.mjs';

function transport(wire) {
  const client = [], server = [];
  let request, response;
  wire.attach({
    connectToServer: () => ({ send: raw => server.push(raw), onMessage: handler => { response = handler; } }),
    onMessage: handler => { request = handler; },
    send: raw => client.push(raw),
  });
  return { client, server, request: value => request(JSON.stringify(value)), response: value => response(JSON.stringify(value)) };
}

test('static sync is gated at beta.4, with unknown foreign installs treated as current', () => {
  assert.equal(supportsStaticSync('1.83.0-beta.3'), false);
  assert.equal(supportsStaticSync('1.82.0'), false);
  for (const version of ['1.83.0-beta.4', 'v1.83.0-beta.5', '1.83.0-rc.1', '1.83.0', undefined])
    assert.equal(supportsStaticSync(version), true);
});

test('auth and other HA traffic pass unchanged and do not enter evidence receipts', () => {
  const wire = new StaticSyncWire(), connection = transport(wire);
  const auth = { type: 'auth', access_token: 'private-fixture-token' };
  connection.request(auth);
  connection.request({ type: 'config/entity_registry/list', id: 2 });
  connection.response({ type: 'auth_ok', ha_version: '2026.10.4' });
  connection.response({ type: 'result', id: 2, success: true, result: [{ entity_id: 'private-fixture-entity' }] });
  assert.deepEqual(JSON.parse(connection.server[0]), auth);
  assert.equal(connection.client.length, 2);
  assert.deepEqual(wire.receipt(), { connections: 1, commands: [], results: [], events: [], heldReads: [], heldEvents: [] });
});

test('only actual matching GET replies are held; receipts omit complete config payloads', () => {
  const wire = new StaticSyncWire(), connection = transport(wire);
  wire.holdReads();
  connection.request({ type: 'houseplan/config/get', id: 4 });
  connection.response({ type: 'result', id: 99, success: true, result: { unrelated: true } });
  assert.equal(connection.client.length, 1);
  assert.equal(wire.readHold.pending.length, 0);
  const reply = { type: 'result', id: 4, success: true, result: {
    rev: 11, config: { secret: 'private-fixture-config' }, decor_assets_api: 1, summary_panel_api: 1,
  } };
  connection.response(reply);
  assert.equal(connection.client.length, 1);
  assert.deepEqual(wire.counts(), { config: 1, layout: 0 });
  assert.deepEqual(wire.results, [{ connection: 1, type: 'houseplan/config/get', success: true,
    rev: 11, decorAssetsApi: 1, summaryPanelApi: 1 }]);
  assert.equal(JSON.stringify(wire.receipt()).includes('private-fixture'), false);
  wire.releaseReads();
  assert.deepEqual(JSON.parse(connection.client[1]), reply);
});

test('a B-only old-event hold forwards the same real bus event to A and discards only B copy', () => {
  const wire = new StaticSyncWire(), a = transport(wire), b = transport(wire);
  wire.holdEvents(['houseplan_layout_updated'], 2);
  const event = { type: 'event', id: 5, event: { event_type: 'houseplan_layout_updated', data: { rev: 105 } } };
  a.response(event); b.response(event);
  assert.deepEqual(JSON.parse(a.client[0]), event);
  assert.equal(b.client.length, 0);
  assert.equal(wire.eventHold.pending.length, 1);
  assert.deepEqual(wire.events.map(e => [e.connection, e.rev]), [[1, 105], [2, 105]]);
  wire.releaseEvents({ discard: true });
  assert.equal(b.client.length, 0);
  const next = structuredClone(event); next.event.data.rev = 6;
  b.response(next);
  assert.deepEqual(JSON.parse(b.client[0]), next);
});
