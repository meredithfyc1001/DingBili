# DingBili · B站钉钉皮肤用户脚本

基于 [Jack-Cherish/BiliShu](https://github.com/Jack-Cherish/BiliShu)（固定版本 `0.6.1`，commit `da8b9722a778c94440e826a02559c8da3692b546`）进行二次开发的钉钉风格 B 站浏览器增强脚本，保留钉钉、飞书与企业微信三套外观以及 B 站原生视频播放、搜索、账户与评论能力，并逐步演进为 `Site Adapter + Theme Adapter` 通用架构。

## 构建交付物

- 单文件产物：[`dist/DingBili.user.js`](dist/DingBili.user.js)（无任何运行时外部 JS/CSS 依赖）
- 匹配域名：`https://www.bilibili.com/*`、`https://search.bilibili.com/*`
- 权限声明：`@grant none`、`@run-at document-start`、`@noframes`

## 本地开发与验证（Windows 11 / Node.js 24+）

> 说明：Windows PowerShell 若因执行策略限制无法调用 `npm.ps1`，请使用 `npm.cmd`。

```powershell
# 安装锁定依赖
npm.cmd ci

# 构建单文件 dist/DingBili.user.js
npm.cmd run build

# 运行单元测试（来源、头信息、许可与基线解析）
npm.cmd run test:unit

# 在两个独立干净目录验证可复现构建
npm.cmd run verify:repro

# 运行 Windows 本地 Chrome + Edge Playwright E2E 回归
npm.cmd run test:e2e

# 一键执行完整构建与全量验证
npm.cmd test
```

## 项目文档

- [项目进度](PROGRESS.md)
- [P1 开发计划](P1_PLAN.md) · [P1 验收计划](P1_ACCEPTANCE.md) · [P1 任务依赖与交接标准](P1_DEPENDENCIES.md)
- [P0 源码审计报告](P0-audit/reports/AUDIT_REPORT.md)
- [P1-01 行为基线登记表](baseline/BASELINE_BEHAVIOR.md) · [上游来源清单](baseline/PROVENANCE.json)
- [P1-01 验收与自审报告](docs/reports/P1-01_ACCEPTANCE_REPORT.md)

## 许可证与署名

本项目遵循 [MIT License](LICENSE)。

- 直接上游：`Jack-Cherish/BiliShu`（`0.6.1`，commit `da8b9722a778c94440e826a02559c8da3692b546`）
- 祖先来源：`czm15053/linuxdo-idea-ui`（`xhs/` + `x/` 视频样式，commit `88653fc24432f6dfc61b26d488afc74f05eb230c`，`Copyright (c) 2026 czm15053`）
- 本仓所有二次开发均在独立产品目录进行，上游只读快照与演示动图不纳入本仓分发产物。
