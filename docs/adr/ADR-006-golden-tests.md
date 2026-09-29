# ADR-006 黄金测试与预言来源
状态：已采纳（D06-A）。核心原则：**期望值不得来自本项目引擎自己的输出。**

| 层 | 实现情况 |
|---|---|
| L1 历法 | 已完成。1901–2100 每一天：公农历往返、日干支连续；节气时刻与三个独立来源比对；农历月与两个独立来源比对（ADR-008）。官方历表夹具核对待网络放行（ADR-002） |
| L2 安星表 | 部分完成。紫微星位置经典表格行 + 全枚举性质；天府对称全枚举；另由**三个独立紫微实现**（iztro、ziwei-lite，加本项目）互相印证代替“《全书》表格独立查表”（后者待语料入库，ADR-007） |
| L3 整盘 | 60 个出生输入（闰月、子时、立春、春节先后、节令交接、范围两端、农历三十、夏令时、覆盖矩阵），期望值来自 iztro（紫微）与 tyme4ts（八字），与引擎零分歧；另有 ziwei-lite（紫微 400 盘）与 bazi-lite（八字 2000 盘）的随机比对。每例记录 `oracle`。**人工签字 20 盘尚未完成**：核对表 `docs/golden/HUMAN_REVIEW_SHEET.md`，核对方法 `docs/golden/REVIEW_PROTOCOL.md` |
| L4 性质 | 已完成（fast-check） |

**三方印证的价值（实测）**：iztro 与 ziwei-lite 对辛年天魁天钺给出相反的结论（魁午钺寅 vs 魁寅钺午），说明这是传统说法本身的并存，而不是单个软件的错误；本项目把它做成选项 `kuiYueXin`，默认取 iztro 一致的“魁午钺寅”，并保留另一说。四化的戊、庚、壬、癸各版本同理（ADR-010）。
名人盘不作为黄金盘（出生时间无法独立确认，且涉及隐私）。外部软件的一致只是发现差异的手段，不等于古籍正确。

**最佳实践出处**：Barr 等《The Oracle Problem in Software Testing: A Survey》（IEEE TSE，2015）；McKeeman《Differential Testing for Software》（Digital Technical Journal，1998）；Chen 等《Metamorphic Testing: A Review of Challenges and Opportunities》（ACM Computing Surveys，2018）；Claessen 与 Hughes《QuickCheck》（ICFP，2000）；Kuhn 等《Practical Combinatorial Testing》（NIST SP 800-142，2010）。以上为作者所知文献，未联网逐条核实原文。
