import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { lunarDayFromName, lunarMonthFromName, parseHkoLunarText, parseHkoTerms } from '../tools/hko-parse';
import { solarToLunar } from '../src/calendar/lunar';

describe('香港天文台数据解析器（用合成样例验证，真实格式待核对）', () => {
  it('农历日、月名称', () => {
    expect([lunarDayFromName('初一'), lunarDayFromName('十五'), lunarDayFromName('二十'), lunarDayFromName('廿三'), lunarDayFromName('三十')]).toEqual([1, 15, 20, 23, 30]);
    expect([lunarMonthFromName('正'), lunarMonthFromName('十一'), lunarMonthFromName('臘')]).toEqual([1, 11, 12]);
  });
  it('逐行解析：含月名的行与仅含日名的行，闰月标记', () => {
    const t = ['2023年3月22日 星期三 閏二月初一', '2023年3月23日 星期四 初二', '2024年2月10日 星期六 正月初一 春節'].join('\n');
    const r = parseHkoLunarText(t);
    expect(r.days).toEqual([
      { y: 2023, m: 3, d: 22, lunarMonth: 2, leap: true, lunarDay: 1 },
      { y: 2023, m: 3, d: 23, lunarMonth: 2, leap: true, lunarDay: 2 },
      { y: 2024, m: 2, d: 10, lunarMonth: 1, leap: false, lunarDay: 1 },
    ]);
  });
  it('节气：日期、时分、名称（名称在前或在后）', () => {
    const r = parseHkoTerms('2024年2月4日 16時27分 立春\n<td>2024-05-05 08:10</td><td>立夏</td>');
    expect(r[0]).toMatchObject({ y: 2024, m: 2, d: 4, hh: 16, mm: 27, name: '立春' });
    expect(r[1]).toMatchObject({ y: 2024, m: 5, d: 5, hh: 8, mm: 10, name: '立夏' });
  });
});

const FIX = 'test/fixtures/hko/lunar.json';
describe.skipIf(!existsSync(FIX))('与香港天文台公历农历对照表逐日核对（需先运行 npm run hko:fetch && npm run hko:import）', () => {
  it('全部日期的农历月、闰月、日与 HKO 一致', () => {
    const f = JSON.parse(readFileSync(FIX, 'utf8')) as { days: number; data: Record<string, [number, boolean, number]> };
    expect(f.days).toBeGreaterThan(70000);
    const bad: string[] = [];
    for (const [k, [lm, leap, ld]] of Object.entries(f.data)) {
      const [y, m, d] = k.split('-').map(Number);
      const l = solarToLunar(y, m, d);
      if (l.month !== lm || l.leap !== leap || l.day !== ld) bad.push(k);
    }
    expect(bad).toEqual([]);
  });
});
