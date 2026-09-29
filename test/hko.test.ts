import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { lunarDayFromName, lunarMonthFromName, parseHkoLunarText, parseHkoTerms, resolveHkoDays } from '../tools/hko-parse';
import { lunarMonthDays, lunarToSolar, solarToLunar, termInstants } from '../src/calendar/lunar';
import { civilFromDays, civilFromEpoch, daysFromCivil } from '../src/calendar/civil';

describe('香港天文台数据解析器（用合成样例验证，真实格式待核对）', () => {
  it('农历日、月名称', () => {
    expect([lunarDayFromName('初一'), lunarDayFromName('十五'), lunarDayFromName('二十'), lunarDayFromName('廿三'), lunarDayFromName('三十')]).toEqual([1, 15, 20, 23, 30]);
    expect([lunarMonthFromName('正'), lunarMonthFromName('十一'), lunarMonthFromName('臘')]).toEqual([1, 11, 12]);
  });
  it('逐行解析：农历月初一显示月名（含閏月）、其余显示日名、末列为节气（真实格式，2023/2024 年文件）', () => {
    const t = [
      '2024(甲辰 - 肖龍)年公曆與農曆日期對照表', '', '公曆日期              農曆日期    星期        節氣',
      '2024年1月6日          廿五        星期六      小寒    ',
      '2024年1月11日         十二月      星期四              ',
      '2024年1月12日         初二        星期五              ',
      '2023年3月22日         閏二月      星期三              ',
    ].join('\n');
    const r = parseHkoLunarText(t);
    expect(r.skipped).toBe(0);
    expect(r.rows).toEqual([
      { y: 2024, m: 1, d: 6, monthStart: null, lunarDay: 25, term: '小寒' },
      { y: 2024, m: 1, d: 11, monthStart: { month: 12, leap: false }, lunarDay: 1, term: null },
      { y: 2024, m: 1, d: 12, monthStart: null, lunarDay: 2, term: null },
      { y: 2023, m: 3, d: 22, monthStart: { month: 2, leap: true }, lunarDay: 1, term: null },
    ]);
    // 合并：沿用最近一次月初的月份，月初之前月份未知则跳过
    expect(resolveHkoDays(r.rows.slice(0, 3)).map((x) => `${x.key}:${x.lunarMonth}/${x.lunarDay}`)).toEqual(['2024-1-11:12/1', '2024-1-12:12/2']);
  });
  it('节气：日期、时分、名称（名称在前或在后）', () => {
    const r = parseHkoTerms('2024年2月4日 16時27分 立春\n<td>2024-05-05 08:10</td><td>立夏</td>');
    expect(r[0]).toMatchObject({ y: 2024, m: 2, d: 4, hh: 16, mm: 27, name: '立春' });
    expect(r[1]).toMatchObject({ y: 2024, m: 5, d: 5, hh: 8, mm: 10, name: '立夏' });
  });
});

const FIX = 'test/fixtures/hko/lunar.json';
describe.skipIf(!existsSync(FIX))('与香港天文台《公历与农历日期对照表》逐日核对（数据由 npm run hko:fetch && hko:import 生成）', () => {
  const f = existsSync(FIX) ? (JSON.parse(readFileSync(FIX, 'utf8')) as { days: number; data: Record<string, [number, boolean, number]>; terms: Record<string, string> }) : null;

  it('1901–2100 全部 73,030 天（官方表自 1901-01-20 起可确定月份）的农历月、闰月、日与官方一致', () => {
    expect(f!.days).toBeGreaterThan(73000);
    const bad: string[] = [];
    for (const [k, [lm, leap, ld]] of Object.entries(f!.data)) {
      const [y, m, d] = k.split('-').map(Number);
      const l = solarToLunar(y, m, d);
      if (l.month !== lm || l.leap !== leap || l.day !== ld) bad.push(k);
    }
    expect(bad).toEqual([]);
  });

  it('官方校正表：历法库与官方仅 2057-09-28 至 2057-10-27 共 30 天不同（新月在北京时间零点前后 40 秒内，未来预测），以官方为准', () => {
    const corr = JSON.parse(readFileSync('src/calendar/hko-corrections.json', 'utf8')) as { entries: [number[], unknown][]; invalidLunar: unknown[] };
    expect(corr.entries.map((e) => e[0].join('-'))).toEqual(Array.from({ length: 30 }, (_, i) => { const d = civilFromDays(daysFromCivil(2057, 9, 28) + i); return `${d.y}-${d.m}-${d.d}`; }));
    expect(corr.invalidLunar).toEqual([[2057, 8, false, 30]]);
    // 校正后互为反函数
    expect(lunarToSolar({ year: 2057, month: 9, leap: false, day: 1 })).toEqual({ y: 2057, m: 9, d: 28 });
    expect(lunarMonthDays(2057, 8, false)).toBe(29);
    expect(lunarMonthDays(2057, 9, false)).toBe(30);
    expect(() => lunarToSolar({ year: 2057, month: 8, leap: false, day: 30 })).toThrow(/does not exist/);
  });

  it('农历与公历互逆：1901–2100 每一天经校正后往返一致', () => {
    for (let d = daysFromCivil(1901, 1, 1); d <= daysFromCivil(2100, 12, 31); d++) {
      const c = civilFromDays(d);
      const l = solarToLunar(c.y, c.m, c.d);
      expect(lunarToSolar(l)).toEqual({ y: c.y, m: c.m, d: c.d });
    }
  });

  it('节气日期：官方约 4797 个节气日与本项目节气（北京时间日期）一致；仅允许 1929 年前（地方时）与零点边界的例外', () => {
    const NAMES_T = ['冬至', '小寒', '大寒', '立春', '雨水', '驚蟄', '春分', '清明', '穀雨', '立夏', '小滿', '芒種', '夏至', '小暑', '大暑', '立秋', '處暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪'];
    const bad: string[] = [];
    let n = 0;
    for (let y = 1901; y <= 2100; y++) {
      const ts = termInstants(y);
      for (let i = 0; i < 24; i++) {
        if (y === 1901 && i <= 1) continue; // 官方表自 1901-01-20 起（此前月份不可确定）
        const c = civilFromEpoch(ts[i].epochSec, 480);
        const key = `${c.y}-${c.m}-${c.d}`;
        const off = (c.hh * 3600 + c.mm * 60 + c.ss);
        const official = f!.terms[key];
        n++;
        if (official === NAMES_T[i]) continue;
        // 官方节气日与本项目相差一天：2100 年前的未来预测允许零点前后 90 秒；1929 年以前官方按当时北京地方时（约 UTC+7:45）推算，允许零点前后 20 分钟（ADR-008）
        const tol = c.y < 1929 ? 20 * 60 : 90;
        if (off <= tol || off >= 86400 - tol) continue;
        bad.push(`${key} ${NAMES_T[i]} official=${official}`);
      }
    }
    expect(n).toBeGreaterThan(4700);
    expect(bad).toEqual([]);
  });
});
