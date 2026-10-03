import { describe, expect, it } from 'vitest';
import { computeCharts } from '../src/index';
import { RULES, lintText } from '../src/rules';
import { GLOSSARY, glossaryFor } from '../src/rules/glossary';
import { summarize } from '../src/interpret/summary';
import { elementCounts, lifeTimeline, tenGodCounts } from '../src/interpret/stats';
import { TEN_GODS } from '../src/bazi/tables';
import { rng, solarInput } from './helpers';

describe('名词小词典', () => {
  it('释义符合语言准则，不含引号式引文，不含“必定”类断语', () => {
    for (const e of GLOSSARY) {
      expect(lintText(e.plain), e.term).toEqual([]);
      expect(e.plain, e.term).not.toMatch(/[「」]/);
    }
  });
  it('同组内词条不重复；十神、十二长生、四化都有', () => {
    const keys = GLOSSARY.map((e) => e.group + e.term);
    expect(new Set(keys).size).toBe(keys.length);
    for (const g of TEN_GODS) expect(glossaryFor(g, '八字'), g).toBeTruthy();
    for (const t of ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养']) expect(glossaryFor(t, '八字'), t).toBeTruthy();
    for (const t of ['化禄', '化权', '化科', '化忌']) expect(glossaryFor(t, '紫微'), t).toBeTruthy();
  });
  it('十神释义的生克阴阳关系与 tenGodOf 一致（独立写法：由五行生克与阴阳推）', async () => {
    const { tenGodOf } = await import('../src/bazi/engine-util');
    const { STEM_ELEMENT, GENERATES, CONTROLS } = await import('../src/core/ganzhi');
    for (let dm = 0; dm < 10; dm++) for (let s = 0; s < 10; s++) {
      const me = STEM_ELEMENT[dm], o = STEM_ELEMENT[s], same = (dm % 2) === (s % 2);
      const rel = o === me ? (same ? '比肩' : '劫财') : GENERATES[me] === o ? (same ? '食神' : '伤官') : CONTROLS[me] === o ? (same ? '偏财' : '正财') : CONTROLS[o] === me ? (same ? '七杀' : '正官') : (same ? '偏印' : '正印');
      expect(tenGodOf(dm, s)).toBe(rel);
    }
  });
});

describe('一页读懂', () => {
  const cases = [solarInput(1988, 4, 2, 7, 50, 'M'), solarInput(1993, 11, 21, 16, 15, 'F'), ...Array.from({ length: 60 }, (_, i) => { const r = rng(900 + i); return solarInput(r.int(1950, 2019), r.int(1, 12), r.int(1, 28), r.int(0, 23), r.int(0, 59), r.int(0, 1) ? 'M' : 'F'); })];
  it('任意盘都能生成；每个要点附规则条目；语言准则无违规；没有评分类用语', () => {
    for (const inp of cases) {
      const b = computeCharts(inp);
      const blocks = summarize(b, RULES, b.ziwei.input.lunarYear + 30);
      expect(blocks.length).toBe(5);
      for (const bl of blocks) {
        expect(lintText(bl.lead), bl.id).toEqual([]);
        for (const p of bl.points) {
          expect(p.item.ruleId, `${bl.id}/${p.label}`).toBeTruthy();
          expect(lintText(p.text), `${bl.id}/${p.label}: ${p.text}`).toEqual([]);
          expect(p.text + bl.lead).not.toMatch(/评分|得分|总分|综合|运势指数|[0-9]+\s*分/);
        }
      }
    }
  });
  it('用户盘：事实与外部软件一致（命宫亥宫天相、水二局、日主丁火阴）', () => {
    const b = computeCharts(cases[0]);
    const sb = summarize(b, RULES, 2026);
    const basic = sb[0].points.map((p) => p.text).join('\n');
    expect(basic).toContain('水二局');
    expect(basic).toContain('命宫在亥宫，主星天相');
    expect(basic).toContain('日主丁（阴火）');
    expect(sb[4].lead).toContain('2026');
  });
});

describe('图形统计', () => {
  it('五行与十神数量守恒', () => {
    const b = computeCharts(solarInput(1993, 11, 21, 16, 15, 'F'));
    const ec = elementCounts(b.bazi);
    expect(Object.values(ec.eight).reduce((a, c) => a + c, 0)).toBe(8);
    const hid = (['year', 'month', 'day', 'hour'] as const).reduce((a, k) => a + b.bazi.pillars[k].hidden.length, 0);
    expect(Object.values(ec.withHidden).reduce((a, c) => a + c, 0)).toBe(4 + hid);
    expect(Object.values(tenGodCounts(b.bazi)).reduce((a, c) => a + c, 0)).toBe(3 + hid);
  });
  it('时间轴：1993 女 2026 年虚岁34，大运丙寅（25–34）与大限丁巳（22–31）/戊午（32–41）高亮', () => {
    const b = computeCharts(solarInput(1993, 11, 21, 16, 15, 'F'));
    const t = lifeTimeline(b.ziwei, b.bazi, 2026);
    expect(t.age).toBe(34);
    expect(t.luck.filter((s) => s.current).map((s) => s.label)).toEqual(['丙寅']);
    expect(t.decade.filter((s) => s.current).map((s) => s.label)).toEqual(['午宫']);
  });
});
