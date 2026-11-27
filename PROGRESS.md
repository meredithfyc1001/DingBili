# DingBili 项目进度

更新日期：2026-11-27（上海时间）

| 阶段 | 状态 | 记录 |
|---|---|---|
| P0 源码审计 | 已完成 | BiliShu 0.6.1 只读快照、八份审计报告和运行基线完整保留。[P0 总结](P0-audit/reports/AUDIT_REPORT.md) |
| 人工架构评审 & P1 规划 | 已批准 | 保留 P1-01 至 P1-08 八项任务及 F1–F4 恢复判据。[开发计划](P1_PLAN.md) · [验收用例](P1_ACCEPTANCE.md) · [依赖标准](P1_DEPENDENCIES.md) |
| 项目交接与环境检查 | 已完成 | 完成本地 Git 初始化并关联远程 `meredithfyc1001/DingBili`；核验 Node 24.22.1、npm 11.19.1、Chrome 158、Edge 158 及上游只读快照无变更；登记缺失工具（本机无 `gh` CLI 与 Firefox）。 |
| **P1-01 冻结行为基线与单文件构建** | **进行中（A01.2 真实 Tampermonkey 安装 BLOCKED，待人工安装扩展与授权）** | 分支 `feat/p1-01-baseline-build`（PR 未合并，P1-02 未启动）；候选产物 `dist/DingBili.user.js`（`v0.1.0-p1.1`，`598,782` 字节，SHA-256 `0C3F0ACC6E680B6DB10ADBF8BE8357DF2703F85B11904A986C0E763EBC1558A6`）。单元测试 8/8 PASS、双洁净目录可复现构建 PASS、Chrome+Edge E2E 18/18 PASS；真实 Chrome 158 Tampermonkey 安装验证因需人工商店安装并开启“允许用户脚本”记为 **BLOCKED**（已备好 `setup:tm:chrome` 与 `test:tm:chrome`），Firefox 兼容记为 **NOT TESTED**。[验收报告](docs/reports/P1-01_ACCEPTANCE_REPORT.md) · [行为基线](baseline/BASELINE_BEHAVIOR.md) · [PR 说明](docs/pr/P1-01_PR.md) |
| P1-02 路由、生命周期与切回原版 | 未开始（暂停等待 P1-01 PR 闭环与批准） | 依赖 P1-01 完成 A01.2 真实 Tampermonkey 验收闭环后启动。 |
| P1-03 抽取 Site Adapter 与 Theme Adapter | 未开始 | 依赖 P1-01、P1-02。 |
| P1-04 修复推荐、分区、导航和搜索 | 未开始 | 依赖 P1-02、P1-03。 |
| P1-05 原生视频、账户与编辑器 | 未开始 | 依赖 P1-02、P1-04。 |
| P1-06 评论、楼中楼与模拟会话 | 未开始 | 依赖 P1-03、P1-05。 |
| P1-07 钉钉桌面交互与小窗 | 未开始 | 依赖 P1-03 至 P1-06。 |
| P1-08 安装、兼容、性能与发布评审 | 未开始 | 依赖 P1-01 至 P1-07。 |

**当前进展**：P1-01 工程基线与自动化验证已推送至 `feat/p1-01-baseline-build`，当前因 `A01.2` 真实 Chrome + Tampermonkey 人工安装与“允许用户脚本”授权处于 **BLOCKED**（PR 暂不合并，P1-02 暂不启动）；待隔离配置安装授权完成后立即执行 `npm.cmd run test:tm:chrome` 完成实装验证。
