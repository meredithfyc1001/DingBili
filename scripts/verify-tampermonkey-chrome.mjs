import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { APPROVED_MATCHES, USERSCRIPT_METADATA } from '../src/userscript/metadata.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const profileDir = path.join(rootDir, '.cache', 'chrome-tampermonkey-profile');
const distScriptPath = path.join(rootDir, 'dist', 'DingBili.user.js');
const fixturesDir = path.join(rootDir, 'tests', 'fixtures');
const evidenceDir = path.join(rootDir, 'test-results', 'tampermonkey-chrome');

const TAMPERMONKEY_IDS = new Set([
  'dhdgffkkebhmkfjojejmpbldmpobfkfo', // Stable
  'gcalenpjmijncebpfijmoaglllgpjagf', // Beta
]);

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').toUpperCase();
}

function startUserscriptServer(scriptBuffer) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.url && req.url.startsWith('/DingBili.user.js')) {
        res.writeHead(200, {
          'Content-Type': 'text/javascript; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        res.end(scriptBuffer);
        return;
      }
      res.writeHead(404);
      res.end('Not found');
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        server,
        url: `http://127.0.0.1:${addr.port}/DingBili.user.js`,
      });
    });
  });
}

async function waitForTampermonkeyWorker(context, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const workers = context.serviceWorkers();
    for (const w of workers) {
      const m = w.url().match(/^chrome-extension:\/\/([a-z]{32})\//);
      if (m && TAMPERMONKEY_IDS.has(m[1])) {
        return { worker: w, extId: m[1] };
      }
    }
    for (const w of workers) {
      const m = w.url().match(/^chrome-extension:\/\/([a-z]{32})\//);
      if (!m) continue;
      try {
        const info = await w.evaluate(() => ({
          name: chrome.runtime.getManifest().name,
          shortName: chrome.runtime.getManifest().short_name,
        }));
        if (/tampermonkey/i.test(`${info.name || ''} ${info.shortName || ''}`)) {
          return { worker: w, extId: m[1] };
        }
      } catch {
        // ignore transient startup worker errors
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

async function installUserscriptViaTampermonkeyUI(context, installUrl, extId) {
  const beforePages = new Set(context.pages());
  const triggerPage = await context.newPage();

  const askPagePromise = new Promise((resolve) => {
    const onPage = (p) => {
      if (p.url().startsWith(`chrome-extension://${extId}/ask.html`)) {
        context.off('page', onPage);
        resolve(p);
      }
    };
    context.on('page', onPage);
    setTimeout(() => {
      context.off('page', onPage);
      resolve(null);
    }, 10_000);
  });

  await triggerPage.goto(installUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
  let askPage = await askPagePromise;

  if (!askPage) {
    for (let i = 0; i < 20; i += 1) {
      const found = context
        .pages()
        .find((p) => p.url().startsWith(`chrome-extension://${extId}/ask.html`));
      if (found) {
        askPage = found;
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  if (!askPage) {
    const optPage = await context.newPage();
    await optPage.goto(`chrome-extension://${extId}/options.html#nav=utils`, {
      waitUntil: 'domcontentloaded',
    });
    await optPage.waitForTimeout(1500);
    const urlInput = optPage.locator('input[type="text"], input[type="url"]').last();
    if (await urlInput.isVisible().catch(() => false)) {
      await urlInput.fill(installUrl);
      const importBtn = optPage
        .locator('button, input[type="button"]')
        .filter({ hasText: /install|安装/i })
        .first();
      if (await importBtn.isVisible().catch(() => false)) {
        await importBtn.click();
        await optPage.waitForTimeout(2000);
      }
    }
    askPage = context
      .pages()
      .find(
        (p) =>
          p.url().startsWith(`chrome-extension://${extId}/ask.html`) ||
          (!beforePages.has(p) && p.url().includes('ask.html')),
      );
  }

  if (!askPage) {
    throw new Error(
      `Tampermonkey did not open the userscript install dialog (ask.html) for ${installUrl}. ` +
        'Ensure Tampermonkey is enabled and "Allow User Scripts" is toggled ON.',
    );
  }

  await askPage.waitForLoadState('domcontentloaded');
  await askPage.waitForTimeout(1500);

  const installDialogText = await askPage.evaluate(() => document.body.innerText);
  await askPage.screenshot({
    path: path.join(evidenceDir, '01-tampermonkey-install-dialog.png'),
    fullPage: true,
  });

  const installBtn = askPage
    .locator('input[type="button"], button')
    .filter({ hasText: /^(Install|Reinstall|Update|安装|重新安装|更新)$/i })
    .first();
  await installBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await installBtn.click();
  await new Promise((r) => setTimeout(r, 2000));

  if (!triggerPage.isClosed()) await triggerPage.close().catch(() => {});
  return { installDialogText };
}

async function openDashboardAndInspect(context, extId) {
  const dash = await context.newPage();
  await dash.goto(`chrome-extension://${extId}/options.html#nav=dashboard`, {
    waitUntil: 'domcontentloaded',
  });
  await dash.waitForTimeout(1500);

  const scriptRow = dash.locator('tr').filter({ hasText: 'DingBili' }).first();
  await scriptRow.waitFor({ state: 'visible', timeout: 10_000 });
  const rowText = await scriptRow.innerText();
  return { dash, scriptRow, rowText };
}

async function toggleScriptInDashboard(dash, scriptRow, targetEnabled) {
  const state = await scriptRow.evaluate((row) => {
    const cb = row.querySelector('input[type="checkbox"]');
    if (cb) return { kind: 'checkbox', checked: cb.checked };
    const slider = row.querySelector(
      '.slider, [class*="enable"], [title*="Enable"], [title*="Disable"], [title*="启用"], [title*="禁用"]',
    );
    const rowCls = row.className || '';
    const disabled = /disabled/i.test(rowCls) || /disabled/i.test(slider?.className || '');
    return { kind: 'slider', checked: !disabled };
  });

  if (state.checked !== targetEnabled) {
    const clickable = scriptRow
      .locator('input[type="checkbox"], .slider, .switch, [class*="enable"], td:nth-child(2)')
      .first();
    await clickable.click({ force: true });
    await dash.waitForTimeout(1200);
  }
}

async function main() {
  if (!fs.existsSync(distScriptPath)) {
    throw new Error('dist/DingBili.user.js not found. Run npm.cmd run build first.');
  }
  if (!fs.existsSync(profileDir)) {
    console.error(
      JSON.stringify(
        {
          status: 'BLOCKED',
          reason:
            'Isolated Chrome profile not initialized. Run "npm.cmd run setup:tm:chrome" first and install Tampermonkey + enable "Allow User Scripts".',
          profileDir,
        },
        null,
        2,
      ),
    );
    process.exitCode = 2;
    return;
  }

  fs.mkdirSync(evidenceDir, { recursive: true });
  const scriptBuf = fs.readFileSync(distScriptPath);
  const candidateSha256 = sha256File(distScriptPath);

  const fixtures = {
    home: fs.readFileSync(path.join(fixturesDir, 'home-feed.html'), 'utf8'),
    search: fs.readFileSync(path.join(fixturesDir, 'search-results.html'), 'utf8'),
    unsupported: fs.readFileSync(path.join(fixturesDir, 'unsupported-page.html'), 'utf8'),
    iframeHost: fs.readFileSync(path.join(fixturesDir, 'iframe-host.html'), 'utf8'),
  };

  const { server, url: installUrl } = await startUserscriptServer(scriptBuf);
  let context;
  let useIframeFixtureOnHome = false;

  try {
    context = await chromium.launchPersistentContext(profileDir, {
      channel: 'chrome',
      headless: false,
      viewport: { width: 1440, height: 900 },
      args: ['--no-first-run', '--no-default-browser-check'],
    });

    const chromeVersion = context.browser()?.version() || 'unknown';
    const tm = await waitForTampermonkeyWorker(context);
    if (!tm) {
      console.error(
        JSON.stringify(
          {
            status: 'BLOCKED',
            chromeVersion,
            reason:
              'Tampermonkey extension not detected in isolated Chrome profile. Run "npm.cmd run setup:tm:chrome" and install Tampermonkey from Chrome Web Store.',
          },
          null,
          2,
        ),
      );
      process.exitCode = 2;
      return;
    }

    const tmInfo = await tm.worker.evaluate(() => {
      const manifest = chrome.runtime.getManifest();
      return {
        extId: chrome.runtime.id,
        name: manifest.name,
        version: manifest.version,
        manifestVersion: manifest.manifest_version,
        hasUserScriptsApi: typeof chrome.userScripts === 'object' && chrome.userScripts !== null,
      };
    });

    if (!tmInfo.hasUserScriptsApi) {
      console.error(
        JSON.stringify(
          {
            status: 'BLOCKED',
            chromeVersion,
            tampermonkey: tmInfo,
            reason:
              'Tampermonkey is installed, but Chrome "Allow User Scripts" ("允许用户脚本") toggle is OFF. Open chrome://extensions/?id=' +
              tmInfo.extId +
              ' in the isolated profile and enable "Allow User Scripts".',
          },
          null,
          2,
        ),
      );
      process.exitCode = 2;
      return;
    }

    // Install dist/DingBili.user.js through Tampermonkey's real installation dialog
    const { installDialogText } = await installUserscriptViaTampermonkeyUI(context, installUrl, tm.extId);
    assert.ok(installDialogText.includes('DingBili'), 'Install dialog must display DingBili name');
    assert.ok(installDialogText.includes(USERSCRIPT_METADATA.version), 'Install dialog must display version');
    for (const matchPattern of APPROVED_MATCHES) {
      assert.ok(
        installDialogText.includes(matchPattern) || installDialogText.includes(matchPattern.replace('https://', '')),
        `Install dialog must display match pattern ${matchPattern}`,
      );
    }

    const { dash, scriptRow, rowText } = await openDashboardAndInspect(context, tm.extId);
    await dash.screenshot({
      path: path.join(evidenceDir, '02-tampermonkey-dashboard-enabled.png'),
      fullPage: true,
    });

    // Route ONLY bilibili test domains to frozen offline fixtures; do NOT inject DingBili via addInitScript!
    await context.route('**/*', async (route) => {
      const req = route.request();
      let u;
      try {
        u = new URL(req.url());
      } catch {
        await route.continue();
        return;
      }
      if (u.hostname === 'www.bilibili.com' || u.hostname === 'search.bilibili.com') {
        if (req.resourceType() === 'document') {
          let body = fixtures.home;
          if (u.hostname === 'search.bilibili.com') {
            body = fixtures.search;
          } else if (u.pathname === '/unsupported') {
            body = fixtures.unsupported;
          } else if (u.pathname === '/' && useIframeFixtureOnHome) {
            body = fixtures.iframeHost;
          }
          await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
          return;
        }
        await route.abort('blockedbyclient');
        return;
      }
      await route.continue();
    });

    const pageErrors = [];
    const testPage = await context.newPage();
    testPage.on('pageerror', (e) => pageErrors.push(String(e)));

    // 1. Main site match (www.bilibili.com)
    useIframeFixtureOnHome = false;
    await testPage.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' });
    await testPage.locator('.im-chat-panel').waitFor({ state: 'visible', timeout: 10_000 });
    const mainResult = await testPage.evaluate(() => ({
      shells: document.querySelectorAll('.im-chat-panel').length,
      hasImTheme: document.documentElement.classList.contains('im-theme'),
      msgCount: document.querySelectorAll('.im-msg').length,
      title: document.title,
    }));
    assert.equal(mainResult.shells, 1);
    assert.equal(mainResult.hasImTheme, true);
    assert.equal(mainResult.msgCount, 1);
    await testPage.screenshot({ path: path.join(evidenceDir, '03-www-main-injected.png') });

    // 2. Search subdomain match (search.bilibili.com)
    await testPage.goto('https://search.bilibili.com/all?keyword=%E9%9F%B3%E4%B9%90', {
      waitUntil: 'domcontentloaded',
    });
    await testPage.locator('.im-search-view').waitFor({ state: 'visible', timeout: 10_000 });
    const searchResult = await testPage.evaluate(() => ({
      searchViews: document.querySelectorAll('.im-search-view').length,
      hasImTheme: document.documentElement.classList.contains('im-theme'),
      resultsText: document.querySelector('.im-search-results')?.textContent?.trim() || '',
    }));
    assert.equal(searchResult.searchViews, 1);
    assert.equal(searchResult.hasImTheme, true);
    assert.ok(searchResult.resultsText.includes('音乐样本第一页视频'));
    await testPage.screenshot({ path: path.join(evidenceDir, '04-search-subdomain-injected.png') });

    // 3. Iframe non-injection (@noframes)
    useIframeFixtureOnHome = true;
    await testPage.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' });
    await testPage.locator('.im-chat-panel').waitFor({ state: 'visible', timeout: 10_000 });
    const childFrame = testPage.frame({ url: 'https://www.bilibili.com/c/music/' });
    assert.ok(childFrame, 'Matched child iframe must exist');
    await childFrame.waitForLoadState('domcontentloaded');
    await testPage.waitForTimeout(800);
    const iframeResult = {
      topShells: await testPage.locator('.im-chat-panel').count(),
      childShells: await childFrame.locator('.im-chat-panel').count(),
      childHasImTheme: await childFrame.locator('html.im-theme').count(),
    };
    assert.deepEqual(iframeResult, { topShells: 1, childShells: 0, childHasImTheme: 0 });
    await testPage.screenshot({ path: path.join(evidenceDir, '05-iframe-noframes-check.png') });

    // 4. Unsupported route stays native
    useIframeFixtureOnHome = false;
    await testPage.goto('https://www.bilibili.com/unsupported', { waitUntil: 'domcontentloaded' });
    await testPage.waitForTimeout(800);
    await testPage.click('#native-btn');
    const unsupportedResult = await testPage.evaluate(() => ({
      shells: document.querySelectorAll('.im-chat-panel').length,
      hasImTheme: document.documentElement.classList.contains('im-theme'),
      nativeClicks: window.__fixture.nativeClicks,
    }));
    assert.deepEqual(unsupportedResult, { shells: 0, hasImTheme: false, nativeClicks: 1 });

    // 5. Disable DingBili in Tampermonkey -> reload www -> original Bilibili page works cleanly
    await dash.bringToFront();
    await toggleScriptInDashboard(dash, scriptRow, false);
    await dash.screenshot({
      path: path.join(evidenceDir, '06-tampermonkey-dashboard-disabled.png'),
      fullPage: true,
    });

    await testPage.bringToFront();
    await testPage.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' });
    await testPage.waitForTimeout(1000);
    await testPage.click('#native-header-action');
    await testPage.fill('#native-search-input', '原版可用测试');
    const disabledResult = await testPage.evaluate(() => ({
      shells: document.querySelectorAll('.im-chat-panel').length,
      hasImTheme: document.documentElement.classList.contains('im-theme'),
      title: document.title,
      faviconHref: document.getElementById('orig')?.getAttribute('href') ?? null,
      nativeButtonClicks: window.__fixture.nativeButtonClicks,
      nativeInputValue: document.getElementById('native-search-input')?.value ?? '',
    }));
    assert.deepEqual(disabledResult, {
      shells: 0,
      hasImTheme: false,
      title: 'Fixture Native',
      faviconHref: 'data:,native',
      nativeButtonClicks: 1,
      nativeInputValue: '原版可用测试',
    });
    await testPage.screenshot({ path: path.join(evidenceDir, '07-www-disabled-native.png') });

    // 6. Re-enable DingBili in Tampermonkey -> reload www -> 1 shell mounts cleanly
    await dash.bringToFront();
    await toggleScriptInDashboard(dash, scriptRow, true);
    await testPage.bringToFront();
    await testPage.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' });
    await testPage.locator('.im-chat-panel').waitFor({ state: 'visible', timeout: 10_000 });
    const reenabledShells = await testPage.locator('.im-chat-panel').count();
    assert.equal(reenabledShells, 1);

    assert.deepEqual(pageErrors, []);

    const report = {
      status: 'PASS',
      executedAt: new Date().toISOString(),
      candidateVersion: USERSCRIPT_METADATA.version,
      candidateSha256,
      chromeVersion,
      tampermonkey: tmInfo,
      dashboardRow: rowText.replace(/\s+/g, ' ').trim(),
      checks: {
        metadataParsedInInstallDialog: 'PASS',
        mainSiteMatch: mainResult,
        searchSubdomainMatch: searchResult,
        iframeNoframes: iframeResult,
        unsupportedRouteNative: unsupportedResult,
        disabledRestoresNative: disabledResult,
        reenabledRemountsSingleShell: { shells: reenabledShells },
      },
      pageErrors,
      screenshotsDir: path.relative(rootDir, evidenceDir),
    };

    fs.writeFileSync(path.join(evidenceDir, 'evidence.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (context) await context.close().catch(() => {});
    server.close();
  }
}

main().catch((err) => {
  console.error('[test:tm:chrome] FAILED:', err);
  process.exitCode = 1;
});
