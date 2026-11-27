# DingBili 项目进度

更新日期：2026-11-27（上海时间）

| 阶段 | 状态 | 记录 |
|---|---|---|
| P0 源码审计 | 已完成 | BiliShu 0.6.1 只读快照、八份审计报告和运行基线完整保留。[P0 总结](P0-audit/reports/AUDIT_REPORT.md) |
| 人工架构评审 & P1 规划 | 已批准 | 保留 P1-01 至 P1-08 八项任务及 F1–F4 恢复判据。[开发计划](P1_PLAN.md) · [验收用例](P1_ACCEPTANCE.md) · [依赖标准](P1_DEPENDENCIES.md) |
| 项目交接与环境检查 | 已完成 | 完成本地 Git 初始化并关联远程 `meredithfyc1001/DingBili`；核验 Node 24.22.1、npm 11.19.1、Chrome 158、Edge 158 及上游只读快照无变更；登记缺失工具（本机无 `gh` CLI 与 Firefox）。 |
| **P1-01 冻结行为基线与单文件构建** | **验收通过（待 PR 合并）** | 分支 `feat/p1-01-baseline-build`；候选产物 `dist/DingBili.user.js`（`v0.1.0-p1.1`，`598,782` 字节，SHA-256 `0C3F0ACC6E680B6DB10ADBF8BE8357DF2703F85B11904A986C0E763EBC1558A6`）。单元测试 8/8 PASS；双洁净目录可复现构建 PASS；Playwright `addInitScript` Chrome+Edge 18/18 PASS；真实 Windows Chrome 158 + Tampermonkey `5.5.1`（合成样本 + 匿名只读真实 B 站分开实测）均 PASS；Firefox 留待 P1-08（`NOT TESTED`）。[验收报告](docs/reports/P1-01_ACCEPTANCE_REPORT.md) · [行为基线](baseline/BASELINE_BEHAVIOR.md) · [PR 说明](docs/pr/P1-01_PR.md) |
| P1-02 路由、生命周期与切回原版 | 待启动（P1-01 PR 合并后立即开始） | 依赖 P1-01 PR 完成 CI 核验与合并。 |
| P1-03 抽取 Site Adapter 与 Theme Adapter | 未开始 | 依赖 P1-01、P1-02。 |
| P1-04 修复推荐、分区、导航和搜索 | 未开始 | 依赖 P1-02、P1-03。 |
| P1-05 原生视频、账户与编辑器 | 未开始 | 依赖 P1-02、P1-04。 |
| P1-06 评论、楼中楼与模拟会话 | 未开始 | 依赖 P1-03、P1-05。 |
| P1-07 钉钉桌面交互与小窗 | 未开始 | 依赖 P1-03 至 P1-06。 |
| P1-08 安装、兼容、性能与发布评审 | 未开始 | 依赖 P1-01 至 P1-07。 |

**当前进展**：P1-01 全部必需验收项（含真实 Chrome 158 + Tampermonkey `5.5.1` 安装、元数据、主站/搜索匹配、`@noframes` iframe 与停用恢复原生验证）均已 PASS，正在执行正式 GitHub PR 创建、CI 检查与合并，随后转入 P1-02。
