# ADR-007 古籍语料（公版）
状态：已采纳原则；**导入未完成，受环境限制**。
- 用户裁决：只用公版。原则见计划第 10 节 R2。
- 尝试结果：构建环境的网络代理拦截了 zh.wikisource.org、ctext.org、archive.org（连接被拒），无法获取并核对公版数字文本及其站点条款。按红旗规则，**不凭记忆写任何古籍引文**。
- 现状：`src/rules/corpus.json` 为空；所有规则的 `classical` 为空，`evidenceType` 只有 `school`、`modern`、`structural`；出处为书名/篇目级引用，来源目录中标 `verified: false`，界面与导出均显示“未核对原文”。
- 基础设施已就绪：`corpus.json` 条目格式（书名、篇目、原文、URL、许可、获取日期、SHA-256）；`check-sources` 校验 classical 规则必须引用语料且引文必须是语料原文的子串；伪造引文会使构建失败（`test/rules.test.ts`）。
- 待办：在可访问上述站点的环境导入《紫微斗数全书》《渊海子平》《子平真诠》等相关章节，逐站点核对许可条款后入库，再把规则升级为 `classical`。
