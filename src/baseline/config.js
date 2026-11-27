// Extracted pure configuration and constants from BiliShu 0.6.1 (da8b9722a778c94440e826a02559c8da3692b546)
// Frozen for P1-01 behavioral baseline; downstream P1 stages replace/refactor these cleanly.

export const COLLEAGUES = [
  {
    "id": "fake:0",
    "name": "产品需求评审",
    "preview": "李磊：OK，我这边明天出初稿。",
    "time": "09:32",
    "author": "李磊",
    "text": "OK，我这边明天出初稿。"
  },
  {
    "id": "fake:1",
    "name": "前端样式对齐",
    "preview": "王芳：收到，已同步测试同学。",
    "time": "昨天",
    "author": "王芳",
    "text": "收到，已同步测试同学。"
  },
  {
    "id": "fake:2",
    "name": "线上问题排查",
    "preview": "张伟：问题已定位，等修复上线。",
    "time": "昨天",
    "author": "张伟",
    "text": "问题已定位，等修复上线。"
  },
  {
    "id": "fake:3",
    "name": "早会纪要",
    "preview": "系统：3 条新消息已折叠",
    "time": "周一",
    "author": "系统",
    "text": "3 条新消息已折叠"
  },
  {
    "id": "fake:4",
    "name": "排期表同步",
    "preview": "赵敏：[链接] 排期表 v2.3",
    "time": "上周",
    "author": "赵敏",
    "text": "[链接] 排期表 v2.3"
  },
  {
    "id": "fake:5",
    "name": "灰度发布值班",
    "preview": "陈静：@所有人 下午三点对齐",
    "time": "09:12",
    "author": "陈静",
    "text": "@所有人 下午三点对齐"
  },
  {
    "id": "fake:6",
    "name": "回归范围确认",
    "preview": "刘洋：灰度比例先调到 10%",
    "time": "08:45",
    "author": "刘洋",
    "text": "灰度比例先调到 10%"
  },
  {
    "id": "fake:7",
    "name": "设计走查",
    "preview": "孙悦：图片 2 张",
    "time": "周日",
    "author": "孙悦",
    "text": "图片 2 张"
  },
  {
    "id": "fake:8",
    "name": "踩坑备忘录",
    "preview": "周杰：这个坑我踩过，别走老路",
    "time": "周六",
    "author": "周杰",
    "text": "这个坑我踩过，别走老路"
  },
  {
    "id": "fake:9",
    "name": "文档更新中心",
    "preview": "吴迪：文档已更新",
    "time": "周五",
    "author": "吴迪",
    "text": "文档已更新"
  },
  {
    "id": "fake:10",
    "name": "发版窗口确认",
    "preview": "郑爽：明天发版窗口确认一下",
    "time": "周四",
    "author": "郑爽",
    "text": "明天发版窗口确认一下"
  },
  {
    "id": "fake:11",
    "name": "故障复盘",
    "preview": "冯刚：告警已恢复，复盘跟进中",
    "time": "周三",
    "author": "冯刚",
    "text": "告警已恢复，复盘跟进中"
  },
  {
    "id": "fake:12",
    "name": "方案选型",
    "preview": "何娟：方案 B 整体成本更低",
    "time": "周二",
    "author": "何娟",
    "text": "方案 B 整体成本更低"
  },
  {
    "id": "fake:13",
    "name": "测试用例补充",
    "preview": "罗强：测试用例已补完，可回归",
    "time": "10:03",
    "author": "罗强",
    "text": "测试用例已补完，可回归"
  },
  {
    "id": "fake:14",
    "name": "Merge 合并",
    "preview": "林琳：PR 已合并，主干绿了",
    "time": "周一",
    "author": "林琳",
    "text": "PR 已合并，主干绿了"
  },
  {
    "id": "fake:15",
    "name": "需求回溯",
    "preview": "许峰：回溯会安排在下周一",
    "time": "上周五",
    "author": "许峰",
    "text": "回溯会安排在下周一"
  }
];

export const CHANNEL_ENTRIES = [
  ["anime", "番剧", "/anime/"],
  ["guochuang", "国创", "/guochuang/"],
  ["variety", "综艺", "/variety/"],
  ["douga", "动画", "/c/douga/"],
  ["kichiku", "鬼畜", "/c/kichiku/"],
  ["dance", "舞蹈", "/c/dance/"],
  ["ent", "娱乐", "/c/ent/"],
  ["tech", "科技数码", "/c/tech/"],
  ["food", "美食", "/c/food/"],
  ["car", "汽车", "/c/car/"],
  ["sports", "体育运动", "/c/sports/"],
  ["movie", "电影", "/movie/"],
  ["tv", "电视剧", "/tv/"],
  ["documentary", "纪录片", "/documentary/"],
  ["game", "游戏", "/c/game/"],
  ["music", "音乐", "/c/music/"],
  ["cinephile", "影视", "/c/cinephile/"],
  ["knowledge", "知识", "/c/knowledge/"],
  ["information", "资讯", "/c/information/"],
  ["shortplay", "小剧场", "/c/shortplay/"],
  ["fashion", "时尚美妆", "/c/fashion/"]
];

export const CHANNELS = CHANNEL_ENTRIES.map(([key, label, pathname]) => ({
  id: "channel:" + key,
  label,
  pathname,
  name: label + "交流群",
  path: "https://www.bilibili.com" + pathname,
  preview: label + "专区 · 视频推送",
  handle: label + "专区",
  tag: "群聊",
  bio: "B 站" + label + "专区推荐"
}));

export const ROOT_CLASS = "im-theme";
export const DARK_CLASS = "im-dark";
export const LOCK_CLASS = "im-skin-lock";
export const STYLE_ID = "bilishu-im-theme";
export const FAVICON_ID = "bilishu-favicon";
export const SKIN_KEY = "bilishu-im-skin";
export const VIEW_KEY = "bilishu-im-view";
export const COLOR_THEME_KEY = "bilishu-im-color-theme";
export const MASK_AVATAR_KEY = "bilishu-im-mask-avatar";
export const MASK_TITLE_KEY = "bilishu-im-mask-title";
export const CHAT_KEY = "bilishu-im-chat";
export const ORG_NAME_KEY = "bilishu-im-org-name";
export const HIDE_MEDIA_KEY = "bilishu-im-hide-media";
export const PINNED = [
  { id: "explore", name: "推荐流", handle: "For You", path: "https://www.bilibili.com/", tab: "explore", preview: "推荐信息流同步中", tag: "工作台", bio: "B 站推荐流，按 IM 会话展示。" },
  ...CHANNELS
];

export const SKIN_ORDER = ["dingtalk", "feishu", "wecom"];
export const RAIL_MSG = [{ key: "explore", label: "消息", icon: "msg", path: "https://www.bilibili.com/" }];
export const RAIL_XHS = [
  { key: "explore", label: "消息", icon: "msg", path: "https://www.bilibili.com/" }
];
export const STRIP_XHS = [];
export const XHS_SKINS = {
  dingtalk: {
    label: "钉钉",
    orgName: "工作台",
    letter: "钉",
    railWidth: 56,
    nav2Width: 0,
    stripWidth: 0,
    listWidth: 320,
    titlebarHeight: 40,
    railMin: 64,
    railMax: 200,
    listMin: 220,
    listMax: 460,
    chatHeadHeight: 56,
    composerHeight: 64,
    compact: true,
    actions: "titlebar",
    accent: "#1A87FF",
    real: RAIL_XHS,
    strip: [],
    deco: [
      { key: "doc", label: "文档", icon: "doc" },
      { key: "aitable", label: "AI表格", icon: "grid" },
      { key: "aimic", label: "AI听记", icon: "mic" },
      { key: "work", label: "工作台", icon: "work", path: "https://www.bilibili.com/" },
      { key: "book", label: "通讯录", icon: "book" },
      { key: "meet", label: "会议", icon: "meet" },
      { key: "cal", label: "日历", icon: "cal" },
      { key: "todo", label: "待办", icon: "todo" }
    ],
    colors: {
      light: {
        accent: "#1A87FF",
        accentSoft: "#E8F3FF",
        railBg: "linear-gradient(180deg,#D5E0F8 0%,#DCE4F9 100%)",
        titlebarBg: "linear-gradient(90deg,#D5E0F8 0%,#DCE4F9 100%)",
        page: "#F5F7FB",
        card: "#FFFFFF",
        listBg: "#F5F7FB",
        chatBg: "#F5F7FB",
        line: "#E6E8EB",
        text: "#1A1D24",
        text2: "#4A4F5C",
        text3: "#8A8F99",
        hover: "#ECF0F7",
        active: "#E4EAF5",
        bubbleOther: "#FFFFFF",
        bubbleMe: "#D4E5FF",
        danger: "#FF4D4F",
        chipBg: "#E7EAF1"
      },
      dark: {
        accent: "#4AA0FF",
        accentSoft: "#1B2A4A",
        railBg: "#1C2433",
        titlebarBg: "#1C2433",
        page: "#12161D",
        card: "#1C2433",
        listBg: "#161C27",
        chatBg: "#12161D",
        line: "#2A3344",
        text: "#E8EDF5",
        text2: "#A8B3C4",
        text3: "#8B97A8",
        hover: "#222B3A",
        active: "#1E334F",
        bubbleOther: "#1C2433",
        bubbleMe: "#1A3A66",
        danger: "#FF4D4F",
        chipBg: "#2A3344"
      }
    }
  },
  feishu: {
    label: "飞书",
    orgName: "工作台",
    letter: "飞",
    railWidth: 230,
    nav2Width: 0,
    stripWidth: 48,
    listWidth: 360,
    titlebarHeight: 0,
    railMin: 180,
    railMax: 480,
    listMin: 280,
    listMax: 640,
    chatHeadHeight: 94,
    composerHeight: 108,
    compact: false,
    actions: "rail-bottom",
    accent: "#3370FF",
    real: RAIL_MSG,
    strip: STRIP_XHS,
    deco: [
      { key: "calendar", label: "日历", icon: "cal" },
      { key: "worktable", label: "工作台", icon: "work", path: "https://www.bilibili.com/" },
      { key: "cloud", label: "云文档", icon: "doc" },
      { key: "wiki", label: "知识库", icon: "wiki" },
      { key: "task", label: "任务", icon: "todo" },
      { key: "contacts", label: "联系人", icon: "user" },
      { key: "project", label: "项目", icon: "grid" }
    ],
    colors: {
      light: {
        accent: "#3370FF",
        accentSoft: "#E8F0FF",
        railBg: "#D2E0F1",
        titlebarBg: "#D2E0F1",
        page: "#FFFFFF",
        card: "#FFFFFF",
        listBg: "#FFFFFF",
        chatBg: "#FFFFFF",
        line: "#E8E9EB",
        text: "#1F2329",
        text2: "#646A73",
        text3: "#8F959E",
        hover: "#F5F6F7",
        active: "#E4EDFB",
        bubbleOther: "#EEEFEE",
        bubbleMe: "#E8F0FF",
        danger: "#F54840",
        chipBg: "#F0F2F5"
      },
      dark: {
        accent: "#4C83FF",
        accentSoft: "#1B2A4A",
        railBg: "#1F2329",
        titlebarBg: "#1F2329",
        page: "#17181A",
        card: "#2B2F36",
        listBg: "#1B1F26",
        chatBg: "#17181A",
        line: "#3A3F47",
        text: "#E8EAED",
        text2: "#C0C4CC",
        text3: "#8B919A",
        hover: "#2B2F36",
        active: "#223A63",
        bubbleOther: "#2B2F36",
        bubbleMe: "#1B2A4A",
        danger: "#F54840",
        chipBg: "#2A3140"
      }
    }
  },
  wecom: {
    label: "企业微信",
    orgName: "企业微信",
    letter: "企",
    railWidth: 162,
    nav2Width: 0,
    stripWidth: 0,
    listWidth: 320,
    titlebarHeight: 0,
    railMin: 100,
    railMax: 260,
    listMin: 240,
    listMax: 480,
    chatHeadHeight: 80,
    composerHeight: 72,
    compact: false,
    actions: "rail-bottom",
    accent: "#4389F5",
    groups: true,
    real: RAIL_XHS,
    strip: [],
    deco: [
      { key: "smartdoc", label: "智能文档", icon: "file", dot: true },
      { key: "summary", label: "智能总结", icon: "spark" },
      { key: "work", label: "工作台", icon: "work", path: "https://www.bilibili.com/" },
      { key: "book", label: "通讯录", icon: "book" },
      { key: "disk", label: "微盘", icon: "disk" },
      { key: "advanced", label: "高级功能", icon: "apps" }
    ],
    colors: {
      light: {
        accent: "#4389F5",
        accentSoft: "#DCEBFF",
        railBg: "#D6E4F4",
        titlebarBg: "#D6E4F4",
        page: "#F5F7FA",
        card: "#FFFFFF",
        listBg: "#FFFFFF",
        chatBg: "#F5F7FA",
        line: "#D9E0E9",
        text: "#172033",
        text2: "#526175",
        text3: "#8B98AA",
        hover: "#E7EEF8",
        active: "#CFE4FF",
        bubbleOther: "#E4E7EC",
        bubbleMe: "#BDE4FF",
        danger: "#FA5151",
        chipBg: "#E7EEF8"
      },
      dark: {
        accent: "#338CFF",
        accentSoft: "#1A2F4A",
        railBg: "#111111",
        titlebarBg: "#111111",
        page: "#111111",
        card: "#1C1C1C",
        listBg: "#1C1C1C",
        chatBg: "#111111",
        line: "#2C2C2C",
        text: "#EAEAEA",
        text2: "#B0B0B0",
        text3: "#8A8A8A",
        hover: "#222222",
        active: "#1A2F4A",
        bubbleOther: "#2A2A2A",
        bubbleMe: "#163A5C",
        danger: "#FA5151",
        chipBg: "#2C2C2C"
      }
    }
  }
};
export const SKINS = XHS_SKINS;
export const DEFAULT_SKIN_ID = "feishu";

export const CARD = ".bili-video-card, .video-card, .video-card-reco, .video-page-card-small, .rank-item";
