# P1-02 验收与独立自审报告

- 阶段：`P1-02 路由、生命周期与切回原版`
- 日期：2026-11-27（上海时间）
- 分支：`feat/p1-02-routing-lifecycle`（基于 `feat/p1-01-baseline-build` 叠栈分支）
- 候选构建产物：`dist/DingBili.user.js`
- 候选版本：`0.1.0-p1.2`
- 产物大小与行数：`627,828` 字节 / `12,513` 行（LF 行尾）
- 候选产物 SHA-256：`CB74868A33F85178CE8FDF43457A0D0D2AC9E87D83C93A349A790E0B60FF263C`
- 固定上游参照：`Jack-Cherish/BiliShu@da8b9722a778c94440e826a02559c8da3692b546`（v0.6.1，`597,474` 字节，SHA-256 `F4564526588ED6455ACFD2578357A5D2BADC388E3E7CF0FA97D43FED5613837E`，只读无变更）
- 测试环境：Windows 11 · Node.js `v24.22.1` · npm `11.19.1` · esbuild `0.28.2` · Playwright `1.65.1` · Chrome `158.0.8127.37` · Edge `158.0.4370.33` · Tampermonkey `5.5.1`（MV3）

---

## 一、A02 验收明细（按 P1_ACCEPTANCE.md 格式）

| 用例 ID | 候选文件 SHA-256 | 环境与数据代号 | F1–F4 子路径 | 输入与动作 | 预期 | 实测 | 证据编号 | 状态 |
|---|---|---|---|---|---|---|---|---|
| `A02.1-ROUTING-GEN` | `CB74868A...263C` | Chrome `158.0.8127.37` & Edge `158.0.4370.33` / `FX-HOME`、`FX-VIDEO`、`FX-SEARCH`、`FX-UNSUPPORTED` + `Late Host` | F1 / F4 | 测试 `/` → `/c/tech/` → `/video/BV...` → `search.bilibili.com` → `/unsupported` → 晚到达 `#app` 容器与过时异步回调生成期校验 | 不同支持路由状态正确同步，晚到达容器可挂载单壳，过时 generation 回调在离开或切换后被丢弃且不污染新页面 | Chrome 与 Edge 均PASS；`generation` 单调递增，切离后 stale async 回调未重挂旧评论/抽屉，0 `pageerror` | `EV-P102-E2E-A021` | **PASS** |
| `A02.2-F1-SPA-RESTORE` | `CB74868A...263C` | Chrome 158 & Edge 158 / `FX-HOME`、`FX-VIDEO`、`FX-UNSUPPORTED` | **F1 同文档 SPA** | 浅色/深色主题下进入 `/c/tech/` 后 `replaceState('/unsupported')`；验证 IM 期间站点新写 `title`/`#orig href`/`colorScheme`；预装+后装第三方 History 包装共存；原生输入聚焦→点 `.xim-fab`→菜单切原版恢复焦点；借用视频/评论父节点被宿主替换后点 `原版评论` 退回原版（关闭 `KF-01`） | 按资源所有权逐项还原脚本实改项并保留站点新写入；原 `#orig` ID 保留；第三方 History 包装不被覆盖；原生输入焦点恢复；已脱离旧父节点不再强行塞回，新宿主 `#bilibili-player-v2` 与 `bili-comments#native-comments-v2` 完整保留；`activeSessionStats` 全 0 且 `disposed=true` | Chrome 与 Edge 均 PASS；`snap` 各属性/类/CSS 变量全部还原、`title="B站实时新标题"`、`origIconHref="data:,bili-live-icon"`、`colorScheme="light"` 完整保留、`activeElement.id="native-search-input"`、`oldPlayerConnected=false`/`newPlayerConnected=true`、`activeSessionStats` 全 0 | `EV-P102-E2E-F1` | **PASS** |
| `A02.2-F2-RELOAD` | `CB74868A...263C` | Chrome 158 & Edge 158 / `FX-HOME`、`FX-UNSUPPORTED` | **F2 整页刷新** | IM 模式刷新保持单壳；菜单切 `native` 后整页刷新校验原生标题、favicon、无 IM 节点及 `.xim-fab` 可见 | 整页刷新后状态持久化生效，原生模式下 0 壳且 `.xim-fab` 正常 | Chrome 与 Edge 均 PASS（`shellCount=0`、`title="Fixture Native"`、`origIconHref="data:,native"`、`.xim-fab` 可见） | `EV-P102-E2E-F2` | **PASS** |
| `A02.2-F3-HISTORY-BFCACHE` | `CB74868A...263C` | Chrome 158 & Edge 158 / `FX-HOME`、`FX-SEARCH`、`FX-UNSUPPORTED` | **F3 前进后退与 BFCache** | 执行同文档 `/c/tech/` ↔ `/unsupported` `goBack`/`goForward`，跨文档 `www` ↔ `search` `goBack`/`goForward`，以及合成 `PageTransitionEvent('pagehide'/'pageshow', { persisted: true })` 挂起与幂等重挂 | 同文档与跨文档前进后退路由正确；`pagehide(persisted:true)` 幂等卸载会话，`pageshow(persisted:true)` 恢复单壳且不重复绑定 | 同文档与跨文档前进后退及合成 `PageTransitionEvent(persisted:true)` 在 Chrome 与 Edge 均 PASS（真实 Chromium 路由拦截下浏览器原生 HTTP BFCache `persisted:true` 未直接触发，已在下节单列边界） | `EV-P102-E2E-F3` | **PASS** |
| `A02.2-F4-COLD-START` | `CB74868A...263C` | Chrome 158 & Edge 158 / `FX-UNSUPPORTED`、`FX-HOME` | **F4 冷启动** | 1）全新上下文冷启动 `/unsupported` 后再同文档 `pushState('/')`（关闭 `KF-02`）；2）预设 `bilishu-im-view=native` 冷启动 `/` | `/unsupported` 冷启动原生可用、切回 `/` 正常挂载单壳；预设 `native` 冷启动保持 0 壳且 `.xim-fab` 与原生按钮可用 | Chrome 与 Edge 均 PASS（含 `T03` 与 `A02.2-F4` 验证） | `EV-P102-E2E-F4` | **PASS** |
| `A02.2-STRESS-20` | `CB74868A...263C` | Chrome 158 & Edge 158 / `FX-HOME`、`FX-UNSUPPORTED` | **F1 + FAB 连续往返** | 连续执行 20 次 IM ↔ 原版/未支持路径往返切换（交替 SPA 与菜单/`FAB`），再同步连切 `pushState('/unsupported') → pushState('/') → replaceState('/unsupported')` | 最终 0 IM 残留节点、0 壳、0 泄漏监听/观察者/定时器，原生按钮点击一次触发一次，0 `pageerror` | Chrome 与 Edge 均 PASS（`anyImNodeCount=0`，`activeSessionStats` 全 0 且 `disposed=true`，原生点击精确 +1） | `EV-P102-E2E-20X` | **PASS** |
| `A02-UNIT` | `CB74868A...263C` | Node 24.22.1 / `tests/unit/*.test.mjs` | 不适用 | 运行全部 5 个单元测试套件（含 History 桥、资源所有权、SessionScope 幂等释放、LifecycleCoordinator、配置/解析与溯源许可校验） | 全部单元测试通过，无跳过或放宽断言 | **14/14 PASS**（0 fail，0 skipped，`214.9ms`） | `EV-P102-UNIT` | **PASS** |
| `A02-REPRO-BUILD` | `CB74868A...263C` | Windows 11 / 两份独立临时干净目录 | 不适用 | 双洁净目录分别运行 `npm ci && npm run build`，对比 SHA-256 与工作区产物，核查上游快照只读状态 | 双构建与工作区 SHA-256 完全一致，`upstreamSnapshotVerified=true` | `buildA === buildB === workspace === CB74868A33F85178CE8FDF43457A0D0D2AC9E87D83C93A349A790E0B60FF263C`，`bytes=627828`，`lines=12513` | `EV-P102-REPRO` | **PASS** |
| `A02-P101-REGRESSION` | `CB74868A...263C` | Chrome 158 & Edge 158 / `tests/e2e/p1-01-baseline.spec.mjs` | F1–F4 | 全量回归 `T01`–`T07`、`A01.1`、`A01.2`（`T01`/`T03` 已随 P1-02 去重载与 `KF-01`/`KF-02` 关闭更新；`KF-03`–`KF-12` 基线保留） | 全部 18 项跨浏览器基线回归继续通过，无回归缺陷 | Chrome 9/9 + Edge 9/9 共 18/18 全部 PASS | `EV-P102-REG-P101` | **PASS** |
| `A02-REAL-TM-SYNTHETIC` | `CB74868A...263C` | Windows Chrome `158.0.8127.37` + 真实 Tampermonkey `5.5.1` MV3 × 合成样本 | F2 / F4 / Dashboard 停用 | 从隔离配置安装 `v0.1.0-p1.2`，实测主站、`search`、iframe、`unsupported`、Dashboard 停用恢复原版、重新启用单壳 | 安装版本 `0.1.0-p1.2`、主站/搜索单壳、iframe `0` 壳、停用恢复 `Fixture Native`、0 `pageerror` | `injectionMode=real-tampermonkey-extension`；`dashboardRow="1 DingBili · B站钉钉皮肤 0.1.0-p1.2 614 KB 0 min"`；主站 `shells=1/msgCount=1`；搜索 `searchViews=1`；iframe `top=1/child=0`；停用后 `title="Fixture Native"` / `faviconHref="data:,native"` / `nativeButtonClicks=1`；重启用 `shells=1`；`pageErrors=[]` | `EV-P102-TM-SYN` | **PASS** |
| `A02-REAL-TM-LIVE` | `CB74868A...263C` | Windows Chrome `158.0.8127.37` + 真实 Tampermonkey `5.5.1` MV3 × 匿名只读真实 B 站 | 停用复核 | 隔离配置访问真实 `www.bilibili.com/` 与 `search.bilibili.com/all?keyword=音乐`，并在 Dashboard 停用后重访 `www.bilibili.com/` | 主站与搜索单壳可用，停用后真实 B 站页面与顶栏完整可用 | `www.bilibili.com`: `shells=1`, `hasImTheme=true`, `msgCount=8`; `search.bilibili.com`: `searchViews=1`, `title="搜索 - 飞书"`; 停用后: `shells=0`, `hasImTheme=false`, `title="哔哩哔哩 (゜-゜)つロ 干杯~-bilibili"`, `hasNativeHeader=true`（被屏蔽非 GET/三方请求产生之 `livePageErrors` 已单列） | `EV-P102-TM-LIVE` | **PASS** |
| `A02-FIREFOX` | `CB74868A...263C` | Windows 11 Firefox | 不适用 | Firefox 兼容测试 | 纳入 P1-08 兼容矩阵 | 本机未安装 Firefox，未执行 | `EV-P102-FF-NA` | **NOT TESTED** |
| `A02-CI-LOCAL` | `CB74868A...263C` | Windows 11 本地等价 `ci.yml` 步骤（提交 `b99252f`） | 不适用 | 执行 `npm.cmd run build`、`git diff --exit-code dist/DingBili.user.js`、`npm.cmd run test:unit`、`npm.cmd run verify:repro` 并检查上游快照状态 | 全部通过且工作区产物无漂移 | 全部步骤退出码 0，`dist/DingBili.user.js` 与提交产物零差异，14/14 单测 PASS，双洁净构建 SHA-256 `CB74868A...263C` PASS | `EV-P102-CI-LOCAL` | **PASS** |
| `A02-CI-GITHUB` | `CB74868A...263C` | GitHub Actions `CI / build-and-verify`（PR `#2`: `https://github.com/meredithfyc1001/DingBili/pull/2`） | 不适用 | 仓库转为 `Public` 后重跑提交 `05f72db` 的 CI、正式创建叠栈 PR `#2`，并在 PR `#1` 合入 `main` 后改基为 `main` 复测 `pull_request` CI | 标准 `ubuntu-latest` Runner 启动执行全部步骤且 PR `#2` 检查全绿 | **PASS**：仓库确认为 `Public`，`runner=GitHub Actions 1000000377`（`runner_group=GitHub Actions`，`labels=ubuntu-latest`，非 Larger Runner）；Run `#8`（`actions/runs/45969293738`，`attempt=2`，Job `140415093983`，耗时 `24s`）完整执行 `#1 Set up job` → `#8 Verify reproducible build` → `#17 Complete job` 全部步骤并通过（仅非阻塞 Node 20 弃用提示）；PR `#2` 已正式创建并随 PR `#1` 合入 `main` 后改基为 `main` 复测合入 | `EV-P102-CI-GH` | **PASS** |

### 边界与未混淆说明
1. **合成测试 vs 真实用户脚本管理器 vs 匿名只读真实 B 站**：上述表项分别单独列出 Playwright `addInitScript`（24/24）、Tampermonkey `5.5.1` × 合成样本，与 Tampermonkey `5.5.1` × 匿名只读真实 B 站实测结果，未用任何一项替代另一项。
2. **BFCache 说明**：`LifecycleCoordinator` 的 `pagehide`/`pageshow` 挂起与幂等重挂已通过 `A02.2-F3` 中合成 `PageTransitionEvent('pagehide'/'pageshow', { persisted: true })` 及跨文档 `goBack`/`goForward` 验证；在 Playwright `context.route()` 离线拦截条件下 Chromium 未自然触发 `persisted === true` 的真实 HTTP BFCache 命中，故将真实网络 BFCache 命中边界与合成 `persisted: true` 事件分别如实记录。
3. **已知基线边界**：`baseline/BASELINE_BEHAVIOR.md` 中 `KF-01`（退出残余）与 `KF-02`（未支持路径冷启动失灵）已在本阶段正式关闭；皮肤切换 `[data-skin]` / `[data-mode="default"]` 仍按基线使用整页重载（将在 `P1-03` 抽取 Theme Adapter 后消除），`KF-03`–`KF-12` 继续保留给各自归属阶段 `P1-03`–`P1-07`。

---

## 二、独立代码审查记录（Self-Review）

### 1. 架构设计与模块职责
- 新增 `src/core/history.js`：协作式文档级 `installHistoryBridge(win, onRouteChange, { ownerId })`，支持 `pushState` / `replaceState` / `popstate` / `hashchange`、`microtask` 同 tick 同 URL 去重，卸载时严格比较当前属性是否仍为自身包装，绝不覆盖页面或后续第三方扩展安装的新包装函数。
- 新增 `src/core/ownership.js`：
  - `createDocumentOwnership(doc)`：仅追踪脚本自身写入的 `document.title`、favicon（仅在现有 `link` 的 `id === injectedId` 时才暂避，保留原 `#orig` 等 ID）、根元素类/属性/CSS 变量/`color-scheme`、`inert` 与挂载前焦点；检测到宿主在挂载期间写入的新值时自动让渡所有权，不在卸载时用旧快照覆盖宿主新状态。
  - `createSessionScope(win)`：集中托管会话级 `EventTarget` 监听、`MutationObserver`、`setTimeout`/`setInterval`/`requestAnimationFrame`、`AbortController` 与额外清理钩子，实现幂等释放与归零统计（`stats()`）。
- 新增 `src/core/lifecycle.js`：`createLifecycleCoordinator(...)` 单例协调器（`Symbol.for('dingbili.lifecycle.coordinator')`），严格分离文档级路由监听与页面级会话，支持从未支持页冷启动同文档进入支持页、切出支持页或切换 `native` 时无重载卸载会话、`pagehide`/`pageshow` BFCache 挂起与重建、单帧合并调度与单调 `generation` 失效保护，并提供只读状态诊断接口 `window.__dingbiliLifecycle()`。
- 更新 `src/baseline/legacy-runtime.js`：移除旧 `routeKind() === "other"` 早退与 `patchHistory`，将 `nativeMode()` / `[data-mode="native"]` / `.xim-fab` / `.im-native-comment-fallback` 切换改为同文档无重载模式切换，修复 `restoreParkedVideo()` 在宿主父节点已脱离 DOM 时将其强行塞回死父节点的缺陷，为异步详情与评论定时器加上 `lifecycle.isGenerationActive(reqGen)` 保护。

### 2. 安全、权限、许可证与只读隔离
- `@match`（`https://www.bilibili.com/*`、`https://search.bilibili.com/*`）、`@grant none`、`@run-at document-start`、`@noframes` 均未变更。
- 完整保留 MIT 许可证与 `czm15053/linuxdo-idea-ui`、`Jack-Cherish/BiliShu` 上游署名；不接触、不读取、不上传用户凭据。
- `git -C P0-audit/upstream status --porcelain` 为空，上游只读快照及 `PROVENANCE.json` 校验完全一致。

### 3. 自审与验证期间发现并立即修复的问题
1. 初版 E2E 用例 `tests/e2e/p1-02-routing-lifecycle.spec.mjs` 在首次 `page.goto()` 前直接执行 `localStorage.setItem(...)`，触发 `about:blank` 文档安全限制（`SecurityError`）；已改为先导航至同源 `/unsupported` 再设置主题模式并验证浅/深色切换。
2. 首次真浏览器 `A02.2 x F1` 验证捕获到真实焦点缺陷：用户在原版搜索框 `#native-search-input` 聚焦后点击 `.xim-fab` 切回 IM，浏览器点击按钮时先将焦点移至 `.xim-fab`，随后协调器移除 `.xim-fab` 导致 `captureFocus()` 丢失原焦点；已在 `ensureNativeFab()` 添加 `fab.addEventListener("mousedown", (e) => e.preventDefault())` 修复，随后全量 Chrome + Edge `test:e2e`（24/24）与 `test:tm:chrome` 一次性全部通过。

---

## 三、阶段验收结论

- **结论**：**P1-02 所有必需验收项（单元测试 14/14、双洁净目录可复现构建、本地 CI 等价检查、Chrome+Edge 全量 E2E 24/24、真实 Chrome 158 + Tampermonkey `5.5.1` 合成与匿名只读真实 B 站实测，以及 Public 仓库标准 `ubuntu-latest` Runner `CI / build-and-verify`）均已 PASS**；PR `#2`（https://github.com/meredithfyc1001/DingBili/pull/2 ）已正式创建，在合入 PR `#1` 后的最新 `main` 基线上改基复测通过即可合并至 `main`。
- **明确记录的未测范围与基线边界**：
  - `A02-FIREFOX`：**NOT TESTED**（本机未安装 Firefox，留待 P1-08）。
  - 真实 HTTP BFCache 命中边界与合成 `PageTransitionEvent(persisted:true)` 已分别记录；`KF-03`–`KF-12` 保留给 P1-03 至 P1-07。
