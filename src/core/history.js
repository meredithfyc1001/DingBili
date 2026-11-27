/**
 * Cooperative document-level History bridge with independent ownership.
 * Never overwrites host or third-party wrappers installed after this bridge.
 */
export function installHistoryBridge(win, onRouteChange, { ownerId = 'dingbili-document-router' } = {}) {
  const historyObj = win.history;
  const prevPush = historyObj.pushState;
  const prevReplace = historyObj.replaceState;

  let active = true;
  let installed = true;
  let dispatching = false;
  let lastTickHref = '';
  let inSameTick = false;

  const notify = (source) => {
    if (!active || dispatching) return;
    const currentHref = String(win.location?.href ?? '');
    if (inSameTick && currentHref === lastTickHref) {
      return;
    }
    lastTickHref = currentHref;
    inSameTick = true;
    queueMicrotask(() => {
      inSameTick = false;
    });
    dispatching = true;
    try {
      onRouteChange({ source, href: currentHref });
    } finally {
      dispatching = false;
    }
  };

  const wrappedPush = function pushState(...args) {
    const out = prevPush.apply(this, args);
    if (active) notify('pushState');
    return out;
  };

  const wrappedReplace = function replaceState(...args) {
    const out = prevReplace.apply(this, args);
    if (active) notify('replaceState');
    return out;
  };

  const onPopState = () => notify('popstate');
  const onHashChange = () => notify('hashchange');

  historyObj.pushState = wrappedPush;
  historyObj.replaceState = wrappedReplace;
  win.addEventListener('popstate', onPopState);
  win.addEventListener('hashchange', onHashChange);

  return {
    ownerId,
    isOwnedPushState: () => active && historyObj.pushState === wrappedPush,
    isOwnedReplaceState: () => active && historyObj.replaceState === wrappedReplace,
    uninstall() {
      if (!installed && !active) return;
      active = false;
      installed = false;
      win.removeEventListener('popstate', onPopState);
      win.removeEventListener('hashchange', onHashChange);
      // Only restore if no other script wrapped history after us
      if (historyObj.pushState === wrappedPush) {
        historyObj.pushState = prevPush;
      }
      if (historyObj.replaceState === wrappedReplace) {
        historyObj.replaceState = prevReplace;
      }
    },
  };
}
