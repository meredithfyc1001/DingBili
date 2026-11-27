import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const profileDir = path.join(rootDir, '.cache', 'chrome-tampermonkey-profile');

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

const TAMPERMONKEY_ID = 'dhdgffkkebhmkfjojejmpbldmpobfkfo';
const CWS_URL = `https://chromewebstore.google.com/detail/tampermonkey/${TAMPERMONKEY_ID}`;
const EXT_DETAILS_URL = `chrome://extensions/?id=${TAMPERMONKEY_ID}`;

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Windows Chrome executable not found in standard Program Files paths.');
}

function main() {
  const chromePath = findChrome();
  fs.mkdirSync(profileDir, { recursive: true });

  const chromeArgs = [
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-session-crashed-bubble',
    '--new-window',
    '--window-size=1280,860',
    EXT_DETAILS_URL,
    CWS_URL,
  ];

  console.log('=== DingBili · Real Windows Chrome + Tampermonkey Isolated Setup ===');
  console.log(`Chrome executable : ${chromePath}`);
  console.log(`Isolated profile  : ${profileDir} (zero personal data / cookies / credentials)`);
  console.log('');
  console.log('Please complete the following 3 manual steps in the opened Chrome window:');
  console.log('  1. On the Tampermonkey Chrome Web Store tab, click "Add to Chrome" / "添加至 Chrome".');
  console.log(`  2. Switch to tab "${EXT_DETAILS_URL}" (refresh if blank) and toggle ON "Allow User Scripts" / "允许用户脚本".`);
  console.log('  3. Close the Chrome window completely so settings flush to disk, then run: npm.cmd run test:tm:chrome');
  console.log('');

  if (process.platform === 'win32') {
    const psScript = [
      '$rawArgs = $env:DINGBILI_CHROME_ARGS_JSON | ConvertFrom-Json',
      '$quoted = @($rawArgs | ForEach-Object { if ($_ -match "\\s") { "`"$_`"" } else { "$_" } })',
      'Start-Process -FilePath $env:DINGBILI_CHROME -ArgumentList $quoted -WindowStyle Normal -Wait',
    ].join('; ');

    console.log('[setup:tm:chrome] Launching Windows Chrome with -WindowStyle Normal -Wait...');
    execFileSync('powershell.exe', ['-NoProfile', '-Command', psScript], {
      env: {
        ...process.env,
        DINGBILI_CHROME: chromePath,
        DINGBILI_CHROME_ARGS_JSON: JSON.stringify(chromeArgs),
      },
      stdio: 'inherit',
    });
    console.log('[setup:tm:chrome] Chrome exited cleanly. Ready for: npm.cmd run test:tm:chrome');
    return;
  }

  const child = spawn(chromePath, chromeArgs, {
    stdio: 'ignore',
    detached: true,
  });
  child.unref();
  console.log(`[setup:tm:chrome] Launched Chrome PID=${child.pid ?? 'unknown'}.`);
}

main();
