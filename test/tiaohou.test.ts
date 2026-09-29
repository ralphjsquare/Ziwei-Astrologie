import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { computeCharts, STEMS, BRANCHES } from '../src/index';
import { interpretNatal } from '../src/interpret';
import { RULES, validateRules } from '../src/rules';
import { rng, solarInput } from './helpers';

describe('调候参考（穷通宝鉴，版本未核实）', () => {
  const ex = JSON.parse(readFileSync('docs/sources/qtbj-excerpts.json', 'utf8')) as Record<string, { lead: string; shared?: boolean }>;
  it('语料校验通过；摘录覆盖 120 个日主×月份中的 117 个，缺项是原书电子本没有的（乙丑、戊子、戊丑）', () => {
    expect(validateRules(RULES)).toEqual([]);
    expect(Object.keys(ex)).toHaveLength(117);
    for (const k of ['乙丑', '戊子', '戊丑']) expect(ex[k]).toBeUndefined();
  });
  it('摘录的首句以对应月份和日主开头（甲寅：正月甲木）', () => {
    expect(ex['甲寅'].lead.startsWith('正月甲木')).toBe(true);
    expect(ex['癸子'].lead).toContain('癸水');
  });
  it('解读中的调候条目引用语料原文，并带“版本未核实”', () => {
    const r = rng(11);
    for (let k = 0; k < 60; k++) {
      const b = computeCharts(solarInput(r.int(1930, 2050), r.int(1, 12), r.int(1, 28), r.int(0, 22), 0, 'M'));
      const sec = interpretNatal(b, RULES).find((x) => x.id === 'bz-tiaohou')!;
      const key = STEMS[b.bazi.dayMaster.stem] + BRANCHES[b.bazi.pillars.month.branch];
      const item = sec.items[0];
      if (ex[key]) {
        expect(item.classical[0].quote).toBe(ex[key].lead);
        expect(RULES.corpus[`qtbj/${key}#1`].edition).toContain('版本未核实');
      } else expect(item.classical).toHaveLength(0);
      expect(item.sources[0].edition).toContain('版本未核实');
    }
  });
});
