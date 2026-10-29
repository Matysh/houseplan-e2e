/** Diagnostic ONLY: import this function and pass it directly to page.addInitScript.
 * No custom-element creation, global factory wrapping, DOM writes or product state.
 * Every hard navigation gets its own bounded10s identity observation window.
 * Console payload excludes query/hash, storage, auth, hass and DOM content.
 */
export function installHaRegistryWitness() {
  const ids = new WeakMap();
  let serial = 0, last = '', emitted = 0, frame = 0, errors = 0;
  const started = performance.now();
  const initialRegistry = globalThis.customElements;
  const watched = new Set();
  const id = value => {
    if (!value || !['object', 'function'].includes(typeof value)) return null;
    if (!ids.has(value)) ids.set(value, ++serial);
    return ids.get(value);
  };
  const safe = fn => { try { return fn(); } catch (e) { return { errorName: e?.name || 'Error' }; } };
  const ctorChain = ctor => {
    const result = [];
    let proto = ctor?.prototype;
    for (let n = 0; proto && n < 8; n++, proto = Object.getPrototypeOf(proto)) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'constructor');
      const value = descriptor?.value;
      result.push({ prototype: id(proto), constructor: id(value), name: typeof value === 'function' ? value.name : null });
    }
    return result;
  };
  const registryState = registry => registry ? {
    object: id(registry), prototype: id(Object.getPrototypeOf(registry)),
    define: id(registry.define), get: id(registry.get), upgrade: id(registry.upgrade),
    whenDefined: id(registry.whenDefined),
    hpDialog: safe(() => id(registry.get('hp-dialog'))),
    hpDialogChain: safe(() => ctorChain(registry.get('hp-dialog'))),
    houseplanCard: safe(() => id(registry.get('houseplan-card'))),
    homeAssistant: safe(() => id(registry.get('home-assistant'))),
    haIcon: safe(() => id(registry.get('ha-icon'))),
  } : null;
  const sample = (reason, observation = null) => {
    const registry = globalThis.customElements;
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'HTMLElement');
    const state = {
      HTMLElement: id(globalThis.HTMLElement), HTMLElementPrototype: id(globalThis.HTMLElement?.prototype),
      HTMLElementDescriptor: descriptor ? { value: id(descriptor.value), get: id(descriptor.get), set: id(descriptor.set) } : null,
      currentRegistry: registryState(registry), initialRegistry: registryState(initialRegistry),
      readyState: document.readyState,
    };
    const encoded = JSON.stringify(state);
    if ((encoded !== last || reason !== 'frame') && emitted < 48) {
      last = encoded; emitted++;
      console.info('[HP_HA_REGISTRY_WITNESS] ' + JSON.stringify({
        reason, elapsedMs: performance.now() - started, timeOrigin: performance.timeOrigin,
        path: location.pathname, frame, observation, ...state,
      }));
    }
    if (registry && watched.size < 8) {
      const key = String(id(registry)) + ':' + String(id(registry.whenDefined));
      if (!watched.has(key)) {
        watched.add(key);
        safe(() => registry.whenDefined('hp-dialog').then(ctor => sample('hp-dialog-whenDefined:' + key, {definitionConstructor:id(ctor),definitionChain:ctorChain(ctor)}), error => sample('hp-dialog-whenDefined-rejected:' + key, {errorName:error?.name || 'Error'})));
      }
    }
  };
  const tick = () => {
    frame++; sample('frame');
    if (performance.now() - started < 10000 && frame < 800) requestAnimationFrame(tick);
    else sample('bounded-observation-end');
  };
  addEventListener('error', event => {
    if (errors < 4 && String(event.message || '').includes('Illegal constructor')) {
      errors++; sample('observed-Illegal-constructor');
    }
  }, { passive: true });
  sample('init');
  requestAnimationFrame(tick);
}

