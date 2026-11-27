export function buildPerfCardsHtml(count) {
  const cards = [];
  for (let i = 1; i <= count; i += 1) {
    const av = 100000 + i;
    cards.push(
      `<article class="bili-video-card" data-av="av${av}">` +
        `<h3><a href="https://www.bilibili.com/video/av${av}/" title="性能样本视频${i}">性能样本视频${i}</a></h3>` +
        `<a href="https://space.bilibili.com/${50000 + i}" class="bili-video-card__author">作者${i} · 昨天</a>` +
        `<span class="bili-video-card__stats--text">${i * 10}</span>` +
        `</article>`,
    );
  }
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>Perf Fixture (${count} cards)</title>
  <link rel="icon" id="orig-perf" href="data:,native-perf" />
</head>
<body>
  <main id="app">${cards.join('\n')}</main>
</body>
</html>`;
}
