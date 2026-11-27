import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CARD,
  CHANNELS,
  COLLEAGUES,
  DEFAULT_SKIN_ID,
  PINNED,
  SKIN_ORDER,
  SKINS,
} from '../../src/baseline/config.js';
import {
  channelFromPath,
  escapeHtml,
  extractTweet,
  formatCount,
  parseCountValue,
  routeKind,
  safeImage,
  seasonId,
  stripText,
  videoId,
} from '../../src/baseline/parsers.js';

describe('P1-01 baseline config & parser checks (DM1-DM3, M1)', () => {
  it('PB-03 / DM1: preserves 21 channels, channel route matching, and bangumi ep parsing', () => {
    assert.equal(CHANNELS.length, 21);
    assert.equal(PINNED.length, 22);
    assert.equal(channelFromPath('/c/dance')?.id, 'channel:dance');
    assert.equal(channelFromPath('/c/music/')?.id, 'channel:music');
    assert.equal(routeKind('/c/dance', 'www.bilibili.com'), 'channel');
    assert.equal(routeKind('/bangumi/play/ep123', 'www.bilibili.com'), 'other');
    assert.equal(routeKind('/video/BV1ab1234567/', 'www.bilibili.com'), 'note');
    assert.equal(routeKind('/all', 'search.bilibili.com'), 'search');
    assert.equal(routeKind('/', 'www.bilibili.com'), 'explore');
    assert.equal(seasonId('https://www.bilibili.com/bangumi/play/ep123'), 'ep123');
    assert.equal(seasonId('https://www.bilibili.com/bangumi/play/ss999'), 'ss999');
    assert.equal(seasonId('https://www.bilibili.com/bangumi/media/md777'), 'md777');
    assert.equal(seasonId('https://evil.example/bangumi/play/ep123'), '');
  });

  it('M1 / PB-01 / KF-03: verifies three themes, nav counts, 16 colleagues, and known default skin gap', () => {
    assert.deepEqual(SKIN_ORDER, ['dingtalk', 'feishu', 'wecom']);
    assert.equal(COLLEAGUES.length, 16);
    assert.equal(CARD, '.bili-video-card, .video-card, .video-card-reco, .video-page-card-small, .rank-item');

    const navStats = (skinId) => {
      const s = SKINS[skinId];
      const items = [...(s.real || []), ...(s.deco || [])];
      const withPath = items.filter((it) => Boolean(it.path));
      const uniquePaths = new Set(withPath.map((it) => it.path));
      return { total: items.length, withPath: withPath.length, unique: uniquePaths.size };
    };
    assert.deepEqual(navStats('dingtalk'), { total: 9, withPath: 2, unique: 1 });
    assert.deepEqual(navStats('feishu'), { total: 8, withPath: 2, unique: 1 });
    assert.deepEqual(navStats('wecom'), { total: 7, withPath: 2, unique: 1 });

    // KF-03 KNOWN FAILURE BASELINE (to be fixed in P1-03): upstream default is still feishu
    assert.equal(DEFAULT_SKIN_ID, 'feishu');
  });

  it('DM2 & KF-05: extracts normal card fields and reproduces known ?p=2&t=23 stripping baseline', () => {
    const link = {
      href: 'https://www.bilibili.com/video/BV1234567890/?p=2&t=23',
      textContent: '测试视频标题',
      getAttribute: (k) => (k === 'title' ? '测试视频标题' : null),
    };
    const img = {
      currentSrc: '',
      getAttribute: (k) => (k === 'src' ? 'https://i0.hdslb.com/bfs/archive/a.jpg@240w' : null),
    };
    const mockArticle = {
      id: '',
      matches: () => false,
      querySelector(sel) {
        if (sel.includes('h3 a[href]')) return link;
        if (sel.includes('.bili-video-card__info--tit')) return link;
        if (sel.includes('space.bilibili.com')) {
          return { href: 'https://space.bilibili.com/98765', textContent: '测试者' };
        }
        if (sel.includes('img')) return img;
        if (sel === '.bili-video-card__stats--text') return { textContent: '1.2万' };
        if (sel === '.bili-video-card__author') return { textContent: '测试者 · 昨天' };
        return null;
      },
      querySelectorAll(sel) {
        if (sel === 'a[href]') return [link];
        return [];
      },
    };

    const parsed = extractTweet(mockArticle);
    assert.ok(parsed);
    assert.equal(parsed.id, 'BV1234567890');
    assert.equal(parsed.text, '测试视频标题');
    assert.equal(parsed.name, '测试者');
    assert.equal(parsed.time, '昨天');
    assert.equal(parsed.handle, '98765');
    assert.equal(parsed.viewCount, '1.2万');
    assert.equal(parsed.replyCount, '');
    assert.equal(parsed.video.poster, 'https://i0.hdslb.com/bfs/archive/a.jpg');

    // KF-05 KNOWN FAILURE BASELINE (to be fixed in P1-04): query params ?p=2&t=23 are stripped
    assert.equal(parsed.href, 'https://www.bilibili.com/video/BV1234567890/');
    assert.equal(parsed.href.includes('p=2'), false);
    assert.equal(parsed.href.includes('t=23'), false);
  });

  it('DM3 & KF-04: confirms CHANNELS.path is already absolute HTTPS URL (root cause of search group double-prefix)', () => {
    const music = CHANNELS.find((c) => c.id === 'channel:music');
    assert.ok(music);
    assert.equal(music.path, 'https://www.bilibili.com/c/music/');
    // Reproduces upstream L8893 bug expression: "https://www.bilibili.com" + c.path
    const upstreamBuggyHref = 'https://www.bilibili.com' + music.path;
    const parsedUrl = new URL(upstreamBuggyHref);
    assert.equal(parsedUrl.hostname, 'www.bilibili.comhttps');
  });

  it('verifies security and formatting helpers', () => {
    assert.equal(escapeHtml('<script>"a&b\'</script>'), '&lt;script&gt;&quot;a&amp;b&#39;&lt;/script&gt;');
    assert.equal(stripText('  hello\n\t world  '), 'hello world');
    assert.equal(parseCountValue('1.2万'), 12000);
    assert.equal(parseCountValue('2.5k'), 2500);
    assert.equal(parseCountValue('1,234'), 1234);
    assert.equal(formatCount(12000), '1.2万');
    assert.equal(formatCount(1234), '1,234');
    assert.equal(formatCount(0), '');

    assert.equal(videoId('https://www.bilibili.com/video/BV1ab1234567/?p=2'), 'BV1ab1234567');
    assert.equal(videoId('https://www.bilibili.com/video/av12345'), 'av12345');
    assert.equal(videoId('http://www.bilibili.com/video/BV1ab1234567/'), '');
    assert.equal(videoId('https://evil.com/video/BV1ab1234567/'), '');
    assert.equal(videoId('javascript:alert(1)'), '');

    assert.equal(safeImage('https://i0.hdslb.com/bfs/test.jpg@320w'), 'https://i0.hdslb.com/bfs/test.jpg');
    assert.equal(safeImage('javascript:alert(1)'), '');
    assert.equal(safeImage('http://i0.hdslb.com/bfs/test.jpg'), '');
  });
});
