import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { buildPerfCardsHtml } from '../fixtures/perf-cards.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const fixturesDir = path.join(rootDir, 'tests', 'fixtures');
const distScriptPath = path.join(rootDir, 'dist', 'DingBili.user.js');
const upstreamScriptPath = path.join(rootDir, 'P0-audit', 'upstream', 'bilishu.user.js');

const FIXTURES = {
  home: fs.readFileSync(path.join(fixturesDir, 'home-feed.html'), 'utf8'),
  search: fs.readFileSync(path.join(fixturesDir, 'search-results.html'), 'utf8'),
  video: fs.readFileSync(path.join(fixturesDir, 'video-detail.html'), 'utf8'),
  unsupported: fs.readFileSync(path.join(fixturesDir, 'unsupported-page.html'), 'utf8'),
  iframeHost: fs.readFileSync(path.join(fixturesDir, 'iframe-host.html'), 'utf8'),
};

const DIST_SOURCE = fs.readFileSync(distScriptPath, 'utf8');
const UPSTREAM_SOURCE = fs.existsSync(upstreamScriptPath)
  ? fs.readFileSync(upstreamScriptPath, 'utf8')
  : null;

async function setupIsolatedContext(browser, { scriptSource = DIST_SOURCE, htmlResolver = null, viewport = { width: 1440, height: 900 } } = {}) {
  const context = await browser.newContext({ viewport });
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = req.url();
    if (req.resourceType() === 'document') {
      const parsed = new URL(url);
      let body = null;
      if (htmlResolver) {
        body = htmlResolver(parsed);
      }
      if (body == null) {
        if (parsed.hostname === 'search.bilibili.com') {
          body = FIXTURES.search;
        } else if (parsed.pathname.startsWith('/video/')) {
          body = FIXTURES.video;
        } else if (parsed.pathname === '/unsupported') {
          body = FIXTURES.unsupported;
        } else if (parsed.pathname === '/iframe-host') {
          body = FIXTURES.iframeHost;
        } else {
          body = FIXTURES.home;
        }
      }
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body,
      });
      return;
    }
    await route.abort('blockedbyclient');
  });

  await context.addInitScript({ content: scriptSource });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  return { context, page, pageErrors };
}

test.describe('P1-01 Frozen Behavior Baseline & Single-File Build (A01)', () => {
  test('A01.2 / PB-09: top-level matched page mounts 1 shell, iframe mounts 0 shells, unsupported page remains native', async ({ browser }) => {
    const { context, page, pageErrors } = await setupIsolatedContext(browser, {
      htmlResolver: (u) => {
        if (u.pathname === '/') return FIXTURES.iframeHost;
        if (u.pathname === '/c/music/') return FIXTURES.home;
        if (u.pathname === '/unsupported') return FIXTURES.unsupported;
        return null;
      },
    });
    try {
      await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.im-chat-panel')).toHaveCount(1);
      await expect(page.locator('.im-list-panel')).toHaveCount(1);

      const childFrame = page.frame({ url: 'https://www.bilibili.com/c/music/' });
      expect(childFrame).not.toBeNull();
      await childFrame.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(300);
      expect(await childFrame.locator('.im-chat-panel').count()).toBe(0);
      expect(await childFrame.locator('html.im-theme').count()).toBe(0);

      // Unsupported route renders native interactive page without shell
      const page2 = await context.newPage();
      await page2.goto('https://www.bilibili.com/unsupported', { waitUntil: 'domcontentloaded' });
      await page2.waitForTimeout(300);
      await expect(page2.locator('.im-chat-panel')).toHaveCount(0);
      await expect(page2.locator('html.im-theme')).toHaveCount(0);
      await page2.click('#native-btn');
      expect(await page2.evaluate(() => window.__fixture.nativeClicks)).toBe(1);
      await page2.close();

      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('T01 / PB-01 / PB-02 / KF-03 / KF-12: 3-theme switching, geometry, native FAB restore, and 900x800 narrow-window bug baseline', async ({ browser }) => {
    const { context, page, pageErrors } = await setupIsolatedContext(browser);
    try {
      await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.im-chat-panel')).toBeVisible();
      await expect(page.locator('.im-msg')).toHaveCount(1);

      // KF-03 baseline: default skin on clean profile is currently feishu
      const initialSkin = await page.evaluate(() => document.documentElement.dataset.imSkin || localStorage.getItem('bilishu-im-skin') || 'feishu');
      expect(initialSkin).toBe('feishu');

      const measureLayout = () =>
        page.evaluate(() => {
          const rect = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return { w: 0, h: 0 };
            const r = el.getBoundingClientRect();
            return { w: Math.round(r.width), h: Math.round(r.height) };
          };
          return {
            title: document.title,
            skin: localStorage.getItem('bilishu-im-skin') || 'feishu',
            titlebarH: rect('.im-titlebar').h,
            railW: rect('.im-rail').w,
            listW: rect('.im-list-panel').w,
            chatW: rect('.im-chat-panel').w,
            stripW: rect('.im-strip').w,
          };
        });

      const selectSkinViaMenu = async (skinId) => {
        await page.locator('.xim-skin-btn').first().click();
        await expect(page.locator('.xim-skin-menu')).toBeVisible();
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
          page.locator(`.xim-skin-menu [data-skin="${skinId}"]`).click(),
        ]);
        await expect(page.locator('.im-chat-panel')).toBeVisible();
      };

      const feishuGeom = await measureLayout();
      expect(feishuGeom.railW).toBe(230);
      expect(feishuGeom.listW).toBe(360);
      expect(feishuGeom.stripW).toBe(48);

      await selectSkinViaMenu('dingtalk');
      const dingtalkGeom = await measureLayout();
      expect(dingtalkGeom.skin).toBe('dingtalk');
      expect(dingtalkGeom.titlebarH).toBe(40);
      expect(dingtalkGeom.railW).toBe(56);
      expect(dingtalkGeom.listW).toBe(320);
      expect(dingtalkGeom.chatW).toBe(1064);

      // KF-09 KNOWN FAILURE BASELINE (to be fixed in P1-05):
      // DingTalk titlebar avatar (.im-titlebar .me-chip) is static and triggers no account/login action on click
      const beforeAvatarUrl = page.url();
      await page.locator('.im-titlebar .me-chip').click();
      await page.waitForTimeout(150);
      expect(page.url()).toBe(beforeAvatarUrl);
      expect(await page.evaluate(() => localStorage.getItem('bilishu-im-view') || 'im')).toBe('im');

      await selectSkinViaMenu('wecom');
      const wecomGeom = await measureLayout();
      expect(wecomGeom.skin).toBe('wecom');
      expect(wecomGeom.railW).toBe(162);
      expect(wecomGeom.listW).toBe(320);

      await selectSkinViaMenu('dingtalk');

      // PB-02: Switch to native mode via menu -> reload -> native title, icon, interactive, FAB present
      await page.locator('.xim-skin-btn').first().click();
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        page.locator('.xim-skin-menu [data-mode="native"]').click(),
      ]);
      await expect(page.locator('.xim-fab')).toBeVisible();
      await expect(page.locator('.im-chat-panel')).toHaveCount(0);
      expect(await page.title()).toBe('Fixture Native');
      expect(await page.evaluate(() => document.getElementById('orig')?.getAttribute('href'))).toBe('data:,native');
      await page.click('#native-header-action');
      expect(await page.evaluate(() => window.__fixture.nativeButtonClicks)).toBe(1);

      // Click FAB to restore DingTalk IM mode
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        page.locator('.xim-fab').click(),
      ]);
      await expect(page.locator('.im-chat-panel')).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('bilishu-im-skin'))).toBe('dingtalk');

      // KF-12 KNOWN FAILURE BASELINE (to be fixed in P1-07):
      // At 900x800 on DingTalk, clicking fake:0 inserts .im-colleague-view but width is 0 because im-topic-open is never toggled
      await page.setViewportSize({ width: 900, height: 800 });
      const fakeRow = page.locator('[data-id="fake:0"]').first();
      await expect(fakeRow).toBeVisible();
      await fakeRow.click();
      await expect(page.locator('.im-colleague-view[data-id="fake:0"]')).toHaveCount(1);
      const narrowState = await page.evaluate(() => {
        const panel = document.querySelector('.im-chat-panel');
        const col = document.querySelector('.im-colleague-view');
        return {
          hasTopicOpenClass: document.documentElement.classList.contains('im-topic-open'),
          chatDisplay: panel ? getComputedStyle(panel).display : '',
          colleagueWidth: col ? Math.round(col.getBoundingClientRect().width) : -1,
        };
      });
      expect(narrowState.hasTopicOpenClass).toBe(false);
      expect(narrowState.chatDisplay).toBe('none');
      expect(narrowState.colleagueWidth).toBe(0);

      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('T02 / PB-04 / PB-08 / KF-06 / KF-10: feed dedup, stale edit/remove baseline, colleague bounds & reload loss baseline', async ({ browser }) => {
    const { context, page, pageErrors } = await setupIsolatedContext(browser);
    try {
      await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.im-msg')).toHaveCount(1);

      // Insert duplicate ID card and new unique ID card
      await page.evaluate(() => {
        window.__fixture.addCard({ id: 'BV1ab1234567', title: '重复卡片标题' });
        window.__fixture.addCard({ id: 'BV2cd2345678', title: '首页样本视频二' });
      });
      await expect(page.locator('.im-msg')).toHaveCount(2);

      // KF-06 KNOWN FAILURE BASELINE (to be fixed in P1-04):
      // Rename first card and remove second card; after 600ms, both old messages remain unchanged
      await page.evaluate(() => {
        window.__fixture.renameFirstCard('已修改的新标题');
        window.__fixture.removeCardById('BV2cd2345678');
      });
      await page.waitForTimeout(600);
      const msgsAfterEdit = await page.evaluate(() =>
        [...document.querySelectorAll('.im-msg')].map((el) => ({
          id: el.dataset.id,
          text: el.textContent,
        })),
      );
      expect(msgsAfterEdit.length).toBe(2);
      expect(msgsAfterEdit[0].text).toContain('首页样本视频一');
      expect(msgsAfterEdit[0].text).not.toContain('已修改的新标题');

      // PB-08: Colleague chat bounds (101 messages -> 100 kept, 5050 chars -> truncated to 5000) & isolation
      await page.locator('[data-id="fake:0"]').first().click();
      await expect(page.locator('.im-colleague-view[data-id="fake:0"]')).toBeVisible();
      await page.evaluate(() => {
        const form = document.querySelector('.im-colleague-compose');
        const box = form.querySelector('textarea');
        for (let i = 1; i <= 100; i += 1) {
          box.value = 'local-msg-' + i;
          form.requestSubmit();
        }
        box.value = 'X'.repeat(5050);
        form.requestSubmit();
      });
      const colleagueStats = await page.evaluate(() => {
        const meBubbles = [...document.querySelectorAll('.im-colleague-message.me .im-colleague-bubble')];
        return {
          count: meBubbles.length,
          firstText: meBubbles[0]?.textContent || '',
          lastLen: (meBubbles.at(-1)?.textContent || '').length,
        };
      });
      expect(colleagueStats.count).toBe(100);
      expect(colleagueStats.firstText).toBe('local-msg-2');
      expect(colleagueStats.lastLen).toBe(5000);

      // Switch to fake:1 -> must not leak fake:0 messages; reopen fake:0 -> still retained in memory
      await page.locator('[data-id="fake:1"]').first().click();
      await expect(page.locator('.im-colleague-view[data-id="fake:1"]')).toBeVisible();
      expect(await page.locator('.im-colleague-message.me').count()).toBe(0);
      await page.locator('[data-id="fake:0"]').first().click();
      expect(await page.locator('.im-colleague-message.me').count()).toBe(100);

      // KF-10 KNOWN FAILURE BASELINE (to be fixed in P1-06):
      // Full page reload loses simulated colleague messages
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('[data-id="fake:0"]').first().click();
      await expect(page.locator('.im-colleague-view[data-id="fake:0"]')).toBeVisible();
      expect(await page.locator('.im-colleague-message.me').count()).toBe(0);

      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('T03 / F1-F4 baseline / KF-01 / KF-02: SPA exit residuals, back remount, and cold-start unsupported->SPA failure', async ({ browser }) => {
    const { context, page, pageErrors } = await setupIsolatedContext(browser);
    try {
      // Seed DingTalk + dark color mode on www to match T03
      await page.addInitScript(() => {
        localStorage.setItem('bilishu-im-skin', 'dingtalk');
        localStorage.setItem('bilishu-im-color-theme', 'dark');
      });

      await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.im-chat-panel')).toBeVisible();

      // F1 SPA pushState to /c/tech/
      await page.evaluate(() => {
        history.pushState({}, '', '/c/tech/');
      });
      await expect.poll(() => page.title()).toBe('科技数码交流群 - 钉钉');

      // F1 SPA replaceState to unsupported route -> reproduces KF-01 residuals
      await page.evaluate(() => {
        history.replaceState({}, '', '/unsupported');
      });
      await expect(page.locator('.im-chat-panel')).toHaveCount(0);
      await page.waitForTimeout(150);

      const residual = await page.evaluate(() => ({
        title: document.title,
        origIconById: document.getElementById('orig')?.getAttribute('href') ?? null,
        hasDarkClass: document.documentElement.classList.contains('im-dark'),
        colorScheme: document.documentElement.style.colorScheme,
        imNavVar: document.documentElement.style.getPropertyValue('--im-nav'),
      }));
      // KF-01 KNOWN FAILURE BASELINE (to be fixed in P1-02):
      expect(residual.title).toBe('科技数码交流群 - 钉钉');
      expect(residual.origIconById).toBeNull();
      expect(residual.hasDarkClass).toBe(true);
      expect(residual.colorScheme).toBe('dark');
      expect(residual.imNavVar).toBe('56px');

      // F3 browser back remounts shell on supported route
      await page.goBack();
      await expect(page.locator('.im-chat-panel')).toBeVisible();

      // F4 cold start on unsupported route -> same-document pushState('/') reproduces KF-02
      const cold = await setupIsolatedContext(browser);
      try {
        await cold.page.goto('https://www.bilibili.com/unsupported', { waitUntil: 'domcontentloaded' });
        await cold.page.waitForTimeout(200);
        await cold.page.evaluate(() => {
          history.pushState({}, '', '/');
        });
        await cold.page.waitForTimeout(300);
        // KF-02 KNOWN FAILURE BASELINE (to be fixed in P1-02): shell fails to mount
        expect(await cold.page.locator('.im-chat-panel').count()).toBe(0);
        expect(cold.pageErrors).toEqual([]);
      } finally {
        await cold.context.close();
      }

      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('T04 / PB-05 / KF-03 / KF-04: cross-origin search default skin, next page single callback, and broken group href baseline', async ({ browser }) => {
    const { context, page, pageErrors } = await setupIsolatedContext(browser);
    try {
      // Select DingTalk on www.bilibili.com first
      await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.im-chat-panel')).toBeVisible();
      await page.evaluate(() => localStorage.setItem('bilishu-im-skin', 'dingtalk'));

      // Navigate to search.bilibili.com/all?keyword=音乐 (separate origin, empty storage)
      await page.goto('https://search.bilibili.com/all?keyword=%E9%9F%B3%E4%B9%90', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.im-search-view')).toBeVisible();

      // KF-03 KNOWN FAILURE BASELINE (to be fixed in P1-03/P1-04): search origin defaults to feishu instead of dingtalk
      const searchSkin = await page.evaluate(() => localStorage.getItem('bilishu-im-skin') || 'feishu');
      expect(searchSkin).toBe('feishu');
      expect(await page.title()).toContain('飞书');

      // PB-05: Switch to 视频 tab, click next page -> native handler fires exactly once, page 2 appears
      await page.locator('[data-search-tab="视频"]').click();
      await expect(page.locator('.im-search-results')).toContainText('音乐样本第一页视频');
      await page.locator('[data-page="next"]').click();
      await expect(page.locator('.im-search-results')).toContainText('音乐样本第二页视频');
      expect(await page.evaluate(() => window.__fixture.nextClicks)).toBe(1);

      // KF-04 KNOWN FAILURE BASELINE (to be fixed in P1-04):
      // Group tab builds broken double-prefixed URL with hostname www.bilibili.comhttps
      await page.locator('[data-search-tab="群组"]').click();
      const groupHref = await page.locator('.im-search-results a[href]').first().getAttribute('href');
      expect(groupHref).toBeTruthy();
      expect(new URL(groupHref).hostname).toBe('www.bilibili.comhttps');

      // Close search -> background chat panel inert cleared
      await page.locator('[data-search-close]').click();
      await expect(page.locator('.im-search-view')).toHaveCount(0);
      expect(await page.evaluate(() => document.querySelector('.im-chat-panel')?.inert)).toBe(false);

      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('T05 / PB-06: video detail borrows same #bilibili-player object, plays local WebM, and restores cleanly to native parent', async ({ browser }) => {
    const { context, page, pageErrors } = await setupIsolatedContext(browser);
    try {
      await page.goto('https://www.bilibili.com/video/BV1ab1234567/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.im-thread-pin .im-video')).toBeVisible();
      await expect(page.locator('.im-thread-pin')).toContainText('样本视频详情标题');

      // Prepare synthetic local WebM Blob video stream
      const mediaInfo = await page.evaluate(() => window.__fixture.attachSyntheticMedia());
      expect(mediaInfo).toBeTruthy();

      // Click video preview inside skin -> moves native #bilibili-player into .im-video
      await page.locator('.im-thread-pin .im-video').click();
      await expect.poll(() =>
        page.evaluate(() => {
          const p = document.getElementById('bilibili-player');
          return Boolean(p && p === window.__fixture.origPlayer && p.closest('.im-video'));
        }),
      ).toBe(true);

      // Wait for real playback progression on synthetic WebM
      await expect.poll(
        () =>
          page.evaluate(() => ({
            playCount: window.__fixture.playCount,
            currentTime: window.__fixture.origVideo.currentTime,
            paused: window.__fixture.origVideo.paused,
          })),
        { timeout: 5000 },
      ).toMatchObject({ playCount: 1, paused: false });

      await page.waitForTimeout(250);
      const progressed = await page.evaluate(() => window.__fixture.origVideo.currentTime);
      expect(progressed).toBeGreaterThan(0);

      // Click native fallback button ("原版评论") -> returns #bilibili-player to #player-origin before #player-sibling, paused, style preserved
      await page.locator('.im-native-comment-fallback').click();
      await expect(page.locator('.im-chat-panel')).toHaveCount(0);

      const restored = await page.evaluate(() => {
        const p = document.getElementById('bilibili-player');
        const origin = document.getElementById('player-origin');
        const sibling = document.getElementById('player-sibling');
        return {
          sameIdentity: p === window.__fixture.origPlayer,
          parentIsOrigin: p?.parentElement === origin,
          beforeSibling: p?.nextElementSibling === sibling,
          heightStyle: p?.style.height,
          paused: window.__fixture.origVideo.paused,
        };
      });
      expect(restored).toEqual({
        sameIdentity: true,
        parentIsOrigin: true,
        beforeSibling: true,
        heightStyle: '188px',
        paused: true,
      });

      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('T06 / PB-07 / KF-08: open Shadow DOM comments, expand rpid=3, sub-reply callback, cancel-reply residual baseline, and bili-comments restore', async ({ browser }) => {
    const { context, page, pageErrors } = await setupIsolatedContext(browser);
    try {
      await page.goto('https://www.bilibili.com/video/BV1ab1234567/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.im-native-comment-slot bili-comments')).toHaveCount(1);
      await expect(page.locator('.im-msg[data-comment="true"]')).toHaveCount(1);

      // Open comment thread drawer -> auto clicks native #view-more once -> inserts rpid=3
      await page.locator('.im-comment-replies-link').first().click();
      await expect(page.locator('.im-comment-thread')).toBeVisible();
      await expect(page.locator('.im-comment-thread')).toContainText('后续样本');
      expect(await page.evaluate(() => window.__fixture.expandClicks)).toBe(1);

      // Click reply on rpid=3 ("样本丙") -> native reply button callback receives rpid="3"
      const lastThreadMsg = page.locator('.im-comment-thread .im-msg').last();
      const lastReplyBtn = lastThreadMsg.locator('.im-inline-reply[data-action="native-reply"]');
      await lastReplyBtn.click();
      await expect(page.locator('.im-native-comment-caption span')).toHaveText('回复 样本丙');
      expect(await page.evaluate(() => window.__fixture.replyClicks)).toEqual(['3']);

      // Click "取消回复" -> caption resets BUT KF-08 KNOWN FAILURE BASELINE: data-bilishu-active-reply remains on thread
      await page.locator('.im-cancel-reply').click();
      await expect(page.locator('.im-native-comment-caption span')).toHaveText('评论到当前视频');
      const afterCancel = await page.evaluate(() => {
        const host = window.__fixture.origComments;
        const thread = host.shadowRoot.querySelector('bili-comment-thread-renderer');
        return {
          hostReplyAttr: host.getAttribute('data-bilishu-reply'),
          threadActiveReplyAttr: thread?.getAttribute('data-bilishu-active-reply'),
        };
      });
      expect(afterCancel.hostReplyAttr).toBeNull();
      // KF-08 KNOWN FAILURE BASELINE (to be fixed in P1-05/P1-06):
      expect(afterCancel.threadActiveReplyAttr).toBe('1');

      // KF-11 / DM4 KNOWN FAILURE BASELINE (to be fixed in P1-06):
      // Clicking .im-detail-expand scrolls window once and unconditionally reports "没有更多折叠评论" (expandAllComments returns 0)
      await page.evaluate(() => {
        window.__fixture.scrollByCount = 0;
        const origScrollBy = window.scrollBy.bind(window);
        window.scrollBy = (...args) => {
          window.__fixture.scrollByCount += 1;
          return origScrollBy(...args);
        };
      });
      await page.locator('.im-detail-expand').click();
      await page.waitForTimeout(150);
      expect(await page.evaluate(() => window.__fixture.scrollByCount)).toBe(1);

      // Exit to native via "原版评论" -> bili-comments returns to #comment-origin before #comment-sibling
      await page.locator('.im-native-comment-fallback').click();
      await expect(page.locator('.im-chat-panel')).toHaveCount(0);
      const commentRestored = await page.evaluate(() => {
        const host = window.__fixture.origComments;
        const origin = document.getElementById('comment-origin');
        const sibling = document.getElementById('comment-sibling');
        const injectedStyles = host.shadowRoot.querySelectorAll('style[data-bilishu-native], style').length;
        return {
          parentIsOrigin: host.parentElement === origin,
          beforeSibling: host.nextElementSibling === sibling,
          injectedStyles,
        };
      });
      expect(commentRestored).toEqual({
        parentIsOrigin: true,
        beforeSibling: true,
        injectedStyles: 0,
      });

      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('T07 / KF-07: unrelated span mutation probe reproduces 30 and 300 card title re-reads', async ({ browser }) => {
    for (const count of [30, 300]) {
      const html = buildPerfCardsHtml(count);
      const { context, page, pageErrors } = await setupIsolatedContext(browser, {
        htmlResolver: () => html,
      });
      try {
        await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' });
        await expect(page.locator('.im-msg')).toHaveCount(count);
        await page.waitForTimeout(1200);

        const metrics = await page.evaluate(async () => {
          const CARD_SEL = '.bili-video-card, .video-card, .video-card-reco, .video-page-card-small, .rank-item';
          const TITLE_SEL = 'h3 a[href], a.title[href], .info a[href]';
          const origQsa = document.querySelectorAll.bind(document);
          const origElQs = Element.prototype.querySelector;
          let cardQueryCount = 0;
          let titleQueryCount = 0;

          document.querySelectorAll = function patchedQsa(sel) {
            if (sel === CARD_SEL) cardQueryCount += 1;
            return origQsa(sel);
          };
          Element.prototype.querySelector = function patchedQs(sel) {
            if (sel === TITLE_SEL && this.matches && this.matches('article.bili-video-card')) {
              titleQueryCount += 1;
            }
            return origElQs.call(this, sel);
          };

          try {
            await new Promise((r) => setTimeout(r, 650));
            const idle = { cardQueryCount, titleQueryCount };
            cardQueryCount = 0;
            titleQueryCount = 0;

            const span = document.createElement('span');
            span.dataset.unrelatedProbe = '1';
            document.getElementById('app').appendChild(span);

            await new Promise((r) => setTimeout(r, 650));
            const afterMutation = { cardQueryCount, titleQueryCount };
            return { idle, afterMutation };
          } finally {
            document.querySelectorAll = origQsa;
            Element.prototype.querySelector = origElQs;
          }
        });

        expect(metrics.idle).toEqual({ cardQueryCount: 0, titleQueryCount: 0 });
        // KF-07 KNOWN FAILURE BASELINE (to be reduced to titleQueryCount === 0 in P1-04):
        expect(metrics.afterMutation.cardQueryCount).toBe(1);
        expect(metrics.afterMutation.titleQueryCount).toBe(count);
        expect(pageErrors).toEqual([]);
      } finally {
        await context.close();
      }
    }
  });

  test('A01.1 parity: read-only upstream bilishu.user.js matches built dist/DingBili.user.js baseline behavior', async ({ browser }) => {
    test.skip(!UPSTREAM_SOURCE, 'Upstream read-only snapshot not present in environment');
    const { context, page, pageErrors } = await setupIsolatedContext(browser, {
      scriptSource: UPSTREAM_SOURCE,
    });
    try {
      await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.im-chat-panel')).toBeVisible();
      await expect(page.locator('.im-msg')).toHaveCount(1);
      expect(await page.title()).toContain('飞书');

      await page.goto('https://search.bilibili.com/all?keyword=%E9%9F%B3%E4%B9%90', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.im-search-view')).toBeVisible();
      await page.locator('[data-search-tab="群组"]').click();
      const groupHref = await page.locator('.im-search-results a[href]').first().getAttribute('href');
      expect(new URL(groupHref).hostname).toBe('www.bilibili.comhttps');
      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
