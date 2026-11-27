import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APPROVED_GRANTS,
  APPROVED_MATCHES,
  UPSTREAM_PROVENANCE,
  USERSCRIPT_METADATA,
} from '../src/userscript/metadata.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').toUpperCase();
}

function copyBuildInputs(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const rel of ['package.json', 'package-lock.json', 'LICENSE']) {
    fs.copyFileSync(path.join(rootDir, rel), path.join(targetDir, rel));
  }
  for (const dir of ['src', 'scripts']) {
    fs.cpSync(path.join(rootDir, dir), path.join(targetDir, dir), { recursive: true });
  }
}

function runNpm(args, cwd) {
  if (process.platform === 'win32') {
    return execFileSync('cmd.exe', ['/d', '/s', '/c', 'npm.cmd', ...args], { cwd, encoding: 'utf8' });
  }
  return execFileSync(npmCmd, args, { cwd, encoding: 'utf8' });
}

function runCleanBuild(label, workDir) {
  copyBuildInputs(workDir);
  const ciOutput = runNpm(['ci', '--prefer-offline', '--no-audit', '--no-fund'], workDir);
  const buildOutput = runNpm(['run', 'build'], workDir);
  const distDir = path.join(workDir, 'dist');
  const distEntries = fs.readdirSync(distDir);
  assert.deepEqual(distEntries, ['DingBili.user.js'], `${label}: dist/ must contain only DingBili.user.js`);
  const outFile = path.join(distDir, 'DingBili.user.js');
  const bytes = fs.statSync(outFile).size;
  const sha256 = sha256File(outFile);
  const text = fs.readFileSync(outFile, 'utf8');
  return { label, outFile, bytes, sha256, text, ciOutput, buildOutput };
}

function parseUserscriptHeader(source) {
  assert.ok(source.startsWith('// ==UserScript==\n'), 'File must start with // ==UserScript== at line 1');
  const endIdx = source.indexOf('\n// ==/UserScript==\n');
  assert.ok(endIdx > 0, 'File must contain closing // ==/UserScript==');
  const headerBlock = source.slice(0, endIdx + '\n// ==/UserScript=='.length);
  const entries = new Map();
  for (const line of headerBlock.split('\n')) {
    const m = line.match(/^\/\/\s+@([\w-]+)(?:\s+(.*))?$/);
    if (!m) continue;
    const key = m[1];
    const val = (m[2] ?? '').trim();
    if (!entries.has(key)) entries.set(key, []);
    entries.get(key).push(val);
  }
  return { headerBlock, entries };
}

function main() {
  const workspaceDist = path.join(rootDir, 'dist', 'DingBili.user.js');
  assert.ok(fs.existsSync(workspaceDist), 'Run npm run build before verify:repro');
  const workspaceDistEntries = fs.readdirSync(path.join(rootDir, 'dist'));
  assert.deepEqual(workspaceDistEntries, ['DingBili.user.js'], 'Workspace dist/ must contain only DingBili.user.js');
  const workspaceSha = sha256File(workspaceDist);

  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'dingbili-repro-'));
  const dirA = path.join(tmpBase, 'clean-build-a');
  const dirB = path.join(tmpBase, 'clean-build-b');

  try {
    const buildA = runCleanBuild('clean-build-a', dirA);
    const buildB = runCleanBuild('clean-build-b', dirB);

    assert.equal(buildA.sha256, buildB.sha256, 'Two clean builds must produce identical SHA-256');
    assert.equal(buildA.bytes, buildB.bytes, 'Two clean builds must produce identical byte length');
    assert.equal(buildA.sha256, workspaceSha, 'Workspace dist/DingBili.user.js must match clean build SHA-256');

    const { entries } = parseUserscriptHeader(buildA.text);
    assert.deepEqual(entries.get('name'), [USERSCRIPT_METADATA.name]);
    assert.deepEqual(entries.get('version'), [USERSCRIPT_METADATA.version]);
    assert.deepEqual(entries.get('match'), [...APPROVED_MATCHES]);
    assert.deepEqual(entries.get('grant'), [...APPROVED_GRANTS]);
    assert.deepEqual(entries.get('run-at'), ['document-start']);
    assert.deepEqual(entries.get('noframes'), ['']);
    assert.deepEqual(entries.get('license'), ['MIT']);
    assert.equal(entries.has('require'), false, 'No @require external runtime scripts allowed');
    assert.equal(entries.has('resource'), false, 'No @resource external runtime dependencies allowed');
    assert.equal(entries.has('connect'), false, 'No @connect external network grants allowed');

    assert.ok(buildA.text.includes('The MIT License (MIT)'), 'Full MIT license title missing');
    assert.ok(buildA.text.includes(UPSTREAM_PROVENANCE.ancestorCopyright), 'Original copyright notice missing');
    assert.ok(buildA.text.includes(UPSTREAM_PROVENANCE.ancestorCommit), 'Ancestor commit missing');
    assert.ok(buildA.text.includes(UPSTREAM_PROVENANCE.directUpstreamCommit), 'Direct upstream commit missing');
    assert.ok(buildA.text.includes('Jack-Cherish/BiliShu'), 'Direct upstream attribution missing');
    assert.ok(
      buildA.text.includes('Permission is hereby granted, free of charge'),
      'MIT license body missing',
    );

    const upstreamSnapshot = path.join(rootDir, 'P0-audit', 'upstream', 'bilishu.user.js');
    if (fs.existsSync(upstreamSnapshot)) {
      const upstreamSha = sha256File(upstreamSnapshot);
      assert.equal(
        upstreamSha,
        UPSTREAM_PROVENANCE.directUpstreamSha256,
        'Read-only upstream snapshot SHA-256 drift detected',
      );
    }

    console.log(
      JSON.stringify(
        {
          status: 'PASS',
          version: USERSCRIPT_METADATA.version,
          bytes: buildA.bytes,
          buildASha256: buildA.sha256,
          buildBSha256: buildB.sha256,
          workspaceSha256: workspaceSha,
          upstreamSnapshotVerified: fs.existsSync(upstreamSnapshot),
        },
        null,
        2,
      ),
    );
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
}

main();
