import { describe, expect, it } from 'vitest';
import { astro } from 'iztro';
import { computeCharts, BRANCHES } from '../src/index';
import { solarToLunar } from '../src/calendar/lunar';
import { civilFromDays, daysFromCivil } from '../src/calendar/civil';
import { rng, solarInput } from './helpers';

// 紫微斗数选项的期望值一律来自 iztro（独立实现），不取自本引擎（ADR-006）。
// 冻结口径（ADR-013）：leapMonthRule=midMonth；首限落命宫。nextMonth 保留为可选古籍口径。
const ti = (h: number) => Math.floor(((h + 1) % 24) / 2);
const majors = (a: ReturnType<typeof astro.bySolar>) => Object.fromEntries(a.palaces.map((p) => [p.earthlyBranch, p.majorStars.map((s) => s.name).sort().join('')]));
const mine = (c: ReturnType<typeof computeCharts>['ziwei']) => Object.fromEntries(c.palaces.map((p) => [BRANCHES[p.branch], p.stars.filter((s) => s.kind === 'major').map((s) => s.name).sort().join('')]));

describe('闰月规则（对照 iztro）', () => {
  // 收集闰月出生的公历日期：遍历若干年，取每个闰月的初十、二十
  const cases: { y: number; m: number; d: number; ly: number; lm: number; ld: number }[] = [];
  for (let day = daysFromCivil(1902, 1, 1); day <= daysFromCivil(2098, 12, 31) && cases.length < 24; day++) {
    const c = civilFromDays(day);
    const l = solarToLunar(c.y, c.m, c.d);
    if (l.leap && l.month < 12 && (l.day === 10 || l.day === 20)) cases.push({ y: c.y, m: c.m, d: c.d, ly: l.year, lm: l.month, ld: l.day });
  }
  it('收集到足够多的闰月用例', () => expect(cases.length).toBeGreaterThanOrEqual(12));
  for (const c of cases.slice(0, 24)) {
    it(`闰${c.lm}月${c.ld}日（${c.ly}）：三种规则各自对应 iztro 的口径`, () => {
      const g = c.ly % 2 ? 'M' : 'F', gn = g === 'M' ? '男' : '女';
      const solar = `${c.y}-${c.m}-${c.d}`;
      const run = (rule: 'midMonth' | 'currentMonth' | 'nextMonth') => computeCharts(solarInput(c.y, c.m, c.d, 10, 0, g), { leapMonthRule: rule }).ziwei;
      // midMonth = iztro fixLeap:true；currentMonth = fixLeap:false（闰月并入本月）；nextMonth = 以“下一个非闰月”同日起盘
      const izMid = astro.bySolar(solar, ti(10), gn, true, 'zh-CN');
      const izCur = astro.bySolar(solar, ti(10), gn, false, 'zh-CN');
      const izNext = astro.byLunar(`${c.ly}-${c.lm + 1}-${c.ld}`, ti(10), gn, false, false, 'zh-CN');
      expect(mine(run('midMonth'))).toEqual(majors(izMid));
      expect(mine(run('currentMonth'))).toEqual(majors(izCur));
      expect(mine(run('nextMonth'))).toEqual(majors(izNext));
    });
  }
});

describe('闰月 15/16 日边界（midMonth，对照 iztro fixLeap=true）', () => {
  it('闰月十五日按本月、十六日按下月：十五日与本月同日盘的命宫月相同，十六日与下月同日盘相同', () => {
    let n = 0;
    for (let day = daysFromCivil(1902, 1, 1); day <= daysFromCivil(2098, 12, 31) && n < 40; day++) {
      const c = civilFromDays(day);
      const l = solarToLunar(c.y, c.m, c.d);
      if (!l.leap || l.month >= 12 || (l.day !== 15 && l.day !== 16)) continue;
      n++;
      const g = l.year % 2 ? 'M' : 'F';
      const z = computeCharts(solarInput(c.y, c.m, c.d, 10, 0, g)).ziwei;
      expect(z.input.effectiveMonth, `闰${l.month}月${l.day}日`).toBe(l.day === 15 ? l.month : l.month + 1);
      const iz = astro.bySolar(`${c.y}-${c.m}-${c.d}`, ti(10), g === 'M' ? '男' : '女', true, 'zh-CN');
      expect(mine(z)).toEqual(majors(iz));
    }
    expect(n).toBeGreaterThanOrEqual(20);
  });
});

describe('大限（冻结口径：首限落命宫；阳男阴女顺、阴男阳女逆；对照 iztro）', () => {
  it('五行局、首限年龄、首限宫位=命宫、顺逆方向、第二限宫位；阳男/阴男/阳女/阴女均覆盖', () => {
    const r = rng(20260930);
    const seen = new Set<string>();
    const startAge: Record<string, number> = { 水二局: 2, 木三局: 3, 金四局: 4, 土五局: 5, 火六局: 6 };
    for (let k = 0; k < 160; k++) {
      const y = r.int(1902, 2099), m = r.int(1, 12), d = r.int(1, 28), h = r.int(0, 22), g = r.next() < 0.5 ? 'M' : 'F';
      const z = computeCharts(solarInput(y, m, d, h, r.int(0, 59), g)).ziwei;
      const a = astro.bySolar(`${y}-${m}-${d}`, ti(h), g === 'M' ? '男' : '女', true, 'zh-CN');
      const yang = z.yearStem % 2 === 0;
      seen.add(`${yang ? '阳' : '阴'}${g}`);
      const first = z.palaces.find((p) => p.decade.startAge === startAge[z.fiveElementBureau.name])!;
      expect(first.name).toBe('命宫');
      expect(first.decade.endAge).toBe(first.decade.startAge + 9);
      expect(z.decadeDirection).toBe((yang && g === 'M') || (!yang && g === 'F') ? 1 : -1);
      const second = z.palaces.find((p) => p.decade.startAge === first.decade.startAge + 10)!;
      expect(second.name).toBe(z.decadeDirection === 1 ? '父母' : '兄弟'); // 阳男阴女：命宫→父母；阴男阳女：命宫→兄弟
      for (const p of z.palaces) expect([p.decade.startAge, p.decade.endAge]).toEqual(a.palaces.find((x) => x.earthlyBranch === BRANCHES[p.branch])!.decadal.range);
    }
    expect([...seen].sort()).toEqual(['阳F', '阳M', '阴F', '阴M']);
  });
});

describe('体系隔离：八字不受紫微选项影响', () => {
  it('闰月规则、魁钺、四化变体都不改变八字结果', () => {
    const inp = solarInput(2020, 6, 5, 10, 0, 'M'); // 2020 闰四月内
    const base = JSON.stringify(computeCharts(inp).bazi);
    for (const o of [{ leapMonthRule: 'nextMonth' as const }, { leapMonthRule: 'currentMonth' as const }, { kuiYueXin: 'ma-hu' as const }, { sihua: { 壬: 2 } }]) {
      expect(JSON.stringify(computeCharts(inp, o).bazi)).toBe(base);
    }
  });
});
