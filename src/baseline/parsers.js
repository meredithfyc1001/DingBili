// Extracted pure utilities and parsers from BiliShu 0.6.1 (da8b9722a778c94440e826a02559c8da3692b546)
// Preserves exact P1-01 baseline behavior (including known gaps documented in baseline/BASELINE_BEHAVIOR.md).
import { CHANNELS } from "./config.js";

export function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
export function stripText(s) {
  return String(s == null ? "" : s).replace(/\s+/g, " ").trim();
}
export function hashStr(s) {
  let h = 0;
  const str = String(s || "");
  for (let i = 0; i < str.length; i++) h = h * 31 + str.charCodeAt(i) | 0;
  return Math.abs(h);
}
export function parseCountValue(str) {
  if (!str) return 0;
  const s = String(str).trim();
  if (!s) return 0;
  if (s.endsWith("万")) {
    const v = parseFloat(s.slice(0, -1));
    return Number.isNaN(v) ? 0 : Math.round(v * 1e4);
  }
  if (/k$/i.test(s)) {
    const v = parseFloat(s.slice(0, -1));
    return Number.isNaN(v) ? 0 : Math.round(v * 1e3);
  }
  if (/m$/i.test(s)) {
    const v = parseFloat(s.slice(0, -1));
    return Number.isNaN(v) ? 0 : Math.round(v * 1e6);
  }
  const clean = s.replace(/,/g, "");
  const n = parseInt(clean, 10);
  return Number.isNaN(n) ? 0 : n;
}
export function formatCount(num) {
  if (num === null || num === void 0 || num === "") return "";
  const n = typeof num === "number" ? num : parseInt(String(num).replace(/,/g, ""), 10);
  if (Number.isNaN(n) || n <= 0) return "";
  if (n >= 1e4) return (n / 1e4).toFixed(1).replace(/\.0$/, "") + "万";
  if (n >= 1e3) return n.toLocaleString("en-US");
  return String(n);
}

export function channelFromPath(pathname = typeof location !== "undefined" ? location.pathname : "") {
  const path = String(pathname || "").replace(/\/+$/, "");
  return CHANNELS.find((c) => c.pathname.replace(/\/+$/, "") === path) || null;
}

export function routeKind(
  pathname = typeof location !== "undefined" ? location.pathname : "",
  hostname = typeof location !== "undefined" ? location.hostname : ""
) {
  if (/^\/video\/(BV[0-9A-Za-z]{10}|av\d+)(\/|$)/.test(pathname)) return "note";
  if (hostname === "search.bilibili.com" || pathname === "/all") return "search";
  if (channelFromPath(pathname)) return "channel";
  if (pathname === "/" || pathname.startsWith("/v/popular")) return "explore";
  return "other";
}

export function seasonId(href) {
  var _a;
  try {
    const u = new URL(href, "https://www.bilibili.com");
    if (u.hostname !== "www.bilibili.com" || u.protocol !== "https:") return "";
    return ((_a = u.pathname.match(/^\/bangumi\/(?:play\/(ss\d+|ep\d+)|media\/(md\d+))\/?$/)) == null ? void 0 : _a.slice(1).find(Boolean)) || "";
  } catch {
    return "";
  }
}

export const text = (root, selector) => {
  var _a, _b;
  return ((_b = (_a = root == null ? void 0 : root.querySelector(selector)) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || "";
};

export function videoId(href) {
  var _a;
  try {
    const u = new URL(href, "https://www.bilibili.com");
    if (u.hostname !== "www.bilibili.com" || u.protocol !== "https:") return "";
    return ((_a = u.pathname.match(/^\/video\/(BV[0-9A-Za-z]{10}|av\d+)(?:\/|$)/)) == null ? void 0 : _a[1]) || "";
  } catch {
    return "";
  }
}

export function safeImage(src) {
  if (!src) return "";
  try {
    const u = new URL(src, "https://www.bilibili.com");
    if (/(^|\.)hdslb\.com$/.test(u.hostname)) u.pathname = u.pathname.split("@")[0];
    return u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
}

export function extractTweet(article, { getCurrentVideo, getSeasonCardData } = {}) {
  var _a, _b, _c, _d, _e;
  if (!article) return null;
  if (article.id === "viewbox_report") return getCurrentVideo ? getCurrentVideo() : null;
  if (typeof article.matches === "function" && article.matches('a[href*="/bangumi/"]')) {
    return getSeasonCardData ? getSeasonCardData(article) : null;
  }
    const a = article.querySelector("h3 a[href], a.title[href], .info a[href]") || [...article.querySelectorAll("a[href]")].find((a2) => videoId(a2.href));
    const id = videoId(a == null ? void 0 : a.href);
    if (!id) return null;
    const titleNode = article.querySelector("h3, .title, .bili-video-card__info--tit, .bili-video-card__title, .video-name");
    const title = ((_a = titleNode == null ? void 0 : titleNode.getAttribute("title")) == null ? void 0 : _a.trim()) || ((_b = titleNode == null ? void 0 : titleNode.textContent) == null ? void 0 : _b.trim()) || a.getAttribute("title") || a.textContent.trim();
    if (!title) return null;
    const profile = ((_c = article.querySelector('a[href*="space.bilibili.com"]')) == null ? void 0 : _c.href) || "";
    const img = article.querySelector(".bili-video-card__cover img, .picture img, .pic img, img");
    const stat = article.querySelector(".bili-video-card__stats--text");
    const channelAuthor = text(article, ".bili-video-card__author");
    const channelDate = channelAuthor.match(/^(.*?)\s*·\s*(\d{2}-\d{2}|\d{4}-\d{2}-\d{2}|\d+小时前|\d+分钟前|昨天|刚刚)$/);
    return {
      id,
      href: `https://www.bilibili.com/video/${id}/`,
      text: title,
      name: (channelDate == null ? void 0 : channelDate[1].trim()) || text(article, ".bili-video-card__info--author, .bili-video-card__author, .upname, .up-name, .name") || ((_d = article.querySelector('a[href*="space.bilibili.com"]')) == null ? void 0 : _d.textContent.trim()) || "UP主",
      handle: ((_e = profile.match(/\/([0-9]+)(?:\/|$)/)) == null ? void 0 : _e[1]) || "",
      profileHref: profile,
      avatar: "",
      photos: [],
      time: (channelDate == null ? void 0 : channelDate[2]) || text(article, ".bili-video-card__info--date").replace(/^·\s*/, ""),
      video: { hasVideo: true, poster: safeImage((img == null ? void 0 : img.currentSrc) || (img == null ? void 0 : img.getAttribute("src")) || (img == null ? void 0 : img.getAttribute("data-src")) || "") },
      viewCount: (stat == null ? void 0 : stat.textContent.trim()) || text(article, ".bili-cover-card__stat span, .playinfo .play, .play, .play-text"),
      replyCount: ""
    };
}
