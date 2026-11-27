import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const fixturesDir = path.join(rootDir, 'tests', 'fixtures');
const distScriptPath = path.join(rootDir, 'dist', 'DingBili.user.js');

const FIXTURES = {
  home: fs.readFileSync(path.join(fixturesDir, 'home-feed.html'), 'utf8'),
  search: fs.readFileSync(path.join(fixturesDir, 'search-results.html'), 'utf8'),
  video: fs.readFileSync(path.join(fixturesDir, 'video-detail.html'), 'utf8'),
  unsupported: fs.readFileSync(path.join(fixturesDir, 'unsupported-page.html'), 'utf8'),
};

const DIST_SOURCE = fs.readFileSync(distScriptPath, 'utf8');

async function setupContext(browser, { preInitScript = null, htmlResolver = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.route('**/*', async (route) => {
    const req = route.request();
    if (req.resourceType() === 'document') {
      const u = new URL(req.url());
      let body = htmlResolver ? htmlResolver(u) : null;
      if (body == null) {
        if (u.hostname === 'search.bilibili.com') body = FIXTURES.search;
        else if (u.pathname.startsWith('/video/')) body = FIXTURES.video;
        else if (u.pathname === '/unsupported') body = FIXTURES.unsupported;
        else body = FIXTURES.home;
      }
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
      return;
    }
    await route.abort('blockedbyclient');
  });

  if (preInitScript) {
    await context.addInitScript({ content: preInitScript });
  }
  await context.addInitScript({ content: DIST_SOURCE });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  return { context, page, pageErrors };
}

function readNativeSnapshot(page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const origIcon = document.getElementById('orig');
    return {
      title: document.title,
      origIconId: origIcon?.id ?? null,
      origIconHref: origIcon?.getAttribute('href') ?? null,
      hasInjectedFavicon: Boolean(document.getElementById('bilishu-favicon')),
      hasThemeStyle: Boolean(document.getElementById('bilishu-im-theme')),
      hasRootClass: html.classList.contains('im-theme'),
      hasDarkClass: html.classList.contains('im-dark'),
      hasLockClass: html.classList.contains('im-skin-lock'),
      dataXimSkin: html.getAttribute('data-xim-skin'),
      dataXimDark: html.getAttribute('data-xim-dark'),
      dataXimMask: html.getAttribute('data-xim-mask'),
      colorScheme: html.style.getPropertyValue('color-scheme'),
      imNav: html.style.getPropertyValue('--im-nav'),
      imList: html.style.getPropertyValue('--im-list'),
      imHeaderH: html.style.getPropertyValue('--im-header-h'),
      imStrip: html.style.getPropertyValue('--im-strip'),
      imNav2w: html.style.getPropertyValue('--im-nav2w'),
      shellCount: document.querySelectorAll('.im-chat-panel').length,
      anyImNodeCount: document.querySelectorAll(
        '.im-titlebar,.im-rail,.im-strip,.im-list-panel,.im-chat-panel,.im-search-view,.im-create-menu,.xim-skin-menu,.im-detail',
      ).length,
      bodyOverflow: body ? getComputedStyle(body).overflowY : '',
      inertCount: [...document.querySelectorAll('[inert]')].filter((el) => el.inert).length,
      lifecycle: window.__dingbiliLifecycle ? window.__dingbiliLifecycle() : null,
    };
  });
}

test.describe('P1-02 Routing, Lifecycle Ownership, and Native Restoration (A02)', () => {
  test('A02.1: route switching, late-arriving host container, and generation guard against stale async callbacks', async ({ browser }) => {
    const lateHomeHtml = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Late Host</title><link rel="icon" id="orig" href="data:,late"></head><body><main id="app"></main></body></html>`;
    const { context, page, pageErrors } = await setupContext(browser, {
      htmlResolver: (u) => (u.pathname === '/late-home' ? lateHomeHtml : null),
    });
    try {
      await page.addInitScript(() => {
        localStorage.setItem('bilishu-im-skin', 'dingtalk');
      });

      // Route '/' -> '/c/tech/' -> '/video/BV1ab1234567/' -> '/unsupported' -> '/'
      await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.im-chat-panel')).toHaveCount(1);
      expect(await page.evaluate(() => window.__dingbiliLifecycle().routeKind)).toBe('explore');

      await page.evaluate(() => history.pushState({}, '', '/c/tech/'));
      await expect.poll(() => page.title()).toBe('科技数码交流群 - 钉钉');
      expect(await page.evaluate(() => window.__dingbiliLifecycle().routeKind)).toBe('channel');

      await page.evaluate(() => history.pushState({}, '', '/video/BV1ab1234567/'));
      await expect.poll(() => page.evaluate(() => window.__dingbiliLifecycle().routeKind)).toBe('note');

      // Switch to unsupported while video/comments might still be syncing, then switch back
      await page.evaluate(() => history.pushState({}, '', '/unsupported'));
      await expect(page.locator('.im-chat-panel')).toHaveCount(0);
      expect(await page.evaluate(() => window.__dingbiliLifecycle().active)).toBe(false);

      // Late-arriving host cards on / (simulate delayed hydration)
      await page.goto('https://www.bilibili.com/v/popular/all', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.im-chat-panel')).toHaveCount(1);
      await page.evaluate(() => {
        setTimeout(() => {
          window.__fixture.addCard({ id: 'BV9zz9999999', title: '延迟到达宿主卡片' });
        }, 120);
      });
      await expect(page.locator('.im-msg')).toContainText(['首页样本视频一', '延迟到达宿主卡片']);

      // Generation counter increments across route switches and blocks stale session writes
      const genBefore = await page.evaluate(() => window.__dingbiliLifecycle().generation);
      await page.evaluate(() => history.pushState({}, '', '/c/music/'));
      await expect.poll(() => page.title()).toBe('音乐交流群 - 钉钉');
      const genAfter = await page.evaluate(() => window.__dingbiliLifecycle().generation);
      expect(genAfter).toBeGreaterThan(genBefore);

      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('A02.2 x F1: same-document SPA restore (light/dark), host live updates, cooperative History, and detached parent recovery', async ({ browser }) => {
    const preWrapperScript = `
      window.__historyLog = { pre: [], post: [] };
      const __origPush = history.pushState;
      history.pushState = function(s, t, u) {
        window.__historyLog.pre.push(String(u));
        return __origPush.call(this, s, t, u);
      };
    `;
    const { context, page, pageErrors } = await setupContext(browser, {
      preInitScript: preWrapperScript,
    });
    try {
      await page.goto('https://www.bilibili.com/unsupported', { waitUntil: 'domcontentloaded' });
      for (const colorMode of ['light', 'dark']) {
        await page.evaluate((m) => {
          localStorage.setItem('bilishu-im-skin', 'dingtalk');
          localStorage.setItem('bilishu-im-color-theme', m);
          localStorage.setItem('bilishu-im-view', 'im');
        }, colorMode);

        await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' });
        await expect(page.locator('.im-chat-panel')).toHaveCount(1);

        // Install a third-party post-wrapper AFTER DingBili
        await page.evaluate(() => {
          if (!window.__postInstalled) {
            window.__postInstalled = true;
            const prev = history.pushState;
            history.pushState = function(s, t, u) {
              window.__historyLog.post.push(String(u));
              return prev.call(this, s, t, u);
            };
          }
        });

        await page.evaluate(() => history.pushState({}, '', '/c/tech/'));
        await expect.poll(() => page.title()).toBe('科技数码交流群 - 钉钉');

        // Exit to unsupported via replaceState -> inspect ALL common assertions
        await page.evaluate(() => history.replaceState({}, '', '/unsupported'));
        await expect(page.locator('.im-chat-panel')).toHaveCount(0);
        await page.waitForTimeout(100);

        const snap = await readNativeSnapshot(page);
        expect(snap.title).toBe('Fixture Native');
        expect(snap.origIconId).toBe('orig');
        expect(snap.origIconHref).toBe('data:,native');
        expect(snap.hasInjectedFavicon).toBe(false);
        expect(snap.hasThemeStyle).toBe(false);
        expect(snap.hasRootClass).toBe(false);
        expect(snap.hasDarkClass).toBe(false);
        expect(snap.hasLockClass).toBe(false);
        expect(snap.dataXimSkin).toBeNull();
        expect(snap.dataXimDark).toBeNull();
        expect(snap.dataXimMask).toBeNull();
        expect(snap.colorScheme).toBe('');
        expect(snap.imNav).toBe('');
        expect(snap.imList).toBe('');
        expect(snap.imHeaderH).toBe('');
        expect(snap.anyImNodeCount).toBe(0);
        expect(snap.inertCount).toBe(0);
        expect(snap.lifecycle.active).toBe(false);
        expect(snap.lifecycle.routerOwner).toBe('dingbili-document-router');
        expect(snap.lifecycle.activeSessionStats).toEqual({
          listeners: 0,
          observers: 0,
          timeouts: 0,
          intervals: 0,
          rafs: 0,
          nodes: 0,
          disposed: true,
        });

        // Native button works and fires exactly once
        const beforeClicks = await page.evaluate(() => window.__fixture.nativeButtonClicks);
        await page.click('#native-header-action');
        expect(await page.evaluate(() => window.__fixture.nativeButtonClicks)).toBe(beforeClicks + 1);

        // Native input is focusable and editable
        await page.fill('#native-search-input', `输入测试-${colorMode}`);
        expect(await page.inputValue('#native-search-input')).toBe(`输入测试-${colorMode}`);

        // Re-enter supported route -> both pre and post History wrappers still active
        await page.evaluate(() => history.pushState({}, '', '/'));
        await expect(page.locator('.im-chat-panel')).toHaveCount(1);

        const historyCounts = await page.evaluate(() => window.__historyLog);
        expect(historyCounts.pre).toContain('/c/tech/');
        expect(historyCounts.post).toContain('/c/tech/');
        expect(historyCounts.pre).toContain('/');
        expect(historyCounts.post).toContain('/');
      }

      // Host dynamically updates title, favicon href, and colorScheme while IM is mounted -> preserved on exit
      await page.evaluate(() => {
        localStorage.setItem('bilishu-im-color-theme', 'dark');
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('.im-chat-panel')).toHaveCount(1);
      await page.evaluate(() => {
        document.title = 'B站实时新标题';
        document.getElementById('orig').setAttribute('href', 'data:,bili-live-icon');
        document.documentElement.style.colorScheme = 'light';
      });
      await page.waitForTimeout(100);
      await page.evaluate(() => history.replaceState({}, '', '/unsupported'));
      await expect(page.locator('.im-chat-panel')).toHaveCount(0);
      const preservedHost = await readNativeSnapshot(page);
      expect(preservedHost.title).toBe('B站实时新标题');
      expect(preservedHost.origIconHref).toBe('data:,bili-live-icon');
      expect(preservedHost.colorScheme).toBe('light');

      // Focus restoration: focus native input in native mode -> click FAB -> return native via menu -> focus restores
      await page.evaluate(() => history.pushState({}, '', '/'));
      await expect(page.locator('.im-chat-panel')).toHaveCount(1);
      await page.locator('.xim-skin-btn').first().click();
      await page.locator('.xim-skin-menu [data-mode="native"]').click();
      await expect(page.locator('.xim-fab')).toBeVisible();
      await page.locator('#native-search-input').focus();
      await page.locator('.xim-fab').click();
      await expect(page.locator('.im-chat-panel')).toHaveCount(1);
      await page.locator('.xim-skin-btn').first().click();
      await page.locator('.xim-skin-menu [data-mode="native"]').click();
      await expect(page.locator('.xim-fab')).toBeVisible();
      expect(await page.evaluate(() => document.activeElement?.id)).toBe('native-search-input');

      // Host parent replacement while video/comments are borrowed -> dead old nodes are NOT resurrected and new host stays usable
      await page.evaluate(() => localStorage.setItem('bilishu-im-view', 'im'));
      await page.goto('https://www.bilibili.com/video/BV1ab1234567/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.im-thread-pin .im-video')).toBeVisible();
      await expect(page.locator('.im-native-comment-slot bili-comments')).toHaveCount(1);
      await page.locator('.im-thread-pin .im-video').click();
      await expect.poll(() =>
        page.evaluate(() => Boolean(document.getElementById('bilibili-player')?.closest('.im-video'))),
      ).toBe(true);

      await page.evaluate(() => {
        document.getElementById('player-origin')?.remove();
        document.getElementById('comment-origin')?.remove();
        const app = document.getElementById('app');
        const newPlayerWrap = document.createElement('section');
        newPlayerWrap.id = 'player-origin-v2';
        newPlayerWrap.innerHTML = '<div id="bilibili-player-v2"><video muted width="96" height="64"></video></div>';
        const newCommentWrap = document.createElement('section');
        newCommentWrap.id = 'comment-origin-v2';
        newCommentWrap.innerHTML = '<bili-comments id="native-comments-v2"></bili-comments>';
        app.append(newPlayerWrap, newCommentWrap);
      });

      await page.locator('.im-native-comment-fallback').click();
      await expect(page.locator('.im-chat-panel')).toHaveCount(0);
      const afterHostReplace = await page.evaluate(() => ({
        oldPlayerConnected: Boolean(window.__fixture.origPlayer?.isConnected),
        oldCommentsConnected: Boolean(window.__fixture.origComments?.isConnected),
        newPlayerConnected: Boolean(document.getElementById('bilibili-player-v2')?.isConnected),
        newCommentsConnected: Boolean(document.getElementById('native-comments-v2')?.isConnected),
      }));
      expect(afterHostReplace).toEqual({
        oldPlayerConnected: false,
        oldCommentsConnected: false,
        newPlayerConnected: true,
        newCommentsConnected: true,
      });

      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('A02.2 x F2, F3, F4: full reload, browser back/forward + BFCache, cold start, and 20-cycle stress roundtrips', async ({ browser }) => {
    const { context, page, pageErrors } = await setupContext(browser);
    try {
      await page.addInitScript(() => {
        localStorage.setItem('bilishu-im-skin', 'dingtalk');
      });

      // F2: IM reload -> clean native exit -> reload -> native clean -> reload /unsupported
      await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.im-chat-panel')).toHaveCount(1);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('.im-chat-panel')).toHaveCount(1);

      await page.locator('.xim-skin-btn').first().click();
      await page.locator('.xim-skin-menu [data-mode="native"]').click();
      await expect(page.locator('.xim-fab')).toBeVisible();
      await page.reload({ waitUntil: 'domcontentloaded' });
      const f2Native = await readNativeSnapshot(page);
      expect(f2Native.shellCount).toBe(0);
      expect(f2Native.title).toBe('Fixture Native');
      expect(f2Native.origIconHref).toBe('data:,native');
      await expect(page.locator('.xim-fab')).toBeVisible();

      // Switch back to IM and test F3 same-document + cross-document back/forward
      await page.locator('.xim-fab').click();
      await expect(page.locator('.im-chat-panel')).toHaveCount(1);

      await page.evaluate(() => history.pushState({}, '', '/c/tech/'));
      await expect.poll(() => page.title()).toBe('科技数码交流群 - 钉钉');
      await page.evaluate(() => history.pushState({}, '', '/unsupported'));
      await expect(page.locator('.im-chat-panel')).toHaveCount(0);

      await page.goBack();
      await expect(page.locator('.im-chat-panel')).toHaveCount(1);
      await expect.poll(() => page.title()).toBe('科技数码交流群 - 钉钉');
      await page.goForward();
      await expect(page.locator('.im-chat-panel')).toHaveCount(0);
      expect(await page.title()).toBe('Fixture Native');

      // Cross-document navigation: www -> search -> back -> forward, tracking pageshow.persisted
      await page.evaluate(() => {
        window.__pageshowEvents = [];
        window.addEventListener('pageshow', (e) => {
          window.__pageshowEvents.push({ persisted: Boolean(e.persisted), href: location.href });
        });
      });
      await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.im-chat-panel')).toHaveCount(1);
      await page.goto('https://search.bilibili.com/all?keyword=%E9%9F%B3%E4%B9%90', {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.locator('.im-search-view')).toHaveCount(1);
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('.im-chat-panel')).toHaveCount(1);
      await expect(page.locator('.im-search-view')).toHaveCount(0);
      await page.goForward({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('.im-search-view')).toHaveCount(1);

      // Synthetic BFCache pagehide/pageshow (persisted: true) suspend + idempotent remount
      await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.im-chat-panel')).toHaveCount(1);
      await page.evaluate(() => {
        window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      });
      expect(await page.locator('.im-chat-panel').count()).toBe(0);
      expect(await page.evaluate(() => window.__dingbiliLifecycle().active)).toBe(false);
      expect(await page.evaluate(() => window.__dingbiliLifecycle().activeSessionStats.disposed)).toBe(true);

      await page.evaluate(() => {
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      });
      await expect(page.locator('.im-chat-panel')).toHaveCount(1);
      expect(await page.evaluate(() => window.__dingbiliLifecycle().active)).toBe(true);

      // 20 roundtrips + rapid re-entrancy (no duplicate shells, no listener accumulation)
      for (let i = 0; i < 20; i += 1) {
        if (i % 2 === 0) {
          await page.evaluate(() => history.pushState({}, '', '/unsupported'));
          await expect(page.locator('.im-chat-panel')).toHaveCount(0);
          await page.evaluate(() => history.pushState({}, '', '/'));
          await expect(page.locator('.im-chat-panel')).toHaveCount(1);
        } else {
          await page.locator('.xim-skin-btn').first().click();
          await page.locator('.xim-skin-menu [data-mode="native"]').click();
          await expect(page.locator('.xim-fab')).toBeVisible();
          await expect(page.locator('.im-chat-panel')).toHaveCount(0);
          await page.locator('.xim-fab').click();
          await expect(page.locator('.im-chat-panel')).toHaveCount(1);
        }
      }

      // Rapid synchronous re-entrant switches ending on /unsupported
      await page.evaluate(() => {
        history.pushState({}, '', '/unsupported');
        history.pushState({}, '', '/');
        history.replaceState({}, '', '/unsupported');
      });
      await expect(page.locator('.im-chat-panel')).toHaveCount(0);
      await page.waitForTimeout(100);
      const after20 = await readNativeSnapshot(page);
      expect(after20.anyImNodeCount).toBe(0);
      expect(after20.lifecycle.activeSessionStats).toEqual({
        listeners: 0,
        observers: 0,
        timeouts: 0,
        intervals: 0,
        rafs: 0,
        nodes: 0,
        disposed: true,
      });

      const clicksBefore = await page.evaluate(() => window.__fixture.nativeButtonClicks);
      await page.click('#native-header-action');
      expect(await page.evaluate(() => window.__fixture.nativeButtonClicks)).toBe(clicksBefore + 1);

      // F4: Cold start with saved native preference stays native with FAB and 0 shells
      const nativeCold = await setupContext(browser, {
        preInitScript: `localStorage.setItem('bilishu-im-view', 'native');`,
      });
      try {
        await nativeCold.page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' });
        await nativeCold.page.waitForTimeout(200);
        await expect(nativeCold.page.locator('.im-chat-panel')).toHaveCount(0);
        await expect(nativeCold.page.locator('.xim-fab')).toBeVisible();
        await nativeCold.page.click('#native-header-action');
        expect(await nativeCold.page.evaluate(() => window.__fixture.nativeButtonClicks)).toBe(1);
        expect(nativeCold.pageErrors).toEqual([]);
      } finally {
        await nativeCold.context.close();
      }

      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
