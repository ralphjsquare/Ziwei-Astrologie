# ADR-013 紫微选项定稿与两套体系隔离

状态：采纳（2026-09-29）。依据：ADR-010 的两个待裁决默认值，加上外部评审意见（人工，非古籍）。

## 决定
1. `leapMonthRule` 默认 `midMonth`（前后半月法：闰四月初十按四月，二十按五月）。`currentMonth`、`nextMonth`（古籍字面法，《全书》“闰月一律按下月”）保留为选项。界面不用“上个月/本月”这类含糊说法，一律用例子定义；闰月出生者显示专门提示。
2. 新增 `decadeStart`：`ming`（命宫起限，通行，默认）、`literal`（《全书》大限诀字面：阳男阴女从命前一宫即父母宫起顺行，阴男阳女从命后一宫即兄弟宫起逆行；命宫排到最后一个大限）。
3. 八字不设闰月规则，不受任何紫微选项影响：月柱按十二“节”的交节时刻，年柱按立春。八字真正可配置的是日界（`baziDayBoundary`）、真太阳时（`trueSolarTime`）和大运起运规则，不与紫微混算。有测试保证隔离（`test/variants.test.ts`）。
4. 黄金盘按口径分套，不互相覆盖：现代口径（midMonth + ming）沿用 `test/fixtures/golden.json`；古籍字面口径（nextMonth + literal）由 `test/variants.test.ts` 用 iztro 推导期望值（nextMonth 以下一个非闰月同日起盘，literal 以 iztro 命宫起限的大限整体前移一格），未另存固件，避免把引擎输出当期望值。

## 说明
- 评审意见提到 iztro 的 `fixLeap=true` 即前后半月法；测试证实 `midMonth` 与之逐盘一致，`currentMonth` 与 `fixLeap=false` 一致。
- 该评审意见不是古籍出处，也不构成“哪一派更准”的判断；这里只采纳它对体系一致性与命名的工程建议。
