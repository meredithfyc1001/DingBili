import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  APPROVED_GRANTS,
  APPROVED_MATCHES,
  UPSTREAM_PROVENANCE,
  USERSCRIPT_METADATA,
} from '../../src/userscript/metadata.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').toUpperCase();
}

function parseHeader(source) {
  assert.ok(source.startsWith('// ==UserScript==\n'), 'Must start with // ==UserScript== at line 1');
  const endMarker = '\n// ==/UserScript==\n';
  const endIdx = source.indexOf(endMarker);
  assert.ok(endIdx > 0, 'Must contain // ==/UserScript==');
  const block = source.slice(0, endIdx + endMarker.length);
  const map = new Map();
  for (const line of block.split('\n')) {
    const m = line.match(/^\/\/\s+@([\w-]+)(?:\s+(.*))?$/);
    if (!m) continue;
    const k = m[1];
    const v = (m[2] ?? '').trim();
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(v);
  }
  return map;
}

describe('P1-01 provenance, license, and userscript surface', () => {
  it('matches PROVENANCE.json and frozen read-only upstream snapshot', () => {
    const prov = JSON.parse(fs.readFileSync(path.join(rootDir, 'baseline', 'PROVENANCE.json'), 'utf8'));
    assert.equal(prov.directUpstream.commit, UPSTREAM_PROVENANCE.directUpstreamCommit);
    assert.equal(prov.directUpstream.version, UPSTREAM_PROVENANCE.directUpstreamVersion);
    assert.equal(prov.directUpstream.sha256, UPSTREAM_PROVENANCE.directUpstreamSha256);
    assert.equal(prov.ancestor.commit, UPSTREAM_PROVENANCE.ancestorCommit);
    assert.deepEqual(prov.approvedUserscriptSurface.match, [...APPROVED_MATCHES]);
    assert.deepEqual(prov.approvedUserscriptSurface.grant, [...APPROVED_GRANTS]);

    const upstreamDir = path.join(rootDir, 'P0-audit', 'upstream');
    const upstreamScript = path.join(upstreamDir, 'bilishu.user.js');
    if (fs.existsSync(upstreamScript)) {
      assert.equal(sha256(upstreamScript), UPSTREAM_PROVENANCE.directUpstreamSha256);
      assert.equal(fs.statSync(upstreamScript).size, UPSTREAM_PROVENANCE.directUpstreamBytes);
      const gitStatus = execFileSync('git', ['-C', upstreamDir, 'status', '--porcelain'], { encoding: 'utf8' }).trim();
      assert.equal(gitStatus, '', 'Read-only upstream snapshot must remain unmodified');
      const head = execFileSync('git', ['-C', upstreamDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      assert.equal(head, UPSTREAM_PROVENANCE.directUpstreamCommit);
    }
  });

  it('emits only dist/DingBili.user.js with exact approved header and full MIT license', () => {
    const distDir = path.join(rootDir, 'dist');
    const entries = fs.readdirSync(distDir);
    assert.deepEqual(entries, ['DingBili.user.js']);

    const distPath = path.join(distDir, 'DingBili.user.js');
    const src = fs.readFileSync(distPath, 'utf8');
    assert.equal(src.includes('\r\n'), false, 'Output must use deterministic LF line endings');

    const header = parseHeader(src);
    assert.deepEqual(header.get('name'), [USERSCRIPT_METADATA.name]);
    assert.deepEqual(header.get('namespace'), [USERSCRIPT_METADATA.namespace]);
    assert.deepEqual(header.get('version'), [USERSCRIPT_METADATA.version]);
    assert.deepEqual(header.get('match'), [...APPROVED_MATCHES]);
    assert.deepEqual(header.get('grant'), [...APPROVED_GRANTS]);
    assert.deepEqual(header.get('run-at'), ['document-start']);
    assert.deepEqual(header.get('noframes'), ['']);
    assert.deepEqual(header.get('license'), ['MIT']);
    assert.equal(header.has('require'), false);
    assert.equal(header.has('resource'), false);
    assert.equal(header.has('connect'), false);

    // License & provenance preservation
    assert.ok(src.includes('The MIT License (MIT)'));
    assert.ok(src.includes('Copyright (c) 2026 czm15053'));
    assert.ok(src.includes('Jack-Cherish/BiliShu'));
    assert.ok(src.includes('da8b9722a778c94440e826a02559c8da3692b546'));
    assert.ok(src.includes('88653fc24432f6dfc61b26d488afc74f05eb230c'));
    assert.ok(src.includes('Permission is hereby granted, free of charge'));

    // Zero runtime network API calls (preserve P0 static audit guarantee)
    assert.equal(/\bfetch\s*\(/.test(src), false, 'Must not introduce fetch() network calls');
    assert.equal(/\bXMLHttpRequest\b/.test(src), false, 'Must not introduce XMLHttpRequest calls');
    assert.equal(/\bGM_xmlhttpRequest\b/.test(src), false, 'Must not introduce GM_xmlhttpRequest calls');
  });

  it('tracks all frozen fixtures in tests/fixtures/MANIFEST.json', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'tests', 'fixtures', 'MANIFEST.json'), 'utf8'),
    );
    assert.ok(Array.isArray(manifest.fixtures) && manifest.fixtures.length >= 6);
    for (const item of manifest.fixtures) {
      const fullPath = path.join(rootDir, item.file);
      assert.ok(fs.existsSync(fullPath), `Fixture missing: ${item.file}`);
    }
  });
});
