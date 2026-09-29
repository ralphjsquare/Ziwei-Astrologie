// 三方印证：除历法库 tyme4ts 与 iztro 之外，再引入独立实现 js-ephemeris-lite / ziwei-lite / bazi-lite
// （另一套天文模型 VSOP2013/ELP-MPP02 与另一套排盘代码）。三者一致才算有力印证；差异要么修正，要么记为流派差异（ADR-006/008/010）。
import { describe, expect, it } from 'vitest';
import { ZonedTime, getQiShuoYear } from 'js-ephemeris-lite';
import { ZiweiChart, ZiweiOptions, ZIWEI_GENDER, ZIWEI_RULE_OPTION, STAR_CATALOG, FLOW_MONTH_PALACE_STRATEGY } from 'ziwei-lite';
import { BaziChart, BaziOptions, GENDER, pillarName } from 'bazi-lite';
import { describeFourPillars } from 'js-ephemeris-lite';
import { BRANCHES, STEMS, computeCharts } from '../src/index';
import { termInstants, TERM_NAMES, solarToLunar } from '../src/calendar/lunar';
import { civilFromDays, daysFromCivil } from '../src/calendar/civil';
import { solarToLunar as jsSolarToLunar } from 'js-ephemeris-lite';
import { STAR_ORDER } from '../src/ziwei/engine';
import { ziweiYearLayer } from '../src/index';
import { lunarToSolar } from '../src/calendar/lunar';
import { rng, solarInput } from './helpers';

describe('节气：与独立天文模型 js-ephemeris-lite 比对', () => {
  it('1902–2025 年节气时刻相差 ≤ 6 秒（实测最大 3 秒）；2026–2100 年（ΔT 预测区间）≤ 120 秒', () => {
    let maxPast = 0, maxFuture = 0, n = 0;
    for (let y = 1902; y <= 2100; y++) {
      const ev = getQiShuoYear(y, { mode: 'china-astronomical', utcOffsetMinutes: 480, lunarPhaseAnglesDeg: [0] }).events.filter((e) => e.kind === 'solar-term');
      const ts = termInstants(y);
      for (const e of ev) {
        const i = (TERM_NAMES as readonly string[]).indexOf(e.name as string);
        if (i < 1) continue; // 序号 0 属上一年冬至，另年核对
        const l = e.localTime!;
        const js = Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute, 0) / 1000 + l.second - 8 * 3600;
        const d = Math.abs(ts[i].epochSec - js);
        n++;
        if (y <= 2025) maxPast = Math.max(maxPast, d); else maxFuture = Math.max(maxFuture, d);
      }
    }
    expect(n).toBeGreaterThan(4500);
    expect(maxPast).toBeLessThanOrEqual(6);
    expect(maxFuture).toBeLessThanOrEqual(120);
  });
});

describe('农历：与独立天文历法 js-ephemeris-lite（historical 模式）比对', () => {
  it('1901–2100 全部 2400 余个农历月首日与月序、闰月一致，仅 2097 年一例（新月在零点后 15 秒，ΔT 不确定度内）', () => {
    // 离线全量核对结果（73,049 天逐日）：仅 2097-08-07 至 2097-09-05 共 30 天与 js-ephemeris-lite 相差一天，同一个新月；见 ADR-008。
    const opts = { mode: 'historical', utcOffsetMinutes: 480 } as const;
    const bad: string[] = [];
    let n = 0;
    for (let d = daysFromCivil(1901, 2, 1); d <= daysFromCivil(2100, 11, 30); d++) {
      const c = civilFromDays(d);
      const l = solarToLunar(c.y, c.m, c.d);
      if (l.day !== 1) continue;
      n++;
      const a = jsSolarToLunar({ year: c.y, month: c.m, day: c.d }, opts);
      const p = civilFromDays(d - 1);
      const b = jsSolarToLunar({ year: p.y, month: p.m, day: p.d }, opts);
      const ok = a.day === 1 && a.month === l.month && !!a.isLeap === l.leap && a.year === l.year && b.day >= 29;
      if (!ok) bad.push(`${c.y}-${c.m}-${c.d}`);
    }
    expect(n).toBeGreaterThan(2400);
    expect(bad).toEqual(['2097-8-7']);
  }, 180000);
});

const KEY: Record<string, string> = { ziwei: '紫微', tianji: '天机', taiyang: '太阳', wuqu: '武曲', tiantong: '天同', lianzhen: '廉贞', tianfu: '天府', taiyin: '太阴', tanlang: '贪狼', jumen: '巨门', tianxiang: '天相', tianliang: '天梁', qisha: '七杀', pojun: '破军', zuofu: '左辅', youbi: '右弼', wenchang: '文昌', wenqu: '文曲', tiankui: '天魁', tianyue: '天钺', lucun: '禄存', tianma: '天马', qingyang: '擎羊', tuoluo: '陀罗', huoxing: '火星', lingxing: '铃星', dikong: '地空', dijie: '地劫', hongluan: '红鸾', tianxi: '天喜' };
const OPT = [ZIWEI_RULE_OPTION.OPTION_1, ZIWEI_RULE_OPTION.OPTION_2, ZIWEI_RULE_OPTION.OPTION_3, ZIWEI_RULE_OPTION.OPTION_4];
const ID2NAME = new Map<number, string>(STAR_CATALOG.map((s) => [s.id, KEY[s.key]]));

function zlChart(y: number, m: number, d: number, h: number, mi: number, g: 'M' | 'F', rules?: object) {
  const birth = new ZonedTime({ year: y, month: m, day: d, hour: h, minute: mi, second: 0, offsetMinutes: 480 });
  const c = ZiweiChart.fromZonedTime(birth, new ZiweiOptions({ gender: g === 'M' ? ZIWEI_GENDER.MALE : ZIWEI_GENDER.FEMALE, ...(rules ? { rules } : {}) } as never));
  return JSON.parse(JSON.stringify(c)) as {
    anchors: { bureau: number }; palaces: { branch: number; stem: number; name: string; isBodyPalace: boolean; stars: { key: string; natal: boolean; transformations: { scope: string; kind: string }[] }[] }[];
    birthYearTransformations: { lu: number; quan: number; ke: number; ji: number };
  };
}

describe('紫微：与独立实现 ziwei-lite 比对', () => {
  it('随机 400 盘：局、命宫、身宫、宫干、二十六颗星落宫、生年四化一致（辛年魁钺为已知流派差异，见下）', () => {
    const r = rng(2024), bad: string[] = [];
    for (let k = 0; k < 400; k++) {
      const y = r.int(1902, 2099), m = r.int(1, 12), d = r.int(1, 28), h = r.int(0, 23), mi = r.int(0, 59), g = k % 2 ? 'F' : 'M';
      const c = computeCharts(solarInput(y, m, d, h, mi, g)).ziwei;
      const z = zlChart(y, m, d, h, mi, g);
      const errs: string[] = [];
      if ([2, 3, 4, 5, 6][z.anchors.bureau] !== c.fiveElementBureau.number) errs.push('bureau');
      if (z.palaces.find((p) => p.name === '命宫')!.branch !== c.mingBranch) errs.push('ming');
      if (z.palaces.find((p) => p.isBodyPalace)!.branch !== c.bodyBranch) errs.push('body');
      const pos: Record<string, number> = {};
      for (const p of z.palaces) {
        if (p.stem !== c.palaces[p.branch].stem) errs.push('stem');
        for (const s of p.stars) if (s.natal && KEY[s.key]) pos[KEY[s.key]] = p.branch;
      }
      for (const nm of STAR_ORDER) {
        if (c.yearStem === 7 && (nm === '天魁' || nm === '天钺')) continue;
        if (pos[nm] !== c.palaces.find((p) => p.stars.some((x) => x.name === nm))!.branch) errs.push(nm);
      }
      const t = z.birthYearTransformations;
      const theirs = [t.lu, t.quan, t.ke, t.ji].map((id) => ID2NAME.get(id));
      const mine = [c.fourTransforms.lu, c.fourTransforms.quan, c.fourTransforms.ke, c.fourTransforms.ji];
      if (JSON.stringify(theirs) !== JSON.stringify(mine)) errs.push('sihua');
      if (errs.length) bad.push(`${y}-${m}-${d} ${h}:${mi} ${g}: ${errs.join(',')}`);
    }
    expect(bad).toEqual([]);
  }, 120000);

  it('大限、流年命宫、流月（斗君法）、流限：与 ziwei-lite 一致（100 盘；流月按月序、闰月不单列，对应其 EFFECTIVE_MONTH 策略）', () => {
    // ziwei-lite 默认按“含闰月的时序”推进流月命宫，本项目按农历月序（闰月随所属月），两者只在当年有闰月时不同（ADR-010）。
    const r = rng(5150), bad: string[] = [];
    for (let k = 0; k < 100; k++) {
      const y = r.int(1930, 2060), m = r.int(1, 12), d = r.int(1, 28), h = r.int(0, 23), g = k % 2 ? 'F' : 'M';
      const c = computeCharts(solarInput(y, m, d, h, 10, g)).ziwei;
      const z = ZiweiChart.fromZonedTime(new ZonedTime({ year: y, month: m, day: d, hour: h, minute: 10, second: 0, offsetMinutes: 480 }),
        new ZiweiOptions({ gender: g === 'M' ? ZIWEI_GENDER.MALE : ZIWEI_GENDER.FEMALE, flowMonthPalaceStrategy: FLOW_MONTH_PALACE_STRATEGY.EFFECTIVE_MONTH } as never));
      for (const dd of z.timeline().getDecades()) {
        const p = c.palaces.find((pp) => pp.decade.startAge === dd.startAge);
        if (!p || p.branch !== dd.branch || p.decade.endAge !== dd.endAge) bad.push(`decade ${y}-${m}-${d} ${dd.startAge}`);
      }
      const fy = Math.min(2098, r.int(y + 1, y + 50));
      const zl = ziweiYearLayer(c, fy);
      for (const lm of [2, 5, 9]) {
        const sd = lunarToSolar({ year: fy, month: lm, leap: false, day: 12 });
        const f = z.resolveFlow(new ZonedTime({ year: sd.y, month: sd.m, day: sd.d, hour: 12, minute: 0, second: 0, offsetMinutes: 480 })) as unknown as
          { year: { limit: { coordinate: { branch: number } } }; month: { limit: { coordinate: { branch: number } } }; decade: { limit: { coordinate: { branch: number } } } };
        if (f.year.limit.coordinate.branch !== zl.flowMingBranch) bad.push(`flowyear ${y}-${m}-${d} ${fy}`);
        if (f.month.limit.coordinate.branch !== zl.months[lm - 1].branch) bad.push(`flowmonth ${y}-${m}-${d} ${fy} m${lm}`);
        const dm = c.palaces.find((p) => zl.age >= p.decade.startAge && zl.age <= p.decade.endAge);
        if (dm && f.decade.limit.coordinate.branch !== dm.branch) bad.push(`flowdecade ${y}-${m}-${d} ${fy}`);
      }
    }
    expect(bad).toEqual([]);
  }, 120000);

  it('辛年天魁天钺：iztro 取魁午钺寅，ziwei-lite 取魁寅钺午——两说并存，均可由选项复现', () => {
    for (const [y, m, d] of [[1991, 5, 5], [2001, 8, 8], [2031, 12, 4]]) {
      const zl = zlChart(y, m, d, 10, 0, 'M');
      const at = (nm: string, key: string) => zl.palaces.find((p) => p.stars.some((s) => s.key === key))!.branch;
      const a = computeCharts(solarInput(y, m, d, 10, 0), { kuiYueXin: 'hu-ma' }).ziwei;
      const b = computeCharts(solarInput(y, m, d, 10, 0), { kuiYueXin: 'ma-hu' }).ziwei;
      const find = (z: typeof a, n: string) => z.palaces.find((p) => p.stars.some((s) => s.name === n))!.branch;
      expect(find(a, '天魁')).toBe(at('天魁', 'tiankui'));
      expect(find(a, '天钺')).toBe(at('天钺', 'tianyue'));
      expect(BRANCHES[find(b, '天魁')] + BRANCHES[find(b, '天钺')]).toBe('午寅');
      expect(BRANCHES[find(a, '天魁')] + BRANCHES[find(a, '天钺')]).toBe('寅午');
    }
  });

  it('四化版本：戊（2 种）、庚（4 种）、壬（2 种）、癸（2 种）与 ziwei-lite 的各版本逐一对应', () => {
    const cases: [string, number, number, string, number][] = [ // 天干名, 天干序号, 版本数, ziwei-lite 规则键, 一个该天干的年份
      ['戊', 4, 2, 'wu', 1998], ['庚', 6, 4, 'geng', 2000], ['壬', 8, 2, 'ren', 2002], ['癸', 9, 2, 'gui', 2003],
    ];
    for (const [name, , n, key, year] of cases) {
      for (let v = 1; v <= n; v++) {
        const z = zlChart(year, 6, 20, 10, 0, 'M', { sihua: { [key]: OPT[v - 1] } });
        const t = z.birthYearTransformations;
        const theirs = [t.lu, t.quan, t.ke, t.ji].map((id) => ID2NAME.get(id));
        const c = computeCharts(solarInput(year, 6, 20, 10, 0), { sihua: { [name]: v } as never }).ziwei;
        expect([c.fourTransforms.lu, c.fourTransforms.quan, c.fourTransforms.ke, c.fourTransforms.ji], `${name}${v}`).toEqual(theirs);
      }
    }
    expect(() => computeCharts(solarInput(2000, 6, 20, 10, 0), { sihua: { 庚: 9 } as never })).toThrow(/variant/);
  });
});

describe('八字：与独立实现 bazi-lite 比对（严格天文口径）', () => {
  it('随机 2000 个出生时刻：四柱、大运方向一致；起运年月日 2044 年以前完全一致，其后（ΔT 预测区）相差不超过 1 天', () => {
    const r = rng(77), bad: string[] = [];
    let strictN = 0;
    for (let k = 0; k < 2000; k++) {
      const y = r.int(1902, 2099), m = r.int(1, 12), d = r.int(1, 28), h = r.int(0, 23), mi = r.int(0, 59), g = k % 2 ? 'F' : 'M';
      const c = computeCharts(solarInput(y, m, d, h, mi, g)).bazi;
      const b = BaziChart.fromZonedTime(new ZonedTime({ year: y, month: m, day: d, hour: h, minute: mi, second: 0, offsetMinutes: 480 }),
        new BaziOptions({ gender: g === 'M' ? GENDER.MALE : GENDER.FEMALE, mode: 'china-astronomical', pillarHistoricalMode: 'off' } as never));
      const p = describeFourPillars(b.pillars);
      const mine = (['year', 'month', 'day', 'hour'] as const).map((kk) => STEMS[c.pillars[kk].stem] + BRANCHES[c.pillars[kk].branch]);
      if (mine.join() !== [p.year, p.month, p.day, p.hour].join()) { bad.push(`pillars ${y}-${m}-${d} ${h}:${mi}`); continue; }
      const q = b.getQiYun();
      const o = q.traditionalOffset;
      if (q.direction !== c.luck.direction) bad.push(`dir ${y}-${m}-${d}`);
      const dd = (o.years * 360 + o.months * 30 + o.days) - (c.luck.start.years * 360 + c.luck.start.months * 30 + c.luck.start.days);
      if (y < 2044) { strictN++; if (dd !== 0) bad.push(`luck ${y}-${m}-${d} ${h}:${mi} diff ${dd}d`); }
      else if (Math.abs(dd) > 1) bad.push(`luck-future ${y}-${m}-${d} diff ${dd}d`);
    }
    expect(strictN).toBeGreaterThan(1000);
    expect(bad).toEqual([]);
  }, 120000);

  it('大运序列与起运公历年：600 盘与 bazi-lite 一致', () => {
    const r = rng(8), bad: string[] = [];
    for (let k = 0; k < 600; k++) {
      const y = r.int(1902, 2040), m = r.int(1, 12), d = r.int(1, 28), h = r.int(0, 23), mi = r.int(0, 59), g = k % 2 ? 'F' : 'M';
      const c = computeCharts(solarInput(y, m, d, h, mi, g)).bazi;
      const b = BaziChart.fromZonedTime(new ZonedTime({ year: y, month: m, day: d, hour: h, minute: mi, second: 0, offsetMinutes: 480 }),
        new BaziOptions({ gender: g === 'M' ? GENDER.MALE : GENDER.FEMALE, mode: 'china-astronomical', pillarHistoricalMode: 'off' } as never));
      (b.getDaYunTable() as unknown as { pillar: number; startCivilTime: { year: number } }[]).slice(0, 8).forEach((row, i) => {
        if (pillarName(row.pillar) !== STEMS[c.luck.cycles[i].stem] + BRANCHES[c.luck.cycles[i].branch]) bad.push(`cycle ${y}-${m}-${d} #${i}`);
        if (row.startCivilTime.year !== c.luck.cycles[i].startYear) bad.push(`year ${y}-${m}-${d} #${i}`);
      });
    }
    expect(bad).toEqual([]);
  }, 120000);

  it('1929 年以前：bazi-lite 默认“历史模式”按历书以日为界，本项目按天文时刻——已知口径差异，仅出现在节令当天', () => {
    // 1958-04-05 05:27 早于清明（15:12）：天文口径仍为乙卯月；历书以日为界口径为丙辰月（见 ADR-008）
    const mine = computeCharts(solarInput(1958, 4, 5, 5, 27)).bazi;
    expect(STEMS[mine.pillars.month.stem] + BRANCHES[mine.pillars.month.branch]).toBe('乙卯');
    const b = BaziChart.fromZonedTime(new ZonedTime({ year: 1958, month: 4, day: 5, hour: 5, minute: 27, second: 0, offsetMinutes: 480 }), new BaziOptions({ gender: GENDER.MALE }));
    expect(describeFourPillars(b.pillars).month).toBe('丙辰');
  });
});
