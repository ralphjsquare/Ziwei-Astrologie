import { describe, expect, it } from 'vitest';
import { computeCharts, BRANCHES, STEMS, canonicalJson } from '../src/index';
import type { BirthInput } from '../src/core/types';
import golden from './fixtures/golden.json';
import sxtwl from './fixtures/sxtwl-pillars.json';

// 黄金测试：期望值来自独立实现（iztro、tyme4ts），不是本引擎输出（ADR-006）。
// 覆盖矩阵：闰月、子时、立春、春节与立春先后、节令交接、范围两端、农历三十、夏令时、随机覆盖。
const norm = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.match(/../g)?.sort().join('') ?? '']));

describe('黄金盘（紫微 60 + 八字 60，独立实现为标准）', () => {
  it('固件自身：60 例，无未裁决差异，每例都记录了标准来源', () => {
    expect(golden.cases).toHaveLength(60);
    expect(golden.divergences).toEqual([]);
    for (const c of golden.cases) {
      expect(c.oracle.ziwei.source).toMatch(/^iztro@/);
      expect(c.oracle.bazi.source).toMatch(/^tyme4ts@/);
      expect(c.oracle.ziwei.type).toBe('independent-implementation');
    }
    const cats = new Set(golden.cases.map((c) => c.category.replace(/（.*）/, '')));
    for (const need of ['闰月', '子时边界', '立春前后', '立春与春节之间/之前', '节令交接前后', '范围两端', '农历三十', '夏令时']) expect(cats.has(need)).toBe(true);
  });

  for (const c of golden.cases) {
    it(`${c.id} ${c.category}`, () => {
      const b = computeCharts(c.input as BirthInput);
      expect(BRANCHES[b.ziwei.mingBranch]).toBe(c.expected.ziwei.mingBranch);
      expect(BRANCHES[b.ziwei.bodyBranch]).toBe(c.expected.ziwei.bodyBranch);
      expect(b.ziwei.fiveElementBureau.name).toBe(c.expected.ziwei.bureau);
      const majors = Object.fromEntries(b.ziwei.palaces.map((p) => [BRANCHES[p.branch], p.stars.filter((s) => s.kind === 'major').map((s) => s.name).join('')]));
      expect(canonicalJson(norm(majors))).toBe(canonicalJson(norm(c.expected.ziwei.majorStars)));
      const trans: Record<string, string> = {};
      for (const p of b.ziwei.palaces) for (const s of p.stars) if (s.transform && s.kind !== 'other') trans[s.name] = s.transform;
      // 壬年：iztro 取“辅”，本项目默认《全书》“府”（ADR-010），该年干不比较四化
      if (b.ziwei.yearStem !== 8) for (const [star, t] of Object.entries(c.expected.ziwei.transforms)) expect(trans[star]).toBe(t);
      const pillars = (['year', 'month', 'day', 'hour'] as const).map((k) => STEMS[b.bazi.pillars[k].stem] + BRANCHES[b.bazi.pillars[k].branch]).join(' ');
      expect(pillars).toBe(c.expected.bazi.pillars);
      expect([b.bazi.luck.start.years, b.bazi.luck.start.months, b.bazi.luck.start.days]).toEqual(c.expected.bazi.luckStart);
    });
  }

  // 第三个独立来源：寿星天文历 sxtwl（tools/py/sxtwl_pillars.py 生成），与 tyme4ts 的期望值逐例比对
  it('八字四柱与 sxtwl 独立推算一致（60 例）', () => {
    const cases = sxtwl.cases as Record<string, { pillars: string }>;
    expect(Object.keys(cases)).toHaveLength(60);
    for (const c of golden.cases) expect(cases[c.id].pillars, c.id).toBe(c.expected.bazi.pillars);
  });

  it('AI 预核与人工核对分开记录：AI 记录不得冒充人工签字', () => {
    for (const c of golden.cases as { id: string; oracle: { humanVerifiedBy: { role?: string } | null; aiPrecheck?: { role: string } } }[]) {
      if (c.oracle.aiPrecheck) expect(c.oracle.aiPrecheck.role).toBe('AI_INDEPENDENT_PRECHECK');
      if (c.oracle.humanVerifiedBy) expect(c.oracle.humanVerifiedBy.role).not.toMatch(/AI/);
    }
  });
});

