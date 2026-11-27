import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { installHistoryBridge } from '../../src/core/history.js';
import { createLifecycleCoordinator } from '../../src/core/lifecycle.js';
import { createDocumentOwnership, createSessionScope } from '../../src/core/ownership.js';

function createFakeEventTarget() {
  const map = new Map();
  return {
    addEventListener(type, fn, opts) {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add({ fn, capture: Boolean(typeof opts === 'object' ? opts?.capture : opts) });
    },
    removeEventListener(type, fn, opts) {
      const cap = Boolean(typeof opts === 'object' ? opts?.capture : opts);
      const set = map.get(type);
      if (!set) return;
      for (const item of set) {
        if (item.fn === fn && item.capture === cap) set.delete(item);
      }
    },
    dispatchEvent(evt) {
      const set = map.get(evt.type);
      if (!set) return;
      for (const item of [...set]) item.fn(evt);
    },
    listenerCount(type) {
      return map.get(type)?.size ?? 0;
    },
  };
}

function createFakeWindow(initialHref = 'https://www.bilibili.com/') {
  const et = createFakeEventTarget();
  let currentHref = initialHref;
  const pushCalls = [];
  const replaceCalls = [];
  const win = {
    location: {
      get href() {
        return currentHref;
      },
      set href(v) {
        currentHref = v;
      },
    },
    history: {
      pushState(_state, _title, url) {
        pushCalls.push(url);
        currentHref = new URL(url, currentHref).href;
      },
      replaceState(_state, _title, url) {
        replaceCalls.push(url);
        currentHref = new URL(url, currentHref).href;
      },
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    addEventListener: et.addEventListener.bind(et),
    removeEventListener: et.removeEventListener.bind(et),
    dispatchEvent: et.dispatchEvent.bind(et),
    listenerCount: et.listenerCount.bind(et),
    _pushCalls: pushCalls,
    _replaceCalls: replaceCalls,
  };
  return win;
}

function createFakeElement(tagName, { id = '', attrs = {}, classes = [] } = {}) {
  const attrMap = new Map(Object.entries(attrs));
  if (id) attrMap.set('id', id);
  const classSet = new Set(classes);
  const styleProps = new Map();
  let connected = true;
  let focusCalls = 0;
  let blurCalls = 0;

  return {
    tagName: tagName.toUpperCase(),
    inert: false,
    dataset: {},
    get isConnected() {
      return connected;
    },
    set _connected(v) {
      connected = v;
    },
    get id() {
      return attrMap.get('id') || '';
    },
    set id(v) {
      if (v) attrMap.set('id', String(v));
      else attrMap.delete('id');
    },
    get rel() {
      return attrMap.get('rel') || '';
    },
    set rel(v) {
      attrMap.set('rel', String(v));
    },
    get type() {
      return attrMap.get('type') || '';
    },
    set type(v) {
      attrMap.set('type', String(v));
    },
    hasAttribute(n) {
      return attrMap.has(n);
    },
    getAttribute(n) {
      return attrMap.has(n) ? attrMap.get(n) : null;
    },
    setAttribute(n, v) {
      attrMap.set(n, String(v));
    },
    removeAttribute(n) {
      attrMap.delete(n);
    },
    classList: {
      add(...cs) {
        cs.forEach((c) => classSet.add(c));
      },
      remove(...cs) {
        cs.forEach((c) => classSet.delete(c));
      },
      toggle(c, force) {
        if (force === undefined) {
          if (classSet.has(c)) classSet.delete(c);
          else classSet.add(c);
        } else if (force) {
          classSet.add(c);
        } else {
          classSet.delete(c);
        }
      },
      contains(c) {
        return classSet.has(c);
      },
      values() {
        return [...classSet];
      },
    },
    style: {
      setProperty(k, v, p = '') {
        styleProps.set(k, { value: String(v), priority: p });
      },
      getPropertyValue(k) {
        return styleProps.get(k)?.value || '';
      },
      getPropertyPriority(k) {
        return styleProps.get(k)?.priority || '';
      },
      removeProperty(k) {
        styleProps.delete(k);
      },
    },
    remove() {
      connected = false;
      this._onRemove?.();
    },
    focus() {
      focusCalls += 1;
      this._onFocus?.();
    },
    blur() {
      blurCalls += 1;
      this._onBlur?.();
    },
    contains(other) {
      return other === this;
    },
    closest() {
      return null;
    },
    get _focusCalls() {
      return focusCalls;
    },
    get _blurCalls() {
      return blurCalls;
    },
  };
}

function createFakeDoc() {
  const html = createFakeElement('html', { classes: ['host-preexisting'] });
  html.style.setProperty('--host-var', '12px');
  const body = createFakeElement('body');
  const origIcon = createFakeElement('link', {
    id: 'orig',
    attrs: { rel: 'icon', href: 'data:,native' },
  });
  const icons = [origIcon];
  const byId = new Map([['orig', origIcon]]);
  origIcon._onRemove = () => {
    const idx = icons.indexOf(origIcon);
    if (idx !== -1) icons.splice(idx, 1);
    byId.delete('orig');
  };

  let activeEl = null;
  const nativeInput = createFakeElement('input', { id: 'native-input' });
  nativeInput._onFocus = () => {
    activeEl = nativeInput;
  };
  nativeInput._onBlur = () => {
    if (activeEl === nativeInput) activeEl = body;
  };
  activeEl = nativeInput;

  const head = {
    querySelectorAll(sel) {
      if (sel.includes("rel='icon'")) return [...icons];
      return [];
    },
    appendChild(el) {
      el._connected = true;
      icons.push(el);
      if (el.id) byId.set(el.id, el);
      el._onRemove = () => {
        const idx = icons.indexOf(el);
        if (idx !== -1) icons.splice(idx, 1);
        if (el.id && byId.get(el.id) === el) byId.delete(el.id);
      };
      return el;
    },
  };

  const doc = {
    title: 'Fixture Native',
    documentElement: html,
    body,
    head,
    get activeElement() {
      return activeEl;
    },
    set activeElement(v) {
      activeEl = v;
    },
    getElementById(id) {
      return byId.get(id) || null;
    },
    createElement(tag) {
      return createFakeElement(tag);
    },
    _origIcon: origIcon,
    _icons: icons,
    _nativeInput: nativeInput,
  };
  return doc;
}

describe('P1-02 Cooperative History Bridge', () => {
  it('coexists with pre-existing and post-installed wrappers without clobbering on uninstall', () => {
    const win = createFakeWindow('https://www.bilibili.com/');
    const preCalls = [];
    const postCalls = [];
    const bridgeCalls = [];

    const basePush = win.history.pushState;
    win.history.pushState = function preWrapper(s, t, u) {
      preCalls.push(u);
      return basePush.call(this, s, t, u);
    };

    const bridge = installHistoryBridge(win, (info) => bridgeCalls.push(info));
    assert.equal(bridge.isOwnedPushState(), true);

    const afterBridgePush = win.history.pushState;
    win.history.pushState = function postWrapper(s, t, u) {
      postCalls.push(u);
      return afterBridgePush.call(this, s, t, u);
    };
    assert.equal(bridge.isOwnedPushState(), false);

    win.history.pushState({}, '', '/c/tech/');
    assert.deepEqual(preCalls, ['/c/tech/']);
    assert.deepEqual(postCalls, ['/c/tech/']);
    assert.equal(bridgeCalls.length, 1);
    assert.equal(bridgeCalls[0].source, 'pushState');

    // Uninstall must NOT overwrite postWrapper, yet bridge stops notifying
    bridge.uninstall();
    assert.equal(win.history.pushState.name, 'postWrapper');
    win.history.pushState({}, '', '/unsupported');
    assert.deepEqual(preCalls, ['/c/tech/', '/unsupported']);
    assert.deepEqual(postCalls, ['/c/tech/', '/unsupported']);
    assert.equal(bridgeCalls.length, 1);
  });

  it('deduplicates same-tick popstate+hashchange for the same URL and handles uninstall when top owner', () => {
    const win = createFakeWindow('https://www.bilibili.com/#a');
    const calls = [];
    const bridge = installHistoryBridge(win, (info) => calls.push(info.source));

    win.dispatchEvent({ type: 'popstate' });
    win.dispatchEvent({ type: 'hashchange' });
    assert.deepEqual(calls, ['popstate']);

    bridge.uninstall();
    assert.equal(win.listenerCount('popstate'), 0);
    assert.equal(win.listenerCount('hashchange'), 0);
    win.history.pushState({}, '', '/other');
    assert.deepEqual(calls, ['popstate']);
  });
});

describe('P1-02 DocumentOwnership & SessionScope', () => {
  it('restores owned title, favicon, root attrs/styles, inert, and focus while preserving newer host writes', () => {
    const doc = createFakeDoc();
    const ownership = createDocumentOwnership(doc);

    ownership.captureFocus('.im-shell');
    ownership.setTitle('推荐流 - 钉钉');
    ownership.applyFavicon('data:image/svg+xml,dingtalk');
    ownership.addRootClass('im-theme');
    ownership.addRootClass('im-dark');
    ownership.setRootAttr('data-xim-skin', 'dingtalk');
    ownership.setRootColorScheme('dark');
    ownership.setRootStyleProp('--im-nav', '56px');
    ownership.setInert(doc._nativeInput, true);

    assert.equal(doc.title, '推荐流 - 钉钉');
    assert.equal(doc._origIcon.getAttribute('href'), 'data:image/svg+xml,dingtalk');
    assert.equal(doc._origIcon.id, 'orig');
    assert.equal(doc.getElementById('bilishu-favicon')?.getAttribute('href'), 'data:image/svg+xml,dingtalk');

    // Simulate focus moving into shell and then shell disappearing
    const fakeShell = createFakeElement('section', { classes: ['im-shell'] });
    doc.activeElement = fakeShell;

    ownership.restoreAll([fakeShell]);

    assert.equal(doc.title, 'Fixture Native');
    assert.equal(doc._origIcon.id, 'orig');
    assert.equal(doc._origIcon.getAttribute('href'), 'data:,native');
    assert.equal(doc.getElementById('bilishu-favicon'), null);
    assert.equal(doc.documentElement.classList.contains('im-theme'), false);
    assert.equal(doc.documentElement.classList.contains('im-dark'), false);
    assert.equal(doc.documentElement.classList.contains('host-preexisting'), true);
    assert.equal(doc.documentElement.hasAttribute('data-xim-skin'), false);
    assert.equal(doc.documentElement.style.getPropertyValue('color-scheme'), '');
    assert.equal(doc.documentElement.style.getPropertyValue('--im-nav'), '');
    assert.equal(doc.documentElement.style.getPropertyValue('--host-var'), '12px');
    assert.equal(doc._nativeInput.inert, false);
    assert.equal(doc.activeElement, doc._nativeInput);
  });

  it('preserves host updates made while mounted instead of clobbering with stale original values', () => {
    const doc = createFakeDoc();
    const ownership = createDocumentOwnership(doc);

    ownership.setTitle('科技数码交流群 - 钉钉');
    ownership.applyFavicon('data:image/svg+xml,dingtalk');
    ownership.setRootColorScheme('dark');

    // Host dynamically updates title, favicon, and color-scheme while shell is active
    doc.title = 'B站动态更新标题';
    doc._origIcon.setAttribute('href', 'data:,host-updated-icon');
    doc.documentElement.style.setProperty('color-scheme', 'light');

    ownership.restoreAll();

    assert.equal(doc.title, 'B站动态更新标题');
    assert.equal(doc._origIcon.getAttribute('href'), 'data:,host-updated-icon');
    assert.equal(doc.documentElement.style.getPropertyValue('color-scheme'), 'light');
  });

  it('disposes all SessionScope listeners, observers, timers, nodes, and AbortSignal idempotently', async () => {
    const win = createFakeWindow();
    const scope = createSessionScope(win);
    const target = createFakeEventTarget();
    let disconnected = 0;
    let timerFired = 0;
    let customDispose = 0;
    const node = createFakeElement('div');

    scope.addListener(target, 'click', () => {});
    scope.addObserver({ disconnect: () => { disconnected += 1; } });
    scope.setTimeout(() => { timerFired += 1; }, 20);
    scope.setInterval(() => { timerFired += 1; }, 20);
    scope.trackNode(node);
    scope.onDispose(() => { customDispose += 1; });

    assert.equal(scope.signal.aborted, false);
    assert.equal(target.listenerCount('click'), 1);

    scope.dispose();
    scope.dispose(); // idempotent second call

    await new Promise((r) => setTimeout(r, 40));

    assert.equal(scope.isDisposed, true);
    assert.equal(scope.signal.aborted, true);
    assert.equal(target.listenerCount('click'), 0);
    assert.equal(disconnected, 1);
    assert.equal(timerFired, 0);
    assert.equal(node.isConnected, false);
    assert.equal(customDispose, 1);
    assert.deepEqual(scope.stats(), {
      listeners: 0,
      observers: 0,
      timeouts: 0,
      intervals: 0,
      rafs: 0,
      nodes: 0,
      disposed: true,
    });
  });
});

describe('P1-02 LifecycleCoordinator', () => {
  it('supports cold-start unsupported -> SPA supported, generation invalidation, BFCache, and singleton replacement', () => {
    const win = createFakeWindow('https://www.bilibili.com/unsupported');
    const doc = createFakeDoc();
    let viewMode = 'im';
    const events = [];

    const routeKindFn = () => {
      const p = new URL(win.location.href).pathname;
      if (p === '/' || p.startsWith('/c/')) return 'explore';
      return 'other';
    };

    const coord = createLifecycleCoordinator({
      win,
      doc,
      getRouteKind: routeKindFn,
      getRouteKey: () => new URL(win.location.href).pathname,
      getViewMode: () => viewMode,
      setViewMode: (m) => { viewMode = m; },
      onMountSession: ({ generation, routeKey }) => events.push(['mount', generation, routeKey]),
      onRouteSync: ({ generation, routeKey, routeChanged }) => events.push(['sync', generation, routeKey, routeChanged]),
      onUnmountSession: ({ reason }) => events.push(['unmount', reason]),
      onEnsureNativeFab: () => events.push(['fab-on']),
      onRemoveNativeFab: () => events.push(['fab-off']),
    });

    coord.syncNow('init');
    assert.equal(coord.getState().active, false);
    assert.equal(coord.getState().routerOwner, 'dingbili-document-router');

    // Cold-start unsupported -> SPA pushState('/') mounts 1 shell cleanly
    win.history.pushState({}, '', '/');
    coord.syncNow('flush');
    const mountGen = coord.getGeneration();
    assert.equal(coord.getState().active, true);
    assert.equal(coord.isGenerationActive(mountGen), true);

    // Route change increments generation and invalidates old generation
    win.history.pushState({}, '', '/c/tech/');
    coord.syncNow('flush');
    assert.equal(coord.isGenerationActive(mountGen), false);
    const secondGen = coord.getGeneration();
    assert.equal(coord.isGenerationActive(secondGen), true);

    // BFCache pagehide suspends & unmounts; pageshow remounts 1 session
    win.dispatchEvent({ type: 'pagehide', persisted: true });
    assert.equal(coord.getState().active, false);
    assert.equal(coord.isGenerationActive(secondGen), false);
    win.dispatchEvent({ type: 'pageshow', persisted: true });
    assert.equal(coord.getState().active, true);

    // Rapid idempotent native toggle
    coord.enterNativeMode('test');
    coord.enterNativeMode('test-2');
    assert.equal(coord.getState().active, false);
    assert.equal(coord.getState().mode, 'native');

    // Double coordinator creation cleans up prior instance
    const coord2 = createLifecycleCoordinator({
      win,
      doc,
      getRouteKind: routeKindFn,
      getRouteKey: () => new URL(win.location.href).pathname,
      getViewMode: () => viewMode,
      setViewMode: (m) => { viewMode = m; },
    });
    assert.equal(coord.getState().destroyed, true);
    coord2.destroy();
  });
});
