/** #1112: observe and delay REAL Home Assistant traffic, never invent replies.
 * Only House Plan command names, ACK success and revision/capability numbers
 * leave this fixture. Auth, arbitrary HA payloads and tokens are not recorded.
 */
import { expect } from '@playwright/test';
import { installedRecord } from './contract.mjs';
import { compareTags } from '../../scripts/tags.mjs';
import { wsCall } from './ha-ws.mjs';

export const supportsStaticSync = (version = installedRecord()?.version) =>
  !version || compareTags(`v${version.replace(/^v/, '')}`, 'v1.83.0-beta.4') >= 0;

const decode = raw => { try { return JSON.parse(String(raw)); } catch { return null; } };
const READS = new Set(['houseplan/config/get', 'houseplan/layout/get']);
export class StaticSyncWire {
  constructor() {
    this.connections = 0;
    this.commands = [];
    this.results = [];
    this.events = [];
    this.eventHold = null;
    this.readHold = null;
  }
  attach(socket) {
    const connection = ++this.connections, server = socket.connectToServer(), requests = new Map();
    socket.onMessage(raw => {
      const message = decode(raw);
      if (message?.type?.startsWith('houseplan/')) {
        requests.set(message.id, message.type);
        this.commands.push({ connection, type: message.type });
      }
      server.send(raw);
    });
    server.onMessage(raw => {
      const decoded = decode(raw);
      if (!decoded) { socket.send(raw); return; }
      const batch = Array.isArray(decoded), messages = batch ? decoded : [decoded], forward = [];
      for (const message of messages) {
        const type = requests.get(message.id);
        const event = message.type === 'event' ? message.event : null;
        if (message.type === 'result' && type) {
          requests.delete(message.id);
          const result = message.result;
          this.results.push({ connection, type, success: message.success,
            ...(Number.isSafeInteger(result?.rev) ? { rev: result.rev } : {}),
            ...(type === 'houseplan/config/get' ? {
              decorAssetsApi: result?.decor_assets_api, summaryPanelApi: result?.summary_panel_api,
            } : {}),
          });
        }
        if (event?.event_type?.startsWith('houseplan_')) {
          this.events.push({ connection, type: event.event_type, delivery: this.eventHold && this.matches(this.eventHold, connection, event.event_type) ? 'held' : 'forward',
            ...(Number.isSafeInteger(event.data?.rev) ? { rev: event.data.rev } : {}) });
        }
        const send = () => socket.send(JSON.stringify(batch ? [message] : message));
        if (message.type === 'result' && READS.has(type) && this.readHold
          && this.matches(this.readHold, connection, type)) {
          this.readHold.pending.push({ send, connection, type });
        } else if (event && this.eventHold && this.matches(this.eventHold, connection, event.event_type)) {
          this.eventHold.pending.push({ send, connection, type: event.event_type });
        } else forward.push(message);
      }
      if (forward.length === messages.length) socket.send(raw);
      else if (forward.length) socket.send(JSON.stringify(batch ? forward : forward[0]));
    });
  }
  matches(hold, connection, type) {
    return (!hold.connection || hold.connection === connection) && hold.types.has(type);
  }
  holdEvents(types = ['houseplan_layout_updated'], connection) {
    if (this.eventHold) throw new Error('event hold is already armed');
    this.eventHold = { types: new Set(types), connection, pending: [] };
  }
  holdReads(types = [...READS], connection) {
    if (this.readHold) throw new Error('read hold is already armed');
    this.readHold = { types: new Set(types), connection, pending: [] };
  }
  async heldReads(count = 1) {
    await expect.poll(() => this.readHold?.pending.length ?? 0,
      { message: 'real HA replies reached the downstream hold' }).toBeGreaterThanOrEqual(count);
  }
  async heldEvents(count = 1) {
    await expect.poll(() => this.eventHold?.pending.length ?? 0,
      { message: 'real HA bus notifications reached the hold' }).toBeGreaterThanOrEqual(count);
  }
  releaseReads() { const hold = this.readHold; this.readHold = null; for (const p of hold?.pending ?? []) p.send(); }
  releaseEvents({ discard = false } = {}) {
    const hold = this.eventHold; this.eventHold = null;
    if (!discard) for (const p of hold?.pending ?? []) p.send();
  }
  reset() { this.commands = []; this.results = []; this.events = []; }
  counts(connection) {
    const commands = this.commands.filter(c => !connection || c.connection === connection);
    return { config: commands.filter(c => c.type === 'houseplan/config/get').length,
      layout: commands.filter(c => c.type === 'houseplan/layout/get').length };
  }
  /** Longer than the product's event debounce; observe a settled transport. */
  async settle(page) {
    let previous = -1;
    for (let i = 0; i < 20; i++) {
      const current = this.commands.length + this.results.length + this.events.length;
      await page.waitForTimeout(450);
      if (current === previous && current === this.commands.length + this.results.length + this.events.length) return;
      previous = current;
    }
    throw new Error('House Plan websocket did not settle');
  }
  receipt() { return { connections: this.connections, commands: this.commands, results: this.results, events: this.events,
    heldReads: (this.readHold?.pending ?? []).map(({ connection, type }) => ({ connection, type })),
    heldEvents: (this.eventHold?.pending ?? []).map(({ connection, type }) => ({ connection, type })),
  }; }
}
export async function staticSyncWire(page) {
  const wire = new StaticSyncWire();
  await page.routeWebSocket('**/api/websocket', socket => wire.attach(socket));
  return wire;
}

/** Create/delete only our temporary dashboard through HA's native WS API. */
export async function createStaticDashboard() {
  const path = `e2e-static-sync-${Date.now().toString(36)}`;
  const dashboard = await wsCall({ type: 'lovelace/dashboards/create', url_path: path,
    title: 'E2E static sync', icon: 'mdi:floor-plan', show_in_sidebar: false, require_admin: true });
  const staticCards = () => ({ type: 'horizontal-stack', cards: [0, 1].map(() => ({
    type: 'custom:houseplan-space-card', space: 'f1', show_button: false,
  })) });
  try {
    await wsCall({ type: 'lovelace/config/save', url_path: path, config: { views: [
      { title: 'Full and static', path: 'mixed', type: 'panel', cards: [{ type: 'vertical-stack',
        cards: [{ type: 'custom:houseplan-card' }, staticCards()] }] },
      { title: 'Static pair', path: 'pair', type: 'panel', cards: [staticCards()] },
    ] } });
  } catch (error) {
    await wsCall({ type: 'lovelace/dashboards/delete', dashboard_id: dashboard.id });
    throw error;
  }
  return { path,
    remove: () => wsCall({ type: 'lovelace/dashboards/delete', dashboard_id: dashboard.id }),
  };
}

/** Negative input goes through the actual HA bus, never a fabricated WS result. */
export const firePlanEvent = (type, data) => wsCall({ type: 'fire_event', event_type: type, event_data: data });

/** Stable public hosts owned by this fixture rather than Lovelace. Establish A
 * here and wait for real reads before replacing the SAME instances with B.
 * This prevents Lovelace's retained references from assigning A back later.
 */
export async function ownStaticHosts(page) {
  return page.locator('houseplan-space-card').evaluateAll(all => {
    const source = all[0].hass, frames = all.map(host => host.getBoundingClientRect());
    all.forEach(host => host.remove());
    const wrapper = document.createElement('div');
    wrapper.id = 'e2e-static-sync-host-handoff';
    document.body.append(wrapper);
    for (const frame of frames) {
      const host = document.createElement('houseplan-space-card');
      host.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', show_button: false });
      host.hass = source;
      Object.assign(host.style, { position: 'fixed', left: `${frame.x}px`, top: `${frame.y}px`,
        width: `${frame.width}px`, zIndex: '1000' });
      wrapper.append(host);
    }
    return { cards: frames.length, connectionUnchanged: true };
  });
}

/** A real second authenticated browser websocket. The token stays inside the
 * existing HA page: neither a Playwright argument nor a recorded fixture field.
 * Public .hass handoff models the host replacing its connection; it does NOT
 * claim to exercise HA frontend's automatic reconnect implementation. The owned
 * replacement hosts prevent Lovelace from assigning its old authority back.
 */
export async function handoffStaticConnection(hosts) {
  return hosts.evaluateAll(async all => {
    if (all.length !== 2 || all.some(host => host.parentElement?.id !== 'e2e-static-sync-host-handoff'))
      throw new Error('connection handoff requires exactly the fixture-owned static pair');
    const original = all[0].hass, auth = original.auth || original.connection?.options?.auth;
    if (!auth?.accessToken) throw new Error('HA page did not expose its authenticated connection authority');
    const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/websocket`);
    const pending = new Map(), callbacks = new Map();
    let id = 1, readyResolve, readyReject;
    const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
    socket.addEventListener('message', event => {
      const decoded = JSON.parse(event.data);
      for (const message of Array.isArray(decoded) ? decoded : [decoded]) {
        if (message.type === 'auth_required') socket.send(JSON.stringify({ type: 'auth', access_token: auth.accessToken }));
        else if (message.type === 'auth_ok') readyResolve();
        else if (message.type === 'auth_invalid') readyReject(new Error('second HA connection authentication failed'));
        else if (message.type === 'result') {
          const call = pending.get(message.id);
          if (call) { pending.delete(message.id); message.success ? call.resolve(message.result) : call.reject(new Error(`HA RPC ${call.type} failed`)); }
        } else if (message.type === 'event') callbacks.get(message.id)?.(message.event);
      }
    });
    socket.addEventListener('error', () => readyReject(new Error('second HA websocket failed')));
    await ready;
    const call = (message, callback) => {
      const current = id++;
      if (callback) callbacks.set(current, callback);
      return new Promise((resolve, reject) => {
        pending.set(current, { resolve, reject, type: message.type });
        socket.send(JSON.stringify({ ...message, id: current }));
      }).then(result => ({ result, id: current }));
    };
    const connection = { connected: true,
      subscribeEvents: async (callback, eventType) => {
        const subscription = await call({ type: 'subscribe_events', event_type: eventType }, callback);
        return () => { callbacks.delete(subscription.id); void call({ type: 'unsubscribe_events', subscription: subscription.id }); };
      },
    };
    window.__staticSyncHostHandoff = { socket, connection, original };
    for (const host of all) host.hass = { ...original, connection, callWS: async message => (await call(message)).result };
    return { cards: all.length, authenticated: true };
  });
}
