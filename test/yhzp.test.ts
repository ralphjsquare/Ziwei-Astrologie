import { describe, expect, it } from 'vitest';
import { computeCharts, BRANCHES, STEMS } from '../src/index';
import { RULES } from '../src/rules';
import { interpretNatal, interpretYear } from '../src/interpret';
import { rng, solarInput } from './helpers';

// 《渊海子平》参照：命中条件按书中名单与定义（“止有四日：丁酉、丁亥、癸巳、癸卯”等）手写期望，不取自本引擎的输出。
const natal = (c: ReturnType<typeof computeCharts>) => interpretNatal(c, RULES).find((s) => s.id === 'bz-yhzp')!.items;
const ids = (c: ReturnType<typeof computeCharts>) => natal(c).map((i) => i.ruleId);
const dayGz = (c: ReturnType<typeof computeCharts>) => STEMS[c.bazi.pillars.day.stem] + BRANCHES[c.bazi.pillars.day.branch];
const hourGz = (c: ReturnType<typeof computeCharts>) => STEMS[c.bazi.pillars.hour.stem] + BRANCHES[c.bazi.pillars.hour.branch];

describe('渊海子平参照：规则与语料', () => {
  it('47 条规则都有逐字引文，引文取自语料 yhzp/*，章节名与出处一致', () => {
    const rs = [...RULES.bazi].filter((r) => r.id.startsWith('bz.yhzp.'));
    expect(rs.length).toBe(47);
    for (const r of rs) {
      expect(r.classical.length, r.id).toBeGreaterThan(0);
      for (const q of r.classical) {
        expect(q.corpusRef.startsWith('yhzp/'), r.id).toBe(true);
        expect(RULES.corpus[q.corpusRef].text.includes(q.quote), r.id).toBe(true);
        expect(RULES.corpus[q.corpusRef].edition, r.id).toContain('版本未核实');
      }
      expect(r.review.status).toBe('draft');
    }
  });
});

describe('渊海子平参照：本盘命中', () => {
  it('随机 300 盘：必有框架、月令、日主、月支、五行性情条目，且不抛错', () => {
    const r = rng(77);
    for (let k = 0; k < 300; k++) {
      const c = computeCharts(solarInput(r.int(1902, 2099), r.int(1, 12), r.int(1, 28), r.int(0, 23), r.int(0, 59), r.int(0, 1) ? 'M' : 'F'));
      const got = ids(c);
      const dm = STEMS[c.bazi.dayMaster.stem], mb = BRANCHES[c.bazi.pillars.month.branch];
      for (const id of ['bz.yhzp.frame', 'bz.yhzp.yueling', `bz.yhzp.stem.${dm}`, `bz.yhzp.branch.${mb}`, `bz.yhzp.xingqing.${c.bazi.dayMaster.element}`]) expect(got, id).toContain(id);
    }
  });
  it('日贵、日德、魁罡、日刃（日柱）与金神（时柱）：命中与书中名单一致', () => {
    const lists: Record<string, [string[], 'day' | 'hour']> = {
      日贵: [['丁酉', '丁亥', '癸巳', '癸卯'], 'day'], 日德: [['甲寅', '戊辰', '丙辰', '庚辰', '壬戌'], 'day'], 魁罡: [['壬辰', '庚戌', '戊戌', '庚辰'], 'day'],
      日刃: [['戊午', '丙午', '壬子'], 'day'], 金神: [['癸酉', '己巳', '乙丑'], 'hour'],
    };
    const seenHit: Record<string, number> = {};
    for (let i = 0; i < 400; i++) {
      const c = computeCharts(solarInput(1990 + Math.floor(i / 60), 1 + (i % 12), 1 + ((i * 7) % 28), (i * 5) % 24, 0));
      const got = ids(c);
      for (const [name, [list, which]] of Object.entries(lists)) {
        const expected = list.includes(which === 'day' ? dayGz(c) : hourGz(c));
        expect(got.includes(`bz.yhzp.pillar.${name}`), `${name} ${dayGz(c)} ${hourGz(c)}`).toBe(expected);
        if (expected) seenHit[name] = (seenHit[name] ?? 0) + 1;
      }
    }
    for (const n of Object.keys(lists)) expect(seenHit[n], n).toBeGreaterThan(0);
  });
  it('十神：命中的十神必须透干（年、月、时干）或为月令本气；官杀并见时给出“官杀混杂”', () => {
    const r = rng(5);
    let hunza = 0;
    for (let k = 0; k < 400; k++) {
      const c = computeCharts(solarInput(r.int(1930, 2060), r.int(1, 12), r.int(1, 28), r.int(0, 23), 0));
      const P = c.bazi.pillars;
      const vis = new Set<string>([P.year.stemTenGod!, P.month.stemTenGod!, P.hour.stemTenGod!, P.month.hidden[0].tenGod]);
      const got = ids(c);
      expect(got.includes('bz.yhzp.god.伤官')).toBe(vis.has('伤官'));
      expect(got.includes('bz.yhzp.god.七杀')).toBe(vis.has('七杀'));
      expect(got.includes('bz.yhzp.god.倒食')).toBe(vis.has('偏印'));
      expect(got.includes('bz.yhzp.god.印绶')).toBe(vis.has('正印') || vis.has('偏印'));
      const both = vis.has('正官') && vis.has('七杀');
      expect(got.includes('bz.yhzp.god.官杀混杂')).toBe(both);
      if (both) hunza++;
    }
    expect(hunza).toBeGreaterThan(0);
  });
});

describe('渊海子平参照：征太岁与晦（日柱丙午）', () => {
  // 1993-11-21 女，日柱丙午。按书中定义手推：
  // 庚子年：日支午冲子，日干丙克庚 → 征；辛丑年：丙辛合 → 晦；丁未年：午未合 → 晦；乙巳年：无冲克合
  const c = computeCharts(solarInput(1993, 11, 21, 16, 15, 'F'));
  const yearIds = (y: number) => interpretYear(c, y, RULES).find((s) => s.id === 'bz-year')!.items.map((i) => i.ruleId);
  it('征', () => {
    expect(yearIds(2020)).toContain('bz.yhzp.zheng');
    const it = interpretYear(c, 2020, RULES).find((s) => s.id === 'bz-year')!.items.find((i) => i.ruleId === 'bz.yhzp.zheng')!;
    expect(it.context).toContain('日支午冲太岁子');
    expect(it.context).toContain('日干丙克太岁庚');
  });
  it('晦', () => {
    expect(yearIds(2021)).toContain('bz.yhzp.hui');
    expect(yearIds(2027)).toContain('bz.yhzp.hui');
    expect(yearIds(2021)).not.toContain('bz.yhzp.zheng');
  });
  it('乙巳年（2025）无征无晦', () => {
    expect(yearIds(2025)).not.toContain('bz.yhzp.zheng');
    expect(yearIds(2025)).not.toContain('bz.yhzp.hui');
  });
});
