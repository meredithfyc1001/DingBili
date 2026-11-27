# P1-01 验收与独立自审报告

- 阶段：`P1-01 冻结行为基线与单文件构建`
- 日期：2026-11-27（上海时间）
- 分支：`feat/p1-01-baseline-build`
- 候选构建产物：`dist/DingBili.user.js`
- 候选版本：`0.1.0-p1.1`
- 产物大小与行数：`598,782` 字节 / `11,670` 行（LF 行尾）
- 候选产物 SHA-256：`0C3F0ACC6E680B6DB10ADBF8BE8357DF2703F85B11904A986C0E763EBC1558A6`
- 固定上游参照：`Jack-Cherish/BiliShu@da8b9722a778c94440e826a02559c8da3692b546`（v0.6.1，SHA-256 `F4564526588ED6455ACFD2578357A5D2BADC388E3E7CF0FA97D43FED5613837E`）
- 测试环境：Windows 11 · Node.js `v24.22.1` · npm `11.19.1` · esbuild `0.28.2` · Playwright `1.65.1` · Chrome `158.0.8127.37` · Edge `158.0.4370.33`

---

## 一、A01 验收明细（按 P1_ACCEPTANCE.md 格式）

| 用例 ID | 候选文件 SHA-256 | 环境与数据代号 | F1–F4 子路径 | 输入与动作 | 预期 | 实测 | 证据编号 | 状态 |
|---|---|---|---|---|---|---|---|---|
| `A01.1-PROVENANCE` | `0C3F0ACC...1558A6` | Node 24.22.1 / `PROVENANCE.json` / 上游快照 | 不适用 | 校验上游 commit、文件字节、SHA-256 及 `P0-audit/upstream` git 工作区状态 | SHA-256 精确匹配 `F4564526...13837E`，上游只读快照 0 变更 | 字节 `597,474`、SHA-256 一致，`git status --porcelain` 为空 | `EV-P101-UNIT-01` | **PASS** |
| `A01.1-PARSERS` | `0C3F0ACC...1558A6` | Node 24.22.1 / `baseline-parsers.test.mjs` | 不适用 | 执行 `DM1`、`DM2`、`DM3`、`M1`、URL/转义安全断言 | 21 分区/番剧/三主题导航保留；`KF-03`/`KF-04`/`KF-05` 已知基线失败可稳定复现 | 单元测试 8/8 通过（`227ms`） | `EV-P101-UNIT-02` | **PASS** |
| `A01.1-E2E-CHROME` | `0C3F0ACC...1558A6` | Chrome `158.0.8127.37` / `FX-HOME`..`FX-PERF`（1440×900 & 900×800） | F1–F4 基线对照 | 回放 `T01`–`T07`、`KF-01`–`KF-12` 及上游 `bilishu.user.js` 行为对照 | 保留行为 `PB-01`–`PB-09` 全过；已知失败 `KF-01`–`KF-12` 全部可重跑复现；0 未捕获异常 | Chrome 9/9 E2E 通过，0 `pageerror` | `EV-P101-E2E-CR` | **PASS** |
| `A01.1-E2E-EDGE` | `0C3F0ACC...1558A6` | Edge `158.0.4370.33` / `FX-HOME`..`FX-PERF`（1440×900 & 900×800） | F1–F4 基线对照 | 回放 `T01`–`T07`、`KF-01`–`KF-12` 及上游 `bilishu.user.js` 行为对照 | 与 Chrome 基线一致，0 未捕获异常 | Edge 9/9 E2E 通过，0 `pageerror` | `EV-P101-E2E-ED` | **PASS** |
| `A01.2-REPRO-BUILD` | `0C3F0ACC...1558A6` | Windows 11 / Node 24.22.1 / 两份独立临时目录 | 不适用 | 在两个全新临时目录拷贝源码与 `package-lock.json`，分别执行 `npm ci` + `npm run build`，比较 `dist/` 目录、SHA-256、首部元数据与 MIT 许可 | `dist/` 仅含 `DingBili.user.js`；两次构建哈希与工作区产物完全一致；元数据与权限无扩张、MIT 完整、零外部依赖 | `buildA === buildB === workspace === 0C3F0ACC6E680B6DB10ADBF8BE8357DF2703F85B11904A986C0E763EBC1558A6`，`dist/` 仅 1 文件 | `EV-P101-REPRO` | **PASS** |
| `A01.2-LOAD-ISOLATION` | `0C3F0ACC...1558A6` | Chrome 158 & Edge 158 / `FX-IFRAME`、`FX-UNSUPPORTED`（Playwright `addInitScript` × 合成样本） | F1–F4 详见下表 | 打开顶层匹配页、内嵌匹配 iframe 页及未适配页 | 顶层页恰挂 1 套壳；iframe 内 0 套壳；未适配页 0 套壳且原生按钮可点击 | Chrome 与 Edge 均实测顶层 1 壳、iframe 0 壳、未适配页原生点击计数 = 1 | `EV-P101-LOAD` | **PASS** |
| `A01.2-REAL-MANAGER-SYNTHETIC` | `0C3F0ACC...1558A6` | Windows Chrome `158.0.8127.37` / 真实 Tampermonkey `5.5.1`（MV3，`dhdgffkkebhmkfjojejmpbldmpobfkfo`）× 合成样本 | F2/F4 停用复核 | 隔离配置开启“允许用户脚本”，从本地 HTTP 源触发 `ask.html` 弹窗安装 `dist/DingBili.user.js`，依次测主站、搜索子域、iframe、`/unsupported`、Dashboard 停用与重新启用 | 安装弹窗解析名/版本/匹配域；顶层与搜索各 1 壳；子 iframe 0 壳；停用后恢复 `Fixture Native`；重启用单壳，0 异常 | `injectionMode=real-tampermonkey-extension`；主站 `shells=1/msgCount=1`；搜索 `searchViews=1`；iframe `top=1/child=0`；停用后 `shells=0`、`title="Fixture Native"`、`favicon="data:,native"`、`nativeButtonClicks=1`、输入正常；重启用 `shells=1`；`pageErrors=[]`；留存截图 `01`–`07` 与 `evidence.json` | `EV-P101-TM-SYN` | **PASS** |
| `A01.2-REAL-MANAGER-LIVE` | `0C3F0ACC...1558A6` | Windows Chrome `158.0.8127.37` / 真实 Tampermonkey `5.5.1` × 匿名只读真实 B 站（拦截非 GET/HEAD 与登录请求） | 停用复核 | 在同一隔离配置启用状态下访问真实 `www.bilibili.com/` 与 `search.bilibili.com/all?keyword=音乐`；在 Dashboard 停用后重访真实 `www.bilibili.com/` | 主站与搜索成功注入且无壳重复；停用后真实 B 站原版页面与顶栏正常可用 | `www.bilibili.com`：`shells=1`、`msgCount=20`；`search.bilibili.com`：`searchViews=1`、`title="搜索 - 飞书"`；停用后：`shells=0`、`hasImTheme=false`、`title="哔哩哔哩 (゜-゜)つロ 干杯~-bilibili"`、`hasNativeHeader=true`（被屏蔽第三方请求之 `livePageErrors` 已单列）；留存截图 `08`–`10` | `EV-P101-TM-LIVE` | **PASS** |
| `A01.2-FIREFOX` | `0C3F0ACC...1558A6` | Windows 11 Firefox | 不适用 | Firefox 兼容复核 | 纳入 P1-08 兼容矩阵 | 本机未安装 Firefox（`C:\Program Files\Mozilla Firefox` 缺失），未执行 | `EV-P101-FF-NA` | **NOT TESTED** |

### F1–F4 基线状态记录（P1-01 冻结基线，由 P1-02 负责修复关闭）

| 路径 | P1-01 实测基线（Chrome 158 & Edge 158） | 备注 |
|---|---|---|
| **F1 同文档 SPA** | `pushState('/c/tech/')` 切换成功；`replaceState('/unsupported')` 撤壳后残留旧标题、原 favicon `#orig` 丢失、`im-dark`/`colorScheme=dark`/`--im-nav=56px`（复现 `KF-01`） | 作为 P1-02 退出恢复基线对照 |
| **F2 整页刷新** | 菜单切 `native` 重载后原生标题、favicon `#orig`、按钮交互正常，出现 `.xim-fab`；点 FAB 重载回 IM 仅挂 1 套壳；但模拟同事消息刷新后丢失（复现 `KF-10`） | 整页重载路径正常，持久化留 P1-06 |
| **F3 浏览器前进后退** | 支持页→未支持页后执行 `page.goBack()` 可重新挂载外壳（同文档历史）；跨文档 BFCache 命中分支待 P1-02 独立建档测试 | BFCache 分支当前记 `NOT TESTED` |
| **F4 冷启动** | 全新上下文直达 `/unsupported` 原生可交互；随后同文档 `pushState('/')` 无法挂载外壳（复现 `KF-02`）；空配置直达首页默认 `feishu`（复现 `KF-03`） | 作为 P1-02 / P1-03 改造基线对照 |

---

## 二、独立代码审查记录（Self-Review）

### 1. 架构一致性与模块边界
- 入口 `src/userscript/main.js`、元数据与许可单一数据源 `src/userscript/metadata.js`、提取的纯配置 `src/baseline/config.js`、纯解析器 `src/baseline/parsers.js` 与冻结运行时 `src/baseline/legacy-runtime.js` 职责清晰，无循环依赖。
- 构建完全脱离 `P0-audit/upstream/`，独立干净仓库可直接完成 `npm ci && npm run build`。

### 2. 安全、权限与许可证合规
- `@match` 严格限定为 `https://www.bilibili.com/*` 与 `https://search.bilibili.com/*`；`@grant none`、`@run-at document-start`、`@noframes`；无任何 `@require` / `@resource` / `@connect`。
- 静态测试确认产物不含 `fetch(`、`XMLHttpRequest`、`GM_xmlhttpRequest`；不接触用户登录凭据。
- `LICENSE` 与 `dist/DingBili.user.js` 首部完整保留 MIT 许可证正文、`Copyright (c) 2026 czm15053`、祖先提交 `88653fc24432f6dfc61b26d488afc74f05eb230c` 及 `Jack-Cherish/BiliShu` `0.6.1`（`da8b9722a778c94440e826a02559c8da3692b546`）来源说明。
- `P0-audit/upstream/` 位于 `.gitignore` 且未产生任何修改，未将上游权属未明的 `1.gif`/`2.gif`/`3.gif` 纳入 DingBili 分发包。

### 3. 自审发现并立即修复的问题
1. 初版单元测试引用了不存在的 `SKINS[id].rail.real`，已修正为 `SKINS[id].real` / `SKINS[id].deco` 并验证通过。
2. 初版 `scripts/verify-reproducible-build.mjs` 在 Node 24 下触发 `DEP0190`（`shell: true` + args），已改用 `cmd.exe /d /s /c npm.cmd` 消除告警。
3. 初版 E2E 的 `T05` 在 Chrome 158 无头模式下因离屏 Canvas `-9999px` 录制出 0 字节导致超时；已调整 Canvas 至视口内低透明层并补全 `srcObject` 安全回退，在 Chrome 与 Edge 均稳定在 ~1.5s 完成真实帧推进验证。
4. 初版 E2E 的 `T06` 命中了不可见的悬停按钮导致 strict mode / 超时；已精准定位行内可见 `.im-inline-reply[data-action="native-reply"]`。
5. 自审检查发现 `KF-09`（钉钉顶栏头像静态无响应）和 `KF-11 / DM4`（`expandAllComments` 滚页一次返回 0）缺少自动化断言，已补充进 `tests/e2e/p1-01-baseline.spec.mjs` 并在最终全量测试中通过。
6. **A01.2 真实用户脚本管理器（Tampermonkey）安装与验证闭环**：经隔离配置（`.cache/chrome-tampermonkey-profile`，`dhdgffkkebhmkfjojejmpbldmpobfkfo`，`v5.5.1`）由人工从 Chrome 应用商店完成安装并开启“允许用户脚本”授权；修复了测试驱动中 Playwright 默认 `--disable-extensions` 抑制扩展加载以及 Tampermonkey Dashboard 误选中批量复选框导致未点中 `tr.scripttr .enabler` 的问题。最终 `npm.cmd run test:tm:chrome` 在**真实 Tampermonkey 扩展注入**下对**合成样本**与**匿名只读真实 B 站**分别实测全部通过（`evidence.json` + 截图 `01`–`10`）。

---

## 三、阶段验收结论

- **结论**：**PASS（P1-01 全部必需验收项已达标）**。
- **已验证并分开登记的四类证据**：
  1. **静态与可复现构建**：`npm.cmd run test:unit` **8/8 PASS**，`npm.cmd run verify:repro` **PASS**（`dist/DingBili.user.js` SHA-256 `0C3F0ACC6E680B6DB10ADBF8BE8357DF2703F85B11904A986C0E763EBC1558A6`，上游只读快照无变更）。
  2. **Playwright `addInitScript` × 合成样本（Chrome 158 + Edge 158）**：**18/18 PASS**，锁定 `PB-01`–`PB-09` 保留行为与 `KF-01`–`KF-12` 已知基线失败。
  3. **真实 Tampermonkey `v5.5.1`（Windows Chrome 158）× 合成样本**：**PASS**（元数据安装弹窗、主站/搜索匹配、`@noframes` iframe、未适配路由、停用后原版可用、重启用单壳，0 异常）。
  4. **真实 Tampermonkey `v5.5.1`（Windows Chrome 158）× 匿名只读真实 B 站**：**PASS**（主站 20 条推荐注入、搜索视图注入、停用后原版 B 站完整可用）。
- **明确记录的未测范围**：`A01.2-FIREFOX`（本机未安装 Firefox，划归 P1-08 兼容矩阵）；`KF-01`–`KF-12` 仍作为已知上游缺陷保留基线记录，依依赖关系分别由 P1-02 至 P1-07 关闭。
- **下一步**：提交验收更新并推进 GitHub PR 创建、CI 核验与授权合并，随后启动 **P1-02（路由、生命周期与切回原版）**。
