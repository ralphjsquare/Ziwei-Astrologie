import { describe, expect, it } from 'vitest';
import { computeCharts, BRANCHES } from '../src/index';
import { RULES } from '../src/rules';
import { synastry, branchRelations } from '../src/synastry';
import { rng, solarInput } from './helpers';
import golden from './fixtures/golden.json';

// 期望值来自黄金盘固件（iztro / tyme4ts）里的四柱与命宫，以及本测试内独立手写的地支关系表，而不是引擎自己的输出。
const IDX = (c: string) => BRANCHES.indexOf(c as (typeof BRANCHES)[number]);
const SIX = ['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未'];
const HARM = ['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌'];
const TRI = ['申子辰', '寅午戌', '亥卯未', '巳酉丑'];
const rel = (a: string, b: string): string[] => {
  const r: string[] = [];
  if (a === b) r.push('同支');
  if (SIX.some((p) => p.includes(a) && p.includes(b) && a !== b)) r.push('六合');
  if ((IDX(a) + 6) % 12 === IDX(b)) r.push('六冲');
  if (HARM.some((p) => p.includes(a) && p.includes(b) && a !== b)) r.push('六害');
  if (a !== b && TRI.some((t) => t.includes(a) && t.includes(b))) r.push('三合（同一三合局）');
  return r;
};

describe('合盘：地支关系（对照独立手写表）', () => {
  it('144 个地支组合全部一致，且对称', () => {
    for (let a = 0; a < 12; a++) for (let b = 0; b < 12; b++) {
      expect(branchRelations(a, b).sort(), `${BRANCHES[a]}${BRANCHES[b]}`).toEqual(rel(BRANCHES[a], BRANCHES[b]).sort());
      expect(branchRelations(a, b).sort()).toEqual(branchRelations(b, a).sort());
    }
  });
});

describe('合盘：黄金盘两两组合', () => {
  const cases = golden.cases.filter((c) => c.input.calendar === 'solar').slice(0, 24);
  it('日支、年支、命宫关系与固件中的独立期望值一致；所有条目有规则、出处', () => {
    const r = rng(7);
    for (let k = 0; k < 40; k++) {
      const ca = cases[r.int(0, cases.length - 1)], cb = cases[r.int(0, cases.length - 1)];
      const A = computeCharts(ca.input as never), B = computeCharts(cb.input as never);
      const items = synastry(A, B, RULES);
      const by = Object.fromEntries(items.map((i) => [i.ruleId, i]));
      const pa = ca.expected.bazi.pillars.split(' '), pb = cb.expected.bazi.pillars.split(' ');
      const rs = (x: string[], y: string[], i: number) => (rel(x[i][1], y[i][1]).join('、') || '无特殊关系');
      expect(by['sy.bz.daybranch'].b).toContain(`关系：${rs(pa, pb, 2)}`);
      expect(by['sy.bz.yearbranch'].b).toContain(`关系：${rs(pa, pb, 0)}`);
      const ma = ca.expected.ziwei.mingBranch, mb = cb.expected.ziwei.mingBranch;
      expect(by['sy.zw.ming'].a).toContain(`命宫${ma}`);
      expect(by['sy.zw.ming'].b).toContain(`命宫${mb}`);
      expect(by['sy.zw.ming'].b).toContain(`关系：${rel(ma, mb).join('、') || '无特殊关系'}`);
      for (const it of items) { expect(RULES.byId.has(it.ruleId)).toBe(true); expect(it.source).not.toBe(''); expect(it.note).not.toBe(''); }
      expect(items.map((i) => i.ruleId)).toEqual(['sy.bz.daymaster', 'sy.bz.daybranch', 'sy.bz.yearbranch', 'sy.bz.cross-relations', 'sy.bz.elements', 'sy.zw.ming', 'sy.zw.spouse', 'sy.zw.sihua']);
    }
  });
  it('跨盘关系数对称；无评分字段', () => {
    const A = computeCharts(solarInput(1990, 6, 15, 10, 30, 'M')), B = computeCharts(solarInput(1992, 3, 8, 14, 0, 'F'));
    const n = (x: typeof A, y: typeof A) => synastry(x, y, RULES).find((i) => i.ruleId === 'sy.bz.cross-relations')!.b.match(/共(\d+)项/)![1];
    expect(n(A, B)).toBe(n(B, A));
    expect(Object.keys(synastry(A, B, RULES)[0]).sort()).toEqual(['a', 'b', 'evidenceLabel', 'note', 'reviewLabel', 'ruleId', 'source', 'system', 'title']);
  });
  it('四化落宫：对方盘中该星所在宫位名与对方盘一致', () => {
    const A = computeCharts(solarInput(1984, 5, 5, 9, 0, 'M')), B = computeCharts(solarInput(1975, 11, 2, 20, 0, 'F'));
    const text = synastry(A, B, RULES).find((i) => i.ruleId === 'sy.zw.sihua')!.a;
    const lu = A.ziwei.fourTransforms.lu;
    const palace = B.ziwei.palaces.find((p) => p.stars.some((s) => s.name === lu))!;
    expect(text).toContain(`${lu}化禄→对方${palace.name}宫`);
  });
});
