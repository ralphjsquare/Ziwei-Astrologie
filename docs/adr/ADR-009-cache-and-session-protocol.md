# ADR-009 缓存与会话协议
状态：已采纳（计划第 10 节 R6）。稳定前缀：`AGENTS.md`（短）、`docs/DEVELOPMENT_PLAN.md`、ADR 索引；易变内容放 `docs/LEDGER.md`。一个里程碑内连续工作，不换模型与设置；少轮次、大步骤；测试用安静输出（`reporters: dot`）；不使用子代理。
**实际情况**：本次实施在一个连续会话中完成，未使用子代理；缓存命中率无法在会话内测得，见 `docs/LEDGER.md`。
