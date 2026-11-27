import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { LICENSE_BANNER, renderUserscriptHeader } from '../src/userscript/metadata.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const entryFile = path.join(rootDir, 'src', 'userscript', 'main.js');
const distDir = path.join(rootDir, 'dist');
const outFile = path.join(distDir, 'DingBili.user.js');

export async function buildUserscript({ cwd = rootDir, silent = false } = {}) {
  const localEntry = path.join(cwd, 'src', 'userscript', 'main.js');
  const localDistDir = path.join(cwd, 'dist');
  const localOutFile = path.join(localDistDir, 'DingBili.user.js');

  const result = await esbuild.build({
    entryPoints: [localEntry],
    absWorkingDir: cwd,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2022'],
    charset: 'utf8',
    minify: false,
    sourcemap: false,
    legalComments: 'none',
    write: false,
    logLevel: 'silent',
  });

  if (!result.outputFiles || result.outputFiles.length !== 1) {
    throw new Error(`Expected exactly 1 esbuild output file, got ${result.outputFiles?.length ?? 0}`);
  }

  const header = renderUserscriptHeader();
  const body = result.outputFiles[0].text.replace(/\r\n/g, '\n').trimEnd();
  const finalContent = `${header}\n\n${LICENSE_BANNER}\n\n${body}\n`;

  // Syntax check in-process via vm.Script (does not execute)
  new vm.Script(finalContent, { filename: 'DingBili.user.js' });

  // Clean distDir so ONLY DingBili.user.js is emitted
  fs.rmSync(localDistDir, { recursive: true, force: true });
  fs.mkdirSync(localDistDir, { recursive: true });
  fs.writeFileSync(localOutFile, finalContent, 'utf8');

  const buf = fs.readFileSync(localOutFile);
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
  const lines = finalContent.split('\n').length - 1;

  if (!silent) {
    console.log(`[build] wrote ${path.relative(cwd, localOutFile)}`);
    console.log(`[build] bytes=${buf.length} lines=${lines} sha256=${sha256}`);
  }

  return {
    outFile: localOutFile,
    bytes: buf.length,
    lines,
    sha256,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildUserscript().catch((err) => {
    console.error('[build] failed:', err);
    process.exitCode = 1;
  });
}
