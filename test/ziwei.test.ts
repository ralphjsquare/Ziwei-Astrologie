import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { astro } from 'iztro';
import { computeCharts, BRANCHES, STEMS, ziweiYearLayer } from '../src/index';
import { STAR_ORDER, effectiveLunarMonth, tianfuPosition, ziweiPosition } from '../src/ziwei/engine';
import { lunarToSolar, solarToLunar } from '../src/calendar/lunar';
import { addDays } from '../src/calendar/civil';
import { rng, solarInput } from './helpers';

const B = (s: string) => BRANCHES.indexOf(s as (typeof BRANCHES)[number]);

describe('L2 紫微安星：经典安紫微星表', () => {
  // 《紫微斗数全书》安紫微星诀所列各局逐日落宫（手工对照的经典表格行；来源与核验状态见 ADR-010）
  const rows: Record<number, string[]> = {
    2: ['丑', '寅', '寅', '卯', '卯', '辰', '辰', '巳', '巳', '午'],
    3: ['辰', '丑', '寅', '巳', '寅', '卯', '午', '卯', '辰', '未'],
  };
  for (const [bureau, list] of Object.entries(rows)) {
    it(`${bureau}局 初一至初十`, () => {
      list.forEach((b, i) => expect(BRANCHES[ziweiPosition(Number(bureau), i + 1)]).toBe(b));
    });
  }
  it('天府与紫微对称于寅申轴（十二宫全枚举）', () => {
    const expected = ['辰', '卯', '寅', '丑', '子', '亥', '戌', '酉', '申', '未', '午', '巳']; // 紫微在 子丑寅…亥 时天府所在
    for (let z = 0; z < 12; z++) expect(BRANCHES[tianfuPosition(z)]).toBe(expected[z]);
    for (let z = 0; z < 12; z++) expect(tianfuPosition(tianfuPosition(z))).toBe(z);
  });
  it('所有局数×农历日：紫微落宫合法，且商余定义自洽（全枚举）', () => {
    for (const n of [2, 3, 4, 5, 6]) for (let d = 1; d <= 30; d++) {
      const z = ziweiPosition(n, d);
      expect(z).toBeGreaterThanOrEqual(0);
      expect(z).toBeLessThan(12);
    }
    // 局数整除日：落在寅起第 d/n 宫
    for (const n of [2, 3, 4, 5, 6]) for (let d = n; d <= 30; d += n) expect(ziweiPosition(n, d)).toBe((2 + d / n - 1) % 12);
  });
  it('闰月取月规则', () => {
    expect(effectiveLunarMonth(5, true, 15, 'midMonth')).toBe(5);
    expect(effectiveLunarMonth(5, true, 16, 'midMonth')).toBe(6);
    expect(effectiveLunarMonth(5, true, 1, 'nextMonth')).toBe(6);
    expect(effectiveLunarMonth(5, true, 20, 'currentMonth')).toBe(5);
    expect(effectiveLunarMonth(12, true, 20, 'midMonth')).toBe(1);
    expect(effectiveLunarMonth(5, false, 20, 'nextMonth')).toBe(5);
  });
});

describe('紫微排盘：性质', () => {
  it('性质测试：任意出生输入下盘面结构合法', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1902, max: 2099 }), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }), fc.boolean(), (y, m, d, h, mi, male) => {
          const z = computeCharts(solarInput(y, m, d, h, mi, male ? 'M' : 'F')).ziwei;
          const names = z.palaces.map((p) => p.name);
          expect(new Set(names).size).toBe(12);
          expect(z.palaces.filter((p) => p.name === '命宫')[0].branch).toBe(z.mingBranch);
          expect(z.palaces.filter((p) => p.isBody).length).toBe(1);
          const all = z.palaces.flatMap((p) => p.stars.map((s) => s.name));
          expect(all.sort()).toEqual([...STAR_ORDER].sort()); // 每颗星恰出现一次
          expect(z.palaces.flatMap((p) => p.stars).filter((s) => s.transform).length).toBe(4);
          const ages = z.palaces.map((p) => p.decade.startAge).sort((a, b) => a - b);
          ages.forEach((a, i) => expect(a).toBe(z.fiveElementBureau.number + 10 * i));
          const zw = z.palaces.find((p) => p.stars.some((s) => s.name === '紫微'))!.branch;
          const tf = z.palaces.find((p) => p.stars.some((s) => s.name === '天府'))!.branch;
          expect((zw + tf) % 12).toBe(4); // 紫微天府对称于寅申轴
        }),
      { numRuns: 300 },
    );
  });
  it('蜕变关系：仅分钟变化（同一时辰内）盘面不变', () => {
    const a = computeCharts(solarInput(1985, 3, 9, 10, 0)).ziwei;
    const b = computeCharts(solarInput(1985, 3, 9, 10, 59)).ziwei;
    expect(a).toEqual(b);
  });
  it('确定性：同一输入连续 100 次哈希相同', () => {
    const h0 = computeCharts(solarInput(1990, 6, 15, 10, 30)).calculationHash;
    for (let i = 0; i < 100; i++) expect(computeCharts(solarInput(1990, 6, 15, 10, 30)).calculationHash).toBe(h0);
  });
  it('样例盘逐步核对（1990-06-15 10:30 男，手算）', () => {
    // 农历庚午年五月廿三；巳时；命宫丑（寅起五月顺至午，逆数巳时）；己丑纳音霹雳火→火六局；
    // 廿三：(23+1)/6=4，借数1为奇逆行：寅起第4宫为巳，逆一宫得辰；庚年四化 太阳禄 武曲权 太阴科 天同忌
    const z = computeCharts(solarInput(1990, 6, 15, 10, 30)).ziwei;
    expect(z.input).toMatchObject({ lunarYear: 1990, lunarMonth: 5, lunarDay: 23, hourBranch: 5 });
    expect(BRANCHES[z.mingBranch]).toBe('丑');
    expect(BRANCHES[z.bodyBranch]).toBe('亥');
    expect(z.fiveElementBureau.name).toBe('火六局');
    expect(BRANCHES[z.ziweiBranch]).toBe('辰');
    expect(z.decadeDirection).toBe(1);
    expect(z.fourTransforms).toMatchObject({ lu: '太阳', quan: '武曲', ke: '太阴', ji: '天同' });
    expect(STEMS[z.palaces[1].stem] + BRANCHES[1]).toBe('己丑');
  });
});

describe('紫微流年/流月', () => {
  it('年份超出支持范围时明确报错', () => {
    const z = computeCharts(solarInput(1990, 6, 15, 10, 30)).ziwei;
    expect(() => ziweiYearLayer(z, 2101)).toThrow(/outside supported range/);
    expect(() => ziweiYearLayer(z, 1900)).toThrow(/outside supported range/);
  });
  it('流年命宫为太岁所在宫；流年四化按当年天干；斗君与流月', () => {
    const z = computeCharts(solarInput(1990, 6, 15, 10, 30)).ziwei;
    const y = ziweiYearLayer(z, 2024); // 甲辰
    expect(STEMS[y.yearStem] + BRANCHES[y.yearBranch]).toBe('甲辰');
    expect(y.age).toBe(35);
    expect(y.decade?.startAge).toBe(36 - 10); // 命宫丑 6-15、寅 16-25、卯 26-35、辰 36-45 → 35 岁在卯限
    expect(y.transforms.map((t) => t.star + t.transform)).toEqual(['廉贞禄', '破军权', '武曲科', '太阳忌']);
    expect(y.flowPalaces[0].branch).toBe(y.yearBranch);
    expect(y.months).toHaveLength(12);
    expect(y.months[0].branch).toBe(y.douJunBranch);
  });
});

describe('L3 与独立实现（iztro）差分', () => {
  it('随机 300 盘：命宫身宫、宫干、大限、五行局、全部星曜落宫与四化一致', () => {
    const r = rng(20260929);
    const nameMap: Record<string, string> = { 仆役: '交友' };
    const bad: string[] = [];
    for (let k = 0; k < 300; k++) {
      const y = r.int(1902, 2099), m = r.int(1, 12), d = r.int(1, 28), h = r.int(0, 22), g = r.next() < 0.5 ? 'M' : 'F';
      const c = computeCharts(solarInput(y, m, d, h, r.int(0, 59), g)).ziwei;
      const a = astro.bySolar(`${y}-${m}-${d}`, Math.floor(((h + 1) % 24) / 2), g === 'M' ? '男' : '女', true, 'zh-CN');
      const iz = new Map<string, { b: number; mut: string }>();
      for (const p of a.palaces) for (const s of [...p.majorStars, ...p.minorStars, ...p.adjectiveStars]) iz.set(s.name, { b: B(p.earthlyBranch), mut: s.mutagen || '' });
      const errs: string[] = [];
      for (const p of c.palaces) {
        const ip = a.palaces.find((x) => x.earthlyBranch === BRANCHES[p.branch])!;
        if ((nameMap[ip.name] ?? ip.name) !== p.name) errs.push('name');
        if (ip.heavenlyStem !== STEMS[p.stem]) errs.push('stem');
        if (ip.decadal.range[0] !== p.decade.startAge) errs.push('decade');
        if (ip.isBodyPalace !== p.isBody) errs.push('body');
      }
      for (const nm of STAR_ORDER) {
        if (c.yearStem === 7 && (nm === '天魁' || nm === '天钺')) continue; // 辛年魁钺两说并存：iztro 取“马虎”，本项目默认《全书》“虎马”（ADR-010）
        const mine = c.palaces.find((p) => p.stars.some((s) => s.name === nm))!;
        const i = iz.get(nm);
        if (!i || i.b !== mine.branch) errs.push(`star ${nm}`);
        if (c.yearStem !== 8 && i && i.mut !== (mine.stars.find((s) => s.name === nm)!.transform ?? '')) errs.push(`mut ${nm}`); // 壬年：iztro 取“辅”，本项目默认《全书》“府”（ADR-010）
      }
      if (a.fiveElementsClass !== c.fiveElementBureau.name) errs.push('bureau');
      if (errs.length) bad.push(`${y}-${m}-${d} ${h}h ${g}: ${errs.join(',')}`);
    }
    expect(bad).toEqual([]);
  }, 180000);

  it('流年命宫、流月（斗君法）、流年四化、大限宫位：与 iztro 逐项一致（40 盘 × 4 个流月）', () => {
    const r = rng(31337);
    const bad: string[] = [];
    for (let k = 0; k < 40; k++) {
      const y = r.int(1930, 2060), m = r.int(1, 12), d = r.int(1, 28), h = r.int(1, 22), g = k % 2 ? 'F' : 'M';
      const c = computeCharts(solarInput(y, m, d, h, 0, g)).ziwei;
      const a = astro.bySolar(`${y}-${m}-${d}`, Math.floor(((h + 1) % 24) / 2), g === 'M' ? '男' : '女', true, 'zh-CN');
      const fy = r.int(y + 1, y + 50);
      const zl = ziweiYearLayer(c, fy);
      for (const lm of [1, 4, 8, 12]) {
        const sd = lunarToSolar({ year: fy, month: lm, leap: false, day: 10 });
        const hz = a.horoscope(`${sd.y}-${sd.m}-${sd.d}`, 6);
        const br = (i: number) => B(a.palaces[i].earthlyBranch);
        if (br(hz.monthly.index) !== zl.months[lm - 1].branch) bad.push(`month ${y}-${m}-${d} fy${fy} lm${lm}`);
        if (br(hz.yearly.index) !== zl.flowMingBranch) bad.push(`year ${y}-${m}-${d} fy${fy}`);
        if (zl.decade && br(hz.decadal.index) !== zl.decade.branch) bad.push(`decade ${y}-${m}-${d} fy${fy}`);
        if (zl.yearStem !== 8 && JSON.stringify(hz.yearly.mutagen) !== JSON.stringify(zl.transforms.map((t) => t.star))) bad.push(`mutagen ${fy}`);
      }
    }
    expect(bad).toEqual([]);
  }, 180000);

  it('晚子时：与 iztro 的差异仅限农历月末跨月或闰月（ADR-004），其余一致', () => {
    // iztro 对晚子时只把"日"推后一天而月份保持不变；本项目按次日完整农历日期处理（'zi23'）。
    const cases = [[1938, 9, 17], [1991, 4, 14], [1933, 2, 23], [1909, 12, 12]];
    for (const [y, m, d] of cases) {
      const next = addDays({ y, m, d }, 1);
      const l0 = solarToLunar(y, m, d), l1 = solarToLunar(next.y, next.m, next.d);
      expect(l1.month !== l0.month || l1.leap !== l0.leap || l0.leap).toBe(true); // 均为跨农历月或闰月的晚子时
    }
    // 不跨月的晚子时与 iztro 一致
    const r = rng(7);
    for (let k = 0; k < 60; k++) {
      const y = r.int(1902, 2099), m = r.int(1, 12), d = r.int(1, 28);
      const next = addDays({ y, m, d }, 1);
      const l0 = solarToLunar(y, m, d), l1 = solarToLunar(next.y, next.m, next.d);
      if (l1.month !== l0.month || l1.leap !== l0.leap || l0.leap) continue;
      const c = computeCharts(solarInput(y, m, d, 23, 30)).ziwei;
      const a = astro.bySolar(`${y}-${m}-${d}`, 12, '男', true, 'zh-CN');
      const iz = a.palaces.find((p) => p.majorStars.some((s) => s.name === '紫微'))!;
      expect(BRANCHES[c.ziweiBranch]).toBe(iz.earthlyBranch);
    }
  });
});
