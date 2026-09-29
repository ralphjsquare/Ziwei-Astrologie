# ADR-012 技术选型
状态：已采纳。
- 单一 TypeScript 包，目录边界代替包边界：`src/{core,calendar,ziwei,bazi,rules,corpus,interpret,crossref,review,storage}`，`web/`，`tools/`。边界由 `tools/check-purity.ts` 强制（引擎与解读层禁止时间、随机、本地时区、DOM、Node API）。
- 运行时依赖：`tyme4ts`（农历、节气；MIT）。
- 开发依赖（仅测试与工具，不进入发布物）：`astronomy-engine`（MIT）、`iztro`（MIT）、`js-ephemeris-lite`、`ziwei-lite`、`bazi-lite`（MPL-2.0，作为独立参照实现，未复制其代码）、`opencc-js`（简繁转换，检索语料用）、`fast-check`、`vitest`、`vite`、`playwright-core`、`fake-indexeddb`。曾评估但**不采用** `@orrery/core` 与 `mingyu-core`（AGPL-3.0，许可与本项目不兼容的风险）。
- 哈希：纯 TS 实现 SHA-256 + 规范化 JSON，避免 WebCrypto 的异步与环境差异。
- 网页：Vite + 原生 TypeScript（无框架）；存储接口 `StorageAdapter`，网页用 IndexedDB，桌面化时可换文件适配器。
