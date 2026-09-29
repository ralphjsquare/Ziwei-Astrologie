import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ChildLimit, Gender, SolarTime } from 'tyme4ts';
import { BRANCHES, STEMS, computeCharts, baziYearLayer } from '../src/index';
import { jieInstantsAround } from '../src/calendar/lunar';
import { civilFromEpoch } from '../src/calendar/civil';
import { computeRelations } from '../src/bazi/relations';
import { longShengOf } from '../src/bazi/engine';
import { tenGodOf } from '../src/bazi/engine-util';
import { HIDDEN_STEMS } from '../src/bazi/tables';
import type { BaziChart } from '../src/bazi/types';
import { rng, solarInput } from './helpers';

const label = (c: BaziChart) =>
  (['year', 'month', 'day', 'hour'] as const).map((k) => STEMS[c.pillars[k].stem] + BRANCHES[c.pillars[k].branch]).join(' ');
const sIdx = (s: string) => STEMS.indexOf(s as (typeof STEMS)[number]);
const bIdx = (s: string) => BRANCHES.indexOf(s as (typeof BRANCHES)[number]);

describe('八字四柱：与独立历法库比对', () => {
  it('随机 3000 个出生时刻：四柱与大运起运（年月日）与 tyme4ts 一致', () => {
    const r = rng(20260929);
    const bad: string[] = [];
    for (let k = 0; k < 3000; k++) {
      const y = r.int(1902, 2099), m = r.int(1, 12), d = r.int(1, 28), h = r.int(0, 23), mi = r.int(0, 59), g = r.next() < 0.5 ? 'M' : 'F';
      const c = computeCharts(solarInput(y, m, d, h, mi, g)).bazi;
      const st = SolarTime.fromYmdHms(y, m, d, h, mi, 0);
      const ec = String(st.getLunarHour().getEightChar());
      if (ec !== label(c)) bad.push(`${y}-${m}-${d} ${h}:${mi} ${label(c)} vs ${ec}`);
      const cl = ChildLimit.fromSolarTime(st, g === 'M' ? Gender.MAN : Gender.WOMAN);
      const s = c.luck.start;
      if (cl.getYearCount() !== s.years || cl.getMonthCount() !== s.months || cl.getDayCount() !== s.days) bad.push(`luck ${y}-${m}-${d} ${h}:${mi} ${g}`);
    }
    expect(bad).toEqual([]);
  }, 120000);

  it('节令边界：每个节令前后 1 分钟，逐节令比对（含 23:00 边界）', () => {
    const bad: string[] = [];
    for (const year of [1902, 1949, 1986, 2000, 2024, 2050, 2099]) {
      for (const t of jieInstantsAround(year)) {
        const c0 = civilFromEpoch(t.epochSec, 480);
        if (c0.y < 1902 || c0.y > 2099) continue;
        for (const dm of [-2, -1, 0, 1, 2]) {
          const c = civilFromEpoch(t.epochSec + dm * 60, 480);
          const mine = label(computeCharts(solarInput(c.y, c.m, c.d, c.hh, c.mm)).bazi);
          const lib = String(SolarTime.fromYmdHms(c.y, c.m, c.d, c.hh, c.mm, 0).getLunarHour().getEightChar());
          if (mine !== lib) bad.push(`${t.name} ${c.y}-${c.m}-${c.d} ${c.hh}:${c.mm} ${mine} vs ${lib}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('立春分界：2024-02-04 16:27 仍为癸卯年，16:28 起为甲辰年（立春 16:27:07，出生时间不含秒，16:27 视为交接前并触发边界提示）', () => {
    const a = computeCharts(solarInput(2024, 2, 4, 16, 27));
    expect(label(a.bazi).split(' ')[0]).toBe('癸卯');
    expect(a.resolved.flags.nearTermBoundary).toBe(true);
    expect(label(computeCharts(solarInput(2024, 2, 4, 16, 28)).bazi).split(' ')[0]).toBe('甲辰');
  });

  it('日界选项：晚子时两种规则下日柱与时干', () => {
    const a = computeCharts(solarInput(2024, 5, 15, 23, 30), { baziDayBoundary: 'zi23' }).bazi;
    const b = computeCharts(solarInput(2024, 5, 15, 23, 30), { baziDayBoundary: 'zi00' }).bazi;
    const next = computeCharts(solarInput(2024, 5, 16, 12, 0)).bazi;
    const same = computeCharts(solarInput(2024, 5, 15, 12, 0)).bazi;
    expect(a.pillars.day.jiazi).toBe(next.pillars.day.jiazi);
    expect(b.pillars.day.jiazi).toBe(same.pillars.day.jiazi);
    expect(a.pillars.hour.branch).toBe(0);
    expect(b.pillars.hour.branch).toBe(0);
    expect(a.pillars.hour.stem).not.toBe(b.pillars.hour.stem);
  });

  it('夏令时出生（1988-07-01 13:30 夏令时 = 标准 12:30）：时柱按 12:30 午时', () => {
    const c = computeCharts(solarInput(1988, 7, 1, 13, 30, 'M', { utcOffsetMinutes: 540, dstMinutes: 60 })).bazi;
    expect(BRANCHES[c.pillars.hour.branch]).toBe('午');
    const noDst = computeCharts(solarInput(1988, 7, 1, 13, 30)).bazi;
    expect(BRANCHES[noDst.pillars.hour.branch]).toBe('未');
  });
});

describe('八字表与规则', () => {
  it('十二长生：甲亥生、卯旺；乙午生、卯官、寅旺；壬申生、子旺；戊寅生（火土同宫）', () => {
    expect(longShengOf(sIdx('甲'), bIdx('亥'))).toBe('长生');
    expect(longShengOf(sIdx('甲'), bIdx('卯'))).toBe('帝旺');
    expect(longShengOf(sIdx('乙'), bIdx('午'))).toBe('长生');
    expect(longShengOf(sIdx('乙'), bIdx('卯'))).toBe('临官');
    expect(longShengOf(sIdx('乙'), bIdx('寅'))).toBe('帝旺');
    expect(longShengOf(sIdx('壬'), bIdx('申'))).toBe('长生');
    expect(longShengOf(sIdx('壬'), bIdx('子'))).toBe('帝旺');
    expect(longShengOf(sIdx('戊'), bIdx('寅'))).toBe('长生');
    expect(longShengOf(sIdx('癸'), bIdx('卯'))).toBe('长生');
  });
  it('十神：以甲为日主', () => {
    const dm = sIdx('甲');
    const got = STEMS.map((s) => tenGodOf(dm, sIdx(s)));
    expect(got).toEqual(['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印']);
    expect(tenGodOf(sIdx('乙'), sIdx('庚'))).toBe('正官');
    expect(tenGodOf(sIdx('丙'), sIdx('壬'))).toBe('七杀');
  });
  it('藏干表：十二地支抽查', () => {
    const name = (b: string) => HIDDEN_STEMS[bIdx(b)].map((s) => STEMS[s]).join('');
    expect(name('子')).toBe('癸');
    expect(name('寅')).toBe('甲丙戊');
    expect(name('巳')).toBe('丙庚戊');
    expect(name('午')).toBe('丁己');
    expect(name('亥')).toBe('壬甲');
    for (let b = 0; b < 12; b++) expect(HIDDEN_STEMS[b].length).toBeGreaterThanOrEqual(1);
  });
  it('空亡：甲子旬空戌亥；甲午旬空辰巳', () => {
    const c = computeCharts(solarInput(2024, 5, 15, 12, 0)).bazi;
    const dj = c.pillars.day.jiazi;
    const xun = dj - (dj % 10);
    expect(c.kongWang).toEqual([(xun + 10) % 12, (xun + 11) % 12]);
    expect(BRANCHES[(0 + 10) % 12] + BRANCHES[(0 + 11) % 12]).toBe('戌亥');
    expect(BRANCHES[(30 + 10) % 12] + BRANCHES[(30 + 11) % 12]).toBe('辰巳');
  });
  it('刑冲合害：抽查经典组合', () => {
    const rel = (pairs: [string, string][]) =>
      computeRelations(pairs.map(([s, b], i) => ({ pos: '年月日时'[i], stem: sIdx(s), branch: bIdx(b) }))).map((r) => r.type);
    expect(rel([['甲', '子'], ['庚', '午']])).toEqual(expect.arrayContaining(['天干相冲', '地支六冲']));
    expect(rel([['甲', '子'], ['己', '丑']])).toEqual(expect.arrayContaining(['天干五合', '地支六合']));
    expect(rel([['甲', '申'], ['甲', '子'], ['甲', '辰']])).toContain('地支三合');
    expect(rel([['甲', '寅'], ['甲', '巳'], ['甲', '申']])).toContain('三刑');
    expect(rel([['甲', '子'], ['甲', '卯']])).toContain('无礼之刑');
    expect(rel([['甲', '午'], ['甲', '午']])).toContain('自刑');
    expect(rel([['甲', '寅'], ['甲', '卯'], ['甲', '辰']])).toContain('地支三会');
    expect(rel([['甲', '申'], ['甲', '子']])).toContain('地支半合');
    expect(rel([['甲', '申'], ['甲', '子'], ['甲', '辰']])).not.toContain('地支半合');
    expect(rel([['甲', '寅'], ['甲', '巳']])).toContain('无恩之刑（不全）');
  });
});

describe('八字大运与流年', () => {
  it('样例：1990-06-15 10:30 男，庚午 壬午 辛亥 癸巳，阳男顺行，起运 7 岁 5 个月 2 天', () => {
    const c = computeCharts(solarInput(1990, 6, 15, 10, 30)).bazi;
    expect(label(c)).toBe('庚午 壬午 辛亥 癸巳');
    expect(c.luck.direction).toBe(1);
    expect(c.luck.referenceJie).toBe('小暑');
    expect(c.luck.start).toMatchObject({ years: 7, months: 5, days: 2 });
    expect(c.luck.cycles.slice(0, 3).map((x) => STEMS[x.stem] + BRANCHES[x.branch])).toEqual(['癸未', '甲申', '乙酉']);
    expect(c.luck.startDate).toEqual({ y: 1997, m: 11, d: 17 });
    expect(c.dayMaster).toMatchObject({ element: '金', yang: false });
  });
  it('阴男逆行：首步大运为月柱前一位', () => {
    const c = computeCharts(solarInput(1985, 3, 9, 10, 30)).bazi; // 乙丑年阴男
    expect(c.luck.direction).toBe(-1);
    expect(c.luck.cycles[0].jiazi).toBe((c.pillars.month.jiazi + 59) % 60);
  });
  it('流年：2024 甲辰，立春起，流月首月丙寅（五虎遁），十二月覆盖至小寒', () => {
    const c = computeCharts(solarInput(1990, 6, 15, 10, 30)).bazi;
    const y = baziYearLayer(c, 2024);
    expect(STEMS[y.stem] + BRANCHES[y.branch]).toBe('甲辰');
    expect(y.months).toHaveLength(12);
    expect(y.months[0].jie).toBe('立春');
    expect(STEMS[y.months[0].stem] + BRANCHES[y.months[0].branch]).toBe('丙寅');
    expect(y.months[11].jie).toBe('小寒');
    expect(STEMS[y.months[11].stem] + BRANCHES[y.months[11].branch]).toBe('丁丑');
    expect(y.activeLuck).not.toBeNull();
    for (let i = 1; i < 12; i++) expect(y.months[i].startEpochSec).toBeGreaterThan(y.months[i - 1].startEpochSec);
  });
  it('性质：旺衰、格局、用神候选总有输出且自洽', () => {
    fc.assert(fc.property(fc.integer({ min: 1902, max: 2099 }), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 28 }),
      fc.integer({ min: 0, max: 23 }), (y, m, d, h) => {
        const c = computeCharts(solarInput(y, m, d, h, 0)).bazi;
        expect(c.strength.ratio).toBeGreaterThan(0);
        expect(c.strength.ratio).toBeLessThan(1);
        expect(['偏强', '中和', '偏弱']).toContain(c.strength.candidate);
        expect(c.yongshen.length).toBeGreaterThan(0);
        for (const k of ['year', 'month', 'day', 'hour'] as const) expect(c.pillars[k].hidden.length).toBeGreaterThan(0);
        expect(c.pillars.day.stemTenGod).toBeNull();
      }), { numRuns: 200 });
  });
});
