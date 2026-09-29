# 给开发代理的约定（保持简短，作为稳定前缀）

- 规划依据：`docs/DEVELOPMENT_PLAN.md`；决策记录：`docs/adr/`；成本台账：`docs/LEDGER.md`（只在任务开始与结束时读写）。
- 一次只做一个里程碑的一个子任务；完成 = 类型检查 + 相关测试 + `npm run check:sources` + 文档更新。
- **绝不编造古籍原文或出处。** 原文只能来自 `src/rules/corpus.json`；没有语料就标 `school`/`modern`/`structural`，`review.status` 保持 `draft`。
- **不改测试来迁就代码。** 黄金测试与快照变化必须说明原因，并由人确认。期望值不得来自本引擎自身输出。
- 引擎与解读层禁止 `Date`、`Math.random`、`Intl`、DOM、Node API（`npm run check:purity` 强制）。
- 存在流派分歧就写 ADR 并做成选项，不要猜。
- 命令：`npm run verify`（全部）；`npx vitest run test/xxx.test.ts`（单个）；测试用安静输出，只在失败时看细节。
- 汇报要如实：失败的测试、跳过的步骤、未核对的内容都要写出来。
