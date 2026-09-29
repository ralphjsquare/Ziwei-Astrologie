# ADR-012 技术选型
状态：已采纳。
- 单一 TypeScript 包（不用 monorepo 多包，节省成本），目录边界代替包边界：`src/{core,calendar,ziwei,bazi,rules,interpret,crossref,review,storage}`，`web/`，`tools/`。边界由 `tools/check-purity.ts` 强制（引擎与解读层禁止时间、随机、本地时区、DOM、Node API）。
- 运行时依赖：`tyme4ts`（农历、节气；MIT）。开发依赖：`astronomy-engine`（独立天文参照）、`iztro`（紫微独立实现，差分测试）、`fast-check`、`vitest`、`vite`、`playwright-core`、`fake-indexeddb`。
- 哈希：纯 TS 实现 SHA-256 + 规范化 JSON，避免 WebCrypto 的异步与环境差异。
- 网页：Vite + 原生 TypeScript（无框架），SVG/CSS 网格排盘；存储接口 `StorageAdapter`，网页用 IndexedDB，桌面化时可换文件适配器。
