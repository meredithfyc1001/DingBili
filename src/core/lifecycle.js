import { installHistoryBridge } from './history.js';
import { createSessionScope } from './ownership.js';

const COORDINATOR_KEY = Symbol.for('dingbili.lifecycle.coordinator');

/**
 * Document-level lifecycle coordinator separating lightweight routing from active IM shell sessions.
 */
export function createLifecycleCoordinator({
  win = typeof window !== 'undefined' ? window : globalThis,
  doc = typeof document !== 'undefined' ? document : null,
  getRouteKind,
  getRouteKey,
  getViewMode,
  setViewMode,
  onMountSession,
  onUnmountSession,
  onRouteSync,
  onEnsureNativeFab,
  onRemoveNativeFab,
} = {}) {
  if (win[COORDINATOR_KEY] && typeof win[COORDINATOR_KEY].destroy === 'function') {
    win[COORDINATOR_KEY].destroy();
  }

  let destroyed = false;
  let generation = 0;
  let active = false;
  let suspended = false;
  let activeRouteKey = '';
  let activeSession = null;
  let syncScheduled = false;
  let scheduledHandle = 0;
  let syncing = false;
  let resyncRequested = false;

  const scheduleFrame = (cb) =>
    typeof win.requestAnimationFrame === 'function' ? win.requestAnimationFrame(cb) : win.setTimeout(cb, 0);
  const cancelFrame = (id) => {
    if (!id) return;
    if (typeof win.cancelAnimationFrame === 'function') win.cancelAnimationFrame(id);
    else win.clearTimeout(id);
  };

  function isGenerationActive(gen) {
    return !destroyed && active && gen === generation;
  }

  function unmountSession(reason, details = {}) {
    if (!active && !activeSession) return;
    generation += 1;
    const prevSession = activeSession;
    activeSession = null;
    active = false;
    activeRouteKey = '';
    try {
      onUnmountSession?.({ reason, generation, sessionScope: prevSession, ...details });
    } finally {
      prevSession?.dispose();
    }
  }

  function syncNow(reason = 'sync') {
    if (destroyed) return;
    if (syncScheduled) {
      cancelFrame(scheduledHandle);
      syncScheduled = false;
      scheduledHandle = 0;
    }
    if (syncing) {
      resyncRequested = true;
      return;
    }
    syncing = true;
    try {
      let currentReason = reason;
      do {
        resyncRequested = false;
        if (destroyed || suspended) break;

        const kind = getRouteKind();
        const key = getRouteKey();
        const mode = getViewMode();

        if (kind === 'other') {
          unmountSession(`route-other:${currentReason}`);
          onRemoveNativeFab?.();
          continue;
        }

        if (mode !== 'im') {
          unmountSession(`mode-native:${currentReason}`);
          if (doc?.body) onEnsureNativeFab?.();
          continue;
        }

        onRemoveNativeFab?.();

        if (!active) {
          generation += 1;
          const gen = generation;
          active = true;
          activeRouteKey = key;
          activeSession = createSessionScope(win);
          onMountSession?.({
            generation: gen,
            sessionScope: activeSession,
            routeKind: kind,
            routeKey: key,
            reason: currentReason,
          });
        } else if (activeRouteKey !== key) {
          generation += 1;
          const gen = generation;
          activeRouteKey = key;
          onRouteSync?.({
            generation: gen,
            sessionScope: activeSession,
            routeKind: kind,
            routeKey: key,
            reason: currentReason,
            routeChanged: true,
          });
        } else {
          onRouteSync?.({
            generation,
            sessionScope: activeSession,
            routeKind: kind,
            routeKey: key,
            reason: currentReason,
            routeChanged: false,
          });
        }
        currentReason = 'resync';
      } while (resyncRequested && !destroyed);
    } finally {
      syncing = false;
    }
  }

  function scheduleSync(reason = 'scheduled') {
    if (destroyed || syncScheduled) return;
    syncScheduled = true;
    scheduledHandle = scheduleFrame(() => {
      syncScheduled = false;
      scheduledHandle = 0;
      syncNow(reason);
    });
  }

  function enterNativeMode(reason = 'enter-native') {
    if (destroyed) return;
    setViewMode?.('native');
    syncNow(reason);
  }

  function enterImMode(reason = 'enter-im') {
    if (destroyed) return;
    setViewMode?.('im');
    syncNow(reason);
  }

  const historyBridge = installHistoryBridge(win, () => scheduleSync('history'), {
    ownerId: 'dingbili-document-router',
  });

  const onPageHide = (e) => {
    if (destroyed) return;
    suspended = true;
    unmountSession('pagehide', { persisted: Boolean(e?.persisted) });
    onRemoveNativeFab?.();
  };

  const onPageShow = (e) => {
    if (destroyed) return;
    suspended = false;
    syncNow(e?.persisted ? 'pageshow-bfcache' : 'pageshow');
  };

  win.addEventListener('pagehide', onPageHide);
  win.addEventListener('pageshow', onPageShow);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (syncScheduled) {
      cancelFrame(scheduledHandle);
      syncScheduled = false;
      scheduledHandle = 0;
    }
    unmountSession('destroy');
    onRemoveNativeFab?.();
    win.removeEventListener('pagehide', onPageHide);
    win.removeEventListener('pageshow', onPageShow);
    historyBridge.uninstall();
    if (win[COORDINATOR_KEY] === api) {
      delete win[COORDINATOR_KEY];
    }
  }

  function getState() {
    return {
      destroyed,
      generation,
      active,
      suspended,
      mode: getViewMode(),
      routeKind: getRouteKind(),
      routeKey: getRouteKey(),
      activeRouteKey,
      routerOwner: historyBridge.ownerId,
      historyOwned: {
        pushState: historyBridge.isOwnedPushState(),
        replaceState: historyBridge.isOwnedReplaceState(),
      },
      activeSessionStats: activeSession
        ? activeSession.stats()
        : { listeners: 0, observers: 0, timeouts: 0, intervals: 0, rafs: 0, nodes: 0, disposed: true },
    };
  }

  const api = {
    getGeneration: () => generation,
    isGenerationActive,
    getActiveSession: () => activeSession,
    syncNow,
    scheduleSync,
    enterNativeMode,
    enterImMode,
    destroy,
    getState,
  };

  win[COORDINATOR_KEY] = api;
  return api;
}
