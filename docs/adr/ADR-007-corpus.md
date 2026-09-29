# ADR-007 古籍语料（公版）
状态：原则已采纳；**导入待网络放行或由你本地下载**。
- 原则：只用公版；原典之外的现代点校、注释、译本不收；数字化文本站点的条款要读过再标记 `licenseVerified`（计划第 10 节 R2）。
- 现状：构建环境代理拦截了 zh.wikisource.org、ctext.org、archive.org，`src/rules/corpus.json` 为空。**没有凭记忆写任何引文。**
- 已备好完整流水线（离线测试通过，`test/corpus.test.ts`）：
  1. `npm run corpus:find -- 关键词` 检索维基文库真实页面标题 → 填 `docs/sources/manifest.json`；
  2. `npm run corpus:fetch` 下载（含子页面），记录修订号、时间、站点许可文字；
  3. 人工读许可条款 → 改清单的 `license` 与 `licenseVerified: true`；
  4. `npm run corpus:import` 清洗、分节、写 `corpus.json`（含 URL、许可、获取日期、SHA-256；未核对许可者拒绝入库）；
  5. `npm run corpus:suggest` 为每条规则检索引文候选到 `docs/sources/quote-candidates.md`；
  6. 审核人挑选后写 `docs/sources/quotes.json`，`npm run corpus:apply -- docs/sources/quotes.json` 回写（引文必须是语料原文子串；只有 `claimSupported: true` 才升级为“古籍原文”）。
- 门禁：`classical` 规则必须有语料引文；**“已确认”状态必须有古籍原文引文**（算法结构类除外），无原文的解释最高只能到“已审核”（`validateRules`）。
- 放行方式见 `docs/sources/README.md`。
