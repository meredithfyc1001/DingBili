export const UPSTREAM_PROVENANCE = Object.freeze({
  directUpstreamRepo: 'https://github.com/Jack-Cherish/BiliShu',
  directUpstreamVersion: '0.6.1',
  directUpstreamCommit: 'da8b9722a778c94440e826a02559c8da3692b546',
  directUpstreamFile: 'bilishu.user.js',
  directUpstreamSha256: 'F4564526588ED6455ACFD2578357A5D2BADC388E3E7CF0FA97D43FED5613837E',
  directUpstreamBytes: 597474,
  directUpstreamLines: 11586,
  ancestorRepo: 'https://github.com/czm15053/linuxdo-idea-ui',
  ancestorCommit: '88653fc24432f6dfc61b26d488afc74f05eb230c',
  ancestorCopyright: 'Copyright (c) 2026 czm15053',
  license: 'MIT',
});

export const APPROVED_MATCHES = Object.freeze([
  'https://www.bilibili.com/*',
  'https://search.bilibili.com/*',
]);

export const APPROVED_GRANTS = Object.freeze(['none']);

export const USERSCRIPT_METADATA = Object.freeze({
  name: 'DingBili · B站钉钉皮肤',
  namespace: 'https://github.com/meredithfyc1001/DingBili',
  version: '0.1.0-p1.1',
  author: 'DingBili contributors (derived from Jack-Cherish/BiliShu 0.6.1 & czm15053/linuxdo-idea-ui)',
  description:
    '基于 Jack-Cherish/BiliShu (0.6.1) 二次开发的钉钉风格 B 站浏览器增强脚本，保留钉钉、飞书与企业微信三套主题及 B 站原生视频、搜索与评论能力。',
  match: APPROVED_MATCHES,
  grant: APPROVED_GRANTS,
  runAt: 'document-start',
  noframes: true,
  license: 'MIT',
});

export function renderUserscriptHeader(meta = USERSCRIPT_METADATA) {
  const lines = [
    '// ==UserScript==',
    `// @name         ${meta.name}`,
    `// @namespace    ${meta.namespace}`,
    `// @version      ${meta.version}`,
    `// @author       ${meta.author}`,
    `// @description  ${meta.description}`,
    ...meta.match.map((m) => `// @match        ${m}`),
    ...meta.grant.map((g) => `// @grant        ${g}`),
    `// @run-at       ${meta.runAt}`,
  ];
  if (meta.noframes) {
    lines.push('// @noframes');
  }
  lines.push(`// @license      ${meta.license}`);
  lines.push('// ==/UserScript==');
  return lines.join('\n');
}

export const LICENSE_BANNER = `/*! DingBili — DingTalk-style Bilibili Userscript
 * Project repository: https://github.com/meredithfyc1001/DingBili
 * Direct upstream: Jack-Cherish/BiliShu v${UPSTREAM_PROVENANCE.directUpstreamVersion} (commit ${UPSTREAM_PROVENANCE.directUpstreamCommit})
 * Original upstream: Derived from czm15053/linuxdo-idea-ui (xhs/ + x/ video styles)
 * Upstream commit: ${UPSTREAM_PROVENANCE.ancestorCommit}
 * DingBili changes: Modular single-file build pipeline, frozen baseline harness, and subsequent P1 architecture/bugfix iterations.
 *
The MIT License (MIT)

Copyright (c) 2026 czm15053
Copyright (c) 2026 Jack-Cherish/BiliShu contributors
Copyright (c) 2026 DingBili contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/`;
