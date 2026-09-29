import { describe, expect, it } from 'vitest';
import { SolarDay } from 'tyme4ts';
import { civilFromDays, daysFromCivil, dayPillarIndex, isValidCivil } from '../src/calendar/civil';
import { OutOfRangeError, lunarToSolar, solarToLunar, termInstants, TERM_NAMES } from '../src/calendar/lunar';
import { InputError, resolveBirth, shichenOfHour } from '../src/calendar/resolve';
import { DEFAULT_OPTIONS, CHINA_STANDARD_PLACE, type BirthInput } from '../src/core/types';
import { jiaziName } from '../src/core/ganzhi';
import { civilFromEpoch } from '../src/calendar/civil';
import { astroLunarMonths, astroTermEpochSec } from '../tools/astro-terms';
import exceptions from './fixtures/lunar-exceptions.json';

const D0 = daysFromCivil(1901, 1, 1), D1 = daysFromCivil(2100, 12, 31);

describe('L1 历法：公历算术与干支', () => {
  it('公历日期算术往返一致（1900–2101 每一天）', () => {
    for (let d = daysFromCivil(1900, 1, 1); d <= daysFromCivil(2101, 12, 31); d++) {
      const c = civilFromDays(d);
      expect(daysFromCivil(c.y, c.m, c.d)).toBe(d);
    }
    expect(isValidCivil(2023, 2, 29)).toBe(false);
    expect(isValidCivil(2024, 2, 29)).toBe(true);
  });

  it('日柱：1901–2100 每一天与历法库一致，且六十甲子连续递增', () => {
    let prev = -1;
    for (let d = D0; d <= D1; d++) {
      const c = civilFromDays(d);
      const mine = dayPillarIndex(c.y, c.m, c.d);
      if (prev >= 0) expect(mine).toBe((prev + 1) % 60);
      prev = mine;
      if (d % 7 === 0) expect(jiaziName(mine)).toBe(String(SolarDay.fromYmd(c.y, c.m, c.d).getSixtyCycleDay().getSixtyCycle()));
    }
    expect(jiaziName(dayPillarIndex(2000, 1, 1))).toBe('戊午');
    expect(jiaziName(dayPillarIndex(1900, 1, 1))).toBe('甲戌');
  });

  it('农历↔公历：1901–2100 每一天往返一致，日数 1..30', () => {
    for (let d = D0; d <= D1; d++) {
      const c = civilFromDays(d);
      const l = solarToLunar(c.y, c.m, c.d);
      expect(l.day).toBeGreaterThanOrEqual(1);
      expect(l.day).toBeLessThanOrEqual(30);
      expect(lunarToSolar(l)).toEqual({ y: c.y, m: c.m, d: c.d });
    }
  });
});

describe('L1 历法：与独立天文算法核对', () => {
  it('节气：1901–2100 共 4799 个节气时刻，与天文算法相差 ≤ 90 秒（实测最大 62 秒，见 ADR-008）', () => {
    let max = 0;
    for (let y = 1901; y <= 2100; y++) {
      const ts = termInstants(y);
      for (let i = 0; i < 24; i++) {
        if (y === 1901 && i === 0) continue;
        max = Math.max(max, Math.abs(ts[i].epochSec - astroTermEpochSec(y, i)));
      }
    }
    expect(max).toBeLessThanOrEqual(90);
  });

  it('农历月：1901–2100 全部农历月首日、月序、闰月与天文推算一致，仅有 5 个已裁决例外', () => {
    const ast = astroLunarMonths(1901, 2100, astroTermEpochSec);
    const lib = new Map<number, string>();
    for (let d = D0; d <= D1; d++) {
      const c = civilFromDays(d);
      const l = solarToLunar(c.y, c.m, c.d);
      if (l.day === 1) lib.set(d, l.month + (l.leap ? 'L' : ''));
    }
    const lo = daysFromCivil(1901, 3, 1), hi = daysFromCivil(2100, 10, 1);
    const mism: string[] = [];
    let compared = 0;
    for (const m of ast) {
      if (m.startDay < lo || m.startDay > hi) continue;
      compared++;
      if (lib.get(m.startDay) !== m.month + (m.leap ? 'L' : '')) {
        const c = civilFromDays(m.startDay);
        mism.push(`${c.y}-${c.m}-${c.d}`);
      }
    }
    expect(compared).toBeGreaterThan(2400);
    expect(mism).toEqual(exceptions.exceptions);
  });

  it('节气名称与顺序', () => {
    const ts = termInstants(2024);
    expect(ts.map((t) => t.name)).toEqual([...TERM_NAMES]);
    for (let i = 1; i < 24; i++) expect(ts[i].epochSec).toBeGreaterThan(ts[i - 1].epochSec);
  });
});

const solar = (y: number, m: number, d: number, hh: number, mm: number, place = CHINA_STANDARD_PLACE): BirthInput =>
  ({ calendar: 'solar', year: y, month: m, day: d, hour: hh, minute: mm, gender: 'M', place });

describe('时辰与日界（D04 字段变化表）', () => {
  it('时辰以整点为界：23:00 起子时', () => {
    const table: [number, number][] = [[23, 0], [0, 0], [1, 1], [2, 1], [3, 2], [12, 6], [13, 7], [21, 11], [22, 11]];
    for (const [h, s] of table) expect(shichenOfHour(h)).toBe(s);
  });

  it('D04 表：22:59、23:00、23:59、00:00、00:59、01:00 在两种日界下的字段', () => {
    const rows = [[22, 59], [23, 0], [23, 59], [0, 0], [0, 59], [1, 0]] as const;
    const out: Record<string, string> = {};
    for (const [h, m] of rows) {
      const day = h <= 1 ? 16 : 15; // 0:xx、1:00 取 16 日，其余取 15 日
      const a = resolveBirth(solar(2024, 5, day, h, m), { ...DEFAULT_OPTIONS, baziDayBoundary: 'zi23', ziweiDayBoundary: 'zi23' });
      const b = resolveBirth(solar(2024, 5, day, h, m), { ...DEFAULT_OPTIONS, baziDayBoundary: 'zi00', ziweiDayBoundary: 'zi00' });
      out[`${h}:${m}`] = `${a.shichen}|${a.baziDate.d}|${b.baziDate.d}|${a.lateZi}`;
    }
    expect(out).toEqual({
      '22:59': '11|15|15|false',
      '23:0': '0|16|15|true',
      '23:59': '0|16|15|true',
      '0:0': '0|16|16|false',
      '0:59': '0|16|16|false',
      '1:0': '1|16|16|false',
    });
  });

  it('夏令时：扣除夏令时后按标准时间定时辰（1988-07-01 13:30 夏令时 = 标准 12:30）', () => {
    const r = resolveBirth(solar(1988, 7, 1, 13, 30, { utcOffsetMinutes: 540, dstMinutes: 60 }), DEFAULT_OPTIONS);
    expect(r.effective.hh).toBe(12);
    expect(r.shichen).toBe(6);
  });

  it('真太阳时：默认关闭；开启需经度；东经 120° 附近校正量即均时差', () => {
    expect(() => resolveBirth(solar(2024, 5, 15, 12, 0), { ...DEFAULT_OPTIONS, trueSolarTime: true })).toThrow(InputError);
    const off = resolveBirth(solar(2024, 5, 15, 12, 0), DEFAULT_OPTIONS);
    expect(off.trueSolarAdjustSeconds).toBe(0);
    const on = resolveBirth(solar(2024, 5, 15, 12, 0, { ...CHINA_STANDARD_PLACE, longitude: 120 }), { ...DEFAULT_OPTIONS, trueSolarTime: true });
    expect(Math.abs(on.trueSolarAdjustSeconds)).toBeLessThan(6 * 60); // 5 月中旬均时差约 +3.7 分钟
    const west = resolveBirth(solar(2024, 5, 15, 12, 0, { ...CHINA_STANDARD_PLACE, longitude: 87.6 }), { ...DEFAULT_OPTIONS, trueSolarTime: true });
    expect(west.trueSolarAdjustSeconds).toBeLessThan(-120 * 60); // 乌鲁木齐约晚 2 小时余
  });

  it('输入校验与范围', () => {
    expect(() => resolveBirth(solar(2023, 2, 29, 1, 0), DEFAULT_OPTIONS)).toThrow(InputError);
    expect(() => resolveBirth(solar(2023, 2, 28, 24, 0), DEFAULT_OPTIONS)).toThrow(InputError);
    expect(() => resolveBirth(solar(1900, 6, 1, 1, 0), DEFAULT_OPTIONS)).toThrow(OutOfRangeError);
    expect(() => resolveBirth(solar(2101, 1, 1, 1, 0), DEFAULT_OPTIONS)).toThrow(OutOfRangeError);
    expect(() => resolveBirth({ ...solar(2023, 1, 1, 1, 0), calendar: 'lunar', month: 2, day: 30, leap: true }, DEFAULT_OPTIONS)).toThrow(InputError);
  });

  it('节气边界提示：立春前后 2 分钟内标记 nearTermBoundary', () => {
    const t = termInstants(2024)[3]; // 2024 立春，北京时间 16:27:07
    expect(t.name).toBe('立春');
    const std = solar(2024, 2, 4, 16, 27);
    const r = resolveBirth(std, DEFAULT_OPTIONS);
    expect(r.flags.nearestJie).toBe('立春');
    expect(r.flags.nearTermBoundary).toBe(true);
    expect(r.flags.termOnSameDay).toBe(true);
    const far = resolveBirth(solar(2024, 2, 20, 12, 0), DEFAULT_OPTIONS);
    expect(far.flags.nearTermBoundary).toBe(false);
    expect(far.flags.termOnSameDay).toBe(false);
  });

  it('1929 年以前放宽到 20 分钟（历书按北京地方时推算节令）', () => {
    const t = termInstants(1927)[9]; // 1927 立夏 20:53
    const c = civilFromEpoch(t.epochSec - 10 * 60, 480);
    expect(resolveBirth(solar(c.y, c.m, c.d, c.hh, c.mm), DEFAULT_OPTIONS).flags.nearTermBoundary).toBe(true);
    const c2 = civilFromEpoch(termInstants(1990)[9].epochSec - 10 * 60, 480);
    expect(resolveBirth(solar(c2.y, c2.m, c2.d, c2.hh, c2.mm), DEFAULT_OPTIONS).flags.nearTermBoundary).toBe(false);
  });

  it('农历输入：含闰月换算', () => {
    const r = resolveBirth({ ...solar(2023, 1, 1, 10, 0), calendar: 'lunar', year: 2023, month: 2, day: 5, leap: true }, DEFAULT_OPTIONS);
    expect([r.clock.y, r.clock.m, r.clock.d]).toEqual([2023, 3, 26]);
    expect(r.clockLunar).toEqual({ year: 2023, month: 2, leap: true, day: 5 });
  });
});
