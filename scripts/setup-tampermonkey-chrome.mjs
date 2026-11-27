import { spawn } from 'node:child_process';
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

  console.log('=== DingBili · Real Windows Chrome + Tampermonkey Isolated Setup ===');
  console.log(`Chrome executable : ${chromePath}`);
  console.log(`Isolated profile  : ${profileDir} (zero personal data / cookies / credentials)`);
  console.log('');
  console.log('Please complete the following 3 manual steps in the opened Chrome window:');
  console.log('  1. On the Tampermonkey Chrome Web Store tab, click "Add to Chrome" / "添加至 Chrome".');
  console.log(`  2. Switch to tab "${EXT_DETAILS_URL}" (refresh if blank) and toggle ON "Allow User Scripts" / "允许用户脚本".`);
  console.log('  3. Close the Chrome window completely so settings flush to disk, then run: npm.cmd run test:tm:chrome');
  console.log('');

  const child = spawn(
    chromePath,
    [
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      CWS_URL,
      EXT_DETAILS_URL,
    ],
    {
      stdio: 'ignore',
      detached: false,
    },
  );

  child.on('exit', (code) => {
    console.log(`[setup:tm:chrome] Chrome exited with code ${code ?? 0}. Ready for: npm.cmd run test:tm:chrome`);
  });
}

main();
