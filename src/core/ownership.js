/**
 * Session-scoped resource disposer for listeners, observers, timers, nodes, and abort signals.
 */
export function createSessionScope(win = typeof window !== 'undefined' ? window : globalThis) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const listeners = [];
  const observers = new Set();
  const timeouts = new Set();
  const intervals = new Set();
  const rafs = new Set();
  const nodes = new Set();
  const disposers = [];
  let disposed = false;

  const setTimeoutFn = typeof win.setTimeout === 'function' ? win.setTimeout.bind(win) : setTimeout;
  const clearTimeoutFn = typeof win.clearTimeout === 'function' ? win.clearTimeout.bind(win) : clearTimeout;
  const setIntervalFn = typeof win.setInterval === 'function' ? win.setInterval.bind(win) : setInterval;
  const clearIntervalFn = typeof win.clearInterval === 'function' ? win.clearInterval.bind(win) : clearInterval;
  const rafFn =
    typeof win.requestAnimationFrame === 'function'
      ? win.requestAnimationFrame.bind(win)
      : (cb) => setTimeoutFn(cb, 16);
  const cancelRafFn =
    typeof win.cancelAnimationFrame === 'function'
      ? win.cancelAnimationFrame.bind(win)
      : (id) => clearTimeoutFn(id);

  function addListener(target, type, fn, options) {
    if (disposed || !target || typeof target.addEventListener !== 'function') return () => {};
    target.addEventListener(type, fn, options);
    const entry = { target, type, fn, options };
    listeners.push(entry);
    return () => {
      const idx = listeners.indexOf(entry);
      if (idx !== -1) {
        listeners.splice(idx, 1);
        target.removeEventListener(type, fn, options);
      }
    };
  }

  function addObserver(observer) {
    if (disposed) {
      observer?.disconnect?.();
      return observer;
    }
    if (observer) observers.add(observer);
    return observer;
  }

  function scheduleTimeout(fn, ms) {
    if (disposed) return 0;
    const id = setTimeoutFn(() => {
      timeouts.delete(id);
      if (!disposed) fn();
    }, ms);
    timeouts.add(id);
    return id;
  }

  function cancelTimeout(id) {
    if (!id) return;
    timeouts.delete(id);
    clearTimeoutFn(id);
  }

  function scheduleInterval(fn, ms) {
    if (disposed) return 0;
    const id = setIntervalFn(() => {
      if (!disposed) fn();
    }, ms);
    intervals.add(id);
    return id;
  }

  function cancelInterval(id) {
    if (!id) return;
    intervals.delete(id);
    clearIntervalFn(id);
  }

  function scheduleRaf(fn) {
    if (disposed) return 0;
    const id = rafFn((ts) => {
      rafs.delete(id);
      if (!disposed) fn(ts);
    });
    rafs.add(id);
    return id;
  }

  function cancelRaf(id) {
    if (!id) return;
    rafs.delete(id);
    cancelRafFn(id);
  }

  function trackNode(node) {
    if (disposed) {
      node?.remove?.();
      return node;
    }
    if (node) nodes.add(node);
    return node;
  }

  function onDispose(fn) {
    if (typeof fn !== 'function') return;
    if (disposed) {
      try {
        fn();
      } catch {
        // ignore
      }
      return;
    }
    disposers.push(fn);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    try {
      controller?.abort();
    } catch {
      // ignore
    }
    for (let i = disposers.length - 1; i >= 0; i -= 1) {
      try {
        disposers[i]();
      } catch {
        // continue tearing down remaining resources
      }
    }
    disposers.length = 0;

    for (const obs of observers) {
      try {
        obs.disconnect();
      } catch {
        // ignore
      }
    }
    observers.clear();

    for (const entry of listeners) {
      try {
        entry.target.removeEventListener(entry.type, entry.fn, entry.options);
      } catch {
        // ignore
      }
    }
    listeners.length = 0;

    for (const id of timeouts) clearTimeoutFn(id);
    timeouts.clear();

    for (const id of intervals) clearIntervalFn(id);
    intervals.clear();

    for (const id of rafs) cancelRafFn(id);
    rafs.clear();

    for (const node of nodes) {
      try {
        if (node?.isConnected) node.remove();
      } catch {
        // ignore
      }
    }
    nodes.clear();
  }

  function stats() {
    return {
      listeners: listeners.length,
      observers: observers.size,
      timeouts: timeouts.size,
      intervals: intervals.size,
      rafs: rafs.size,
      nodes: nodes.size,
      disposed,
    };
  }

  return {
    get signal() {
      return controller ? controller.signal : undefined;
    },
    get isDisposed() {
      return disposed;
    },
    addListener,
    addObserver,
    setTimeout: scheduleTimeout,
    clearTimeout: cancelTimeout,
    setInterval: scheduleInterval,
    clearInterval: cancelInterval,
    requestAnimationFrame: scheduleRaf,
    cancelAnimationFrame: cancelRaf,
    trackNode,
    onDispose,
    dispose,
    stats,
  };
}

/**
 * Ownership-tracked DOM & metadata mutator.
 * Restores only mutations still owned by this script and preserves newer host updates.
 */
export function createDocumentOwnership(doc = document) {
  let titleState = { owned: false, origTitle: '', lastWrittenTitle: null };
  let applyingTitle = false;

  const ownedIcons = new Map();
  let injectedIcon = null;
  let injectedIconId = 'bilishu-favicon';
  let applyingFavicon = false;

  const ownedClasses = new Map();
  const ownedAttrs = new Map();
  const ownedStyles = new Map();
  const ownedInert = new Map();
  let focusState = { captured: false, origFocus: null };

  function setTitle(nextTitle) {
    const target = String(nextTitle ?? '');
    if (!titleState.owned) {
      titleState = { owned: true, origTitle: doc.title, lastWrittenTitle: target };
    } else if (doc.title !== titleState.lastWrittenTitle) {
      // Host updated document.title externally while mounted: preserve newest host value
      titleState.origTitle = doc.title;
      titleState.lastWrittenTitle = target;
    } else {
      titleState.lastWrittenTitle = target;
    }
    if (doc.title !== target) {
      applyingTitle = true;
      try {
        doc.title = target;
      } finally {
        applyingTitle = false;
      }
    }
  }

  function notifyHostTitleMutation() {
    if (applyingTitle || !titleState.owned) return;
    if (doc.title !== titleState.lastWrittenTitle) {
      titleState.origTitle = doc.title;
    }
  }

  function restoreTitle() {
    if (!titleState.owned) return;
    if (doc.title === titleState.lastWrittenTitle) {
      applyingTitle = true;
      try {
        doc.title = titleState.origTitle;
      } finally {
        applyingTitle = false;
      }
    }
    titleState = { owned: false, origTitle: '', lastWrittenTitle: null };
  }

  function applyFavicon(href, { injectedId = 'bilishu-favicon' } = {}) {
    const head = doc.head;
    if (!head || applyingFavicon) return;
    injectedIconId = injectedId;
    applyingFavicon = true;
    try {
      const iconLinks = [...head.querySelectorAll("link[rel='icon'], link[rel~='icon']")];
      for (const link of iconLinks) {
        if (link === injectedIcon || link.dataset?.dingbiliFavicon === '1') continue;
        const curId = link.getAttribute('id');
        const curHref = link.getAttribute('href');
        let rec = ownedIcons.get(link);
        if (!rec) {
          rec = {
            hadId: link.hasAttribute('id'),
            origId: curId,
            removedId: false,
            hadHref: link.hasAttribute('href'),
            origHref: curHref,
            writtenHref: null,
          };
          ownedIcons.set(link, rec);
        } else {
          // If host changed href or id externally since our last write, preserve host's newer values
          if (curHref !== rec.writtenHref && curHref !== href) {
            rec.hadHref = link.hasAttribute('href');
            rec.origHref = curHref;
          }
          if (curId && curId !== injectedId && curId !== rec.origId) {
            rec.hadId = true;
            rec.origId = curId;
            rec.removedId = false;
          }
        }
        // Only strip id if it literally collides with our injectedId; keep host id (e.g. #orig) intact
        if (curId === injectedId) {
          link.removeAttribute('id');
          rec.removedId = true;
        }
        if (curHref !== href) {
          link.setAttribute('href', href);
        }
        rec.writtenHref = href;
      }

      let link = injectedIcon && injectedIcon.isConnected ? injectedIcon : doc.getElementById(injectedId);
      if (link && link.dataset?.dingbiliFavicon !== '1') {
        link = null;
      }
      if (!link) {
        link = doc.createElement('link');
        link.id = injectedId;
        link.rel = 'icon';
        link.type = 'image/svg+xml';
        if (link.dataset) link.dataset.dingbiliFavicon = '1';
        link.setAttribute('href', href);
        head.appendChild(link);
      } else if (link.getAttribute('href') !== href) {
        link.setAttribute('href', href);
      }
      injectedIcon = link;
    } finally {
      applyingFavicon = false;
    }
  }

  function restoreFavicons() {
    applyingFavicon = true;
    try {
      if (injectedIcon?.isConnected) injectedIcon.remove();
      const stray = doc.getElementById?.(injectedIconId);
      if (stray && stray.dataset?.dingbiliFavicon === '1') {
        stray.remove();
      }
      injectedIcon = null;

      for (const [link, rec] of ownedIcons.entries()) {
        if (!link.isConnected) continue;
        if (link.getAttribute('href') === rec.writtenHref) {
          if (rec.hadHref && rec.origHref !== null) {
            link.setAttribute('href', rec.origHref);
          } else {
            link.removeAttribute('href');
          }
        }
        if (rec.removedId && !link.hasAttribute('id') && rec.hadId && rec.origId !== null) {
          link.setAttribute('id', rec.origId);
        }
      }
      ownedIcons.clear();
    } finally {
      applyingFavicon = false;
    }
  }

  function addRootClass(cls) {
    const html = doc.documentElement;
    if (!html) return;
    if (!ownedClasses.has(cls)) {
      ownedClasses.set(cls, html.classList.contains(cls));
    }
    html.classList.add(cls);
  }

  function toggleRootClass(cls, force) {
    const html = doc.documentElement;
    if (!html) return;
    if (!ownedClasses.has(cls)) {
      ownedClasses.set(cls, html.classList.contains(cls));
    }
    html.classList.toggle(cls, Boolean(force));
  }

  function setRootAttr(name, value) {
    const html = doc.documentElement;
    if (!html) return;
    const next = String(value);
    const cur = html.getAttribute(name);
    let rec = ownedAttrs.get(name);
    if (!rec) {
      rec = { hadAttr: html.hasAttribute(name), origValue: cur, writtenValue: next };
      ownedAttrs.set(name, rec);
    } else if (cur !== rec.writtenValue) {
      rec.hadAttr = html.hasAttribute(name);
      rec.origValue = cur;
      rec.writtenValue = next;
    } else {
      rec.writtenValue = next;
    }
    if (cur !== next) html.setAttribute(name, next);
  }

  function setRootStyleProp(prop, value) {
    const html = doc.documentElement;
    if (!html) return;
    const next = String(value).trim();
    const cur = html.style.getPropertyValue(prop).trim();
    const curPrio = html.style.getPropertyPriority(prop);
    let rec = ownedStyles.get(prop);
    if (!rec) {
      rec = { origValue: cur, origPriority: curPrio, writtenValue: next };
      ownedStyles.set(prop, rec);
    } else if (cur !== rec.writtenValue) {
      rec.origValue = cur;
      rec.origPriority = curPrio;
      rec.writtenValue = next;
    } else {
      rec.writtenValue = next;
    }
    if (cur !== next) html.style.setProperty(prop, next);
  }

  function setRootColorScheme(value) {
    setRootStyleProp('color-scheme', value);
  }

  function restoreRoot() {
    const html = doc.documentElement;
    if (!html) return;
    for (const [cls, origHad] of ownedClasses.entries()) {
      if (origHad) html.classList.add(cls);
      else html.classList.remove(cls);
    }
    ownedClasses.clear();

    for (const [name, rec] of ownedAttrs.entries()) {
      if (html.getAttribute(name) === rec.writtenValue) {
        if (rec.hadAttr && rec.origValue !== null) {
          html.setAttribute(name, rec.origValue);
        } else {
          html.removeAttribute(name);
        }
      }
    }
    ownedAttrs.clear();

    for (const [prop, rec] of ownedStyles.entries()) {
      if (html.style.getPropertyValue(prop).trim() === rec.writtenValue) {
        if (rec.origValue) {
          html.style.setProperty(prop, rec.origValue, rec.origPriority || '');
        } else {
          html.style.removeProperty(prop);
        }
      }
    }
    ownedStyles.clear();
  }

  function setInert(el, value) {
    if (!el) return;
    if (!ownedInert.has(el)) {
      ownedInert.set(el, Boolean(el.inert));
    }
    el.inert = Boolean(value);
  }

  function restoreInert() {
    for (const [el, origVal] of ownedInert.entries()) {
      if (el.isConnected) el.inert = origVal;
    }
    ownedInert.clear();
  }

  function captureFocus(shellSelector) {
    if (focusState.captured) return;
    const active = doc.activeElement;
    const inShell = Boolean(shellSelector && active && typeof active.closest === 'function' && active.closest(shellSelector));
    const isNativeControl = Boolean(active && active !== doc.body && active !== doc.documentElement && !inShell);
    focusState = {
      captured: true,
      origFocus: isNativeControl ? active : null,
    };
  }

  function restoreFocus(removedContainers = []) {
    const active = doc.activeElement;
    const activeInRemoved = Boolean(
      active && removedContainers.some((c) => c && (c === active || c.contains?.(active))),
    );
    const activeLost = !active || active === doc.body || active === doc.documentElement || activeInRemoved;
    if (activeLost && focusState.origFocus && focusState.origFocus.isConnected && typeof focusState.origFocus.focus === 'function') {
      try {
        focusState.origFocus.focus({ preventScroll: true });
      } catch {
        try {
          focusState.origFocus.focus();
        } catch {
          // ignore
        }
      }
    } else if (activeInRemoved && typeof active?.blur === 'function') {
      try {
        active.blur();
      } catch {
        // ignore
      }
    }
    focusState = { captured: false, origFocus: null };
  }

  return {
    setTitle,
    notifyHostTitleMutation,
    restoreTitle,
    applyFavicon,
    restoreFavicons,
    get isApplyingFavicon() {
      return applyingFavicon;
    },
    addRootClass,
    toggleRootClass,
    setRootAttr,
    setRootStyleProp,
    setRootColorScheme,
    restoreRoot,
    setInert,
    restoreInert,
    captureFocus,
    restoreFocus,
    restoreAll(removedContainers = []) {
      restoreInert();
      restoreFavicons();
      restoreTitle();
      restoreRoot();
      restoreFocus(removedContainers);
    },
  };
}
