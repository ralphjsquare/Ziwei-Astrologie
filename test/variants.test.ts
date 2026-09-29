import { describe, expect, it } from 'vitest';
import { astro } from 'iztro';
import { computeCharts, BRANCHES } from '../src/index';
import { solarToLunar } from '../src/calendar/lunar';
import { civilFromDays, daysFromCivil } from '../src/calendar/civil';
import { rng, solarInput } from './helpers';

// 紫微斗数选项的期望值一律来自 iztro（独立实现），不取自本引擎（ADR-006）。
// 现代口径：leapMonthRule=midMonth、decadeStart=ming；古籍字面口径：nextMonth、literal。两套互不覆盖。
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

describe('大限起宫（对照 iztro 的命宫起限）', () => {
  it('ming：各宫大限年龄与 iztro 一致；literal：每宫大限恰好提前一个十年，命宫成为最后一个大限', () => {
    const r = rng(20260930);
    for (let k = 0; k < 120; k++) {
      const y = r.int(1902, 2099), m = r.int(1, 12), d = r.int(1, 28), h = r.int(0, 22), g = r.next() < 0.5 ? 'M' : 'F';
      const inp = solarInput(y, m, d, h, r.int(0, 59), g);
      const a = astro.bySolar(`${y}-${m}-${d}`, ti(h), g === 'M' ? '男' : '女', true, 'zh-CN');
      const ming = computeCharts(inp, { decadeStart: 'ming' }).ziwei;
      const lit = computeCharts(inp, { decadeStart: 'literal' }).ziwei;
      const bureau = ming.fiveElementBureau.number;
      for (const p of ming.palaces) {
        const iz = a.palaces.find((x) => x.earthlyBranch === BRANCHES[p.branch])!.decadal.range;
        expect([p.decade.startAge, p.decade.endAge]).toEqual(iz);
        const lp = lit.palaces.find((x) => x.branch === p.branch)!;
        const shifted = iz[0] - 10 < bureau ? iz[0] + 110 : iz[0] - 10; // 字面法：原第二个大限变第一个，命宫排到最后
        expect(lp.decade.startAge).toBe(shifted);
      }
      // 《全书》字面：阳男阴女首限在父母宫，阴男阳女首限在兄弟宫
      const first = lit.palaces.find((p) => p.decade.startAge === bureau)!;
      expect(first.name).toBe(lit.decadeDirection === 1 ? '父母' : '兄弟');
      expect(lit.palaces.find((p) => p.name === '命宫')!.decade.startAge).toBe(bureau + 110);
    }
  });
});

describe('体系隔离：八字不受紫微选项影响', () => {
  it('闰月规则、大限起宫、魁钺、四化变体都不改变八字结果', () => {
    const inp = solarInput(2020, 6, 5, 10, 0, 'M'); // 2020 闰四月内
    const base = JSON.stringify(computeCharts(inp).bazi);
    for (const o of [{ leapMonthRule: 'nextMonth' as const }, { leapMonthRule: 'currentMonth' as const }, { decadeStart: 'literal' as const }, { kuiYueXin: 'ma-hu' as const }, { sihua: { 壬: 2 } }]) {
      expect(JSON.stringify(computeCharts(inp, o).bazi)).toBe(base);
    }
  });
});
