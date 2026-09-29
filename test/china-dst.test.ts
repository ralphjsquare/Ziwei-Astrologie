import { describe, expect, it } from 'vitest';
import { chinaDstState } from '../src/calendar/china-dst';
import { civilFromDays, daysFromCivil } from '../src/calendar/civil';

// 与 Node 内置时区数据库（ICU）交叉核对：1986–1991 每一天，北京夏令时状态应一致
describe('中国夏令时表（1986–1991）与 IANA 数据交叉核对', () => {
  it('逐日逐时段一致（不含拨钟当日不确定小时）', () => {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', timeZoneName: 'longOffset', hour: 'numeric' });
    const bad: string[] = [];
    for (let d = daysFromCivil(1985, 12, 20); d <= daysFromCivil(1992, 1, 10); d++) {
      const { y, m, d: dd } = civilFromDays(d);
      for (const hh of [0, 4, 12, 20]) {
        const inst = new Date(Date.UTC(y, m - 1, dd, hh - 8, 0)); // 按标准时间 UTC+8 取一个确定时刻，再看当时是否处于夏令时
        const off = fmt.formatToParts(inst).find((p) => p.type === 'timeZoneName')!.value; // GMT+08:00 或 GMT+09:00
        const icuDst = off.includes('+09');
        const mine = chinaDstState(y, m, dd, (hh + (icuDst ? 1 : 0)) % 24);
        if ((mine === 'dst') !== icuDst && mine !== 'ambiguous' && mine !== 'nonexistent') bad.push(`${y}-${m}-${dd} ${hh}h`);
      }
    }
    expect(bad).toEqual([]);
  });
  it('拨钟当日的边界小时', () => {
    expect(chinaDstState(1988, 4, 17, 1)).toBe('standard');
    expect(chinaDstState(1988, 4, 17, 2)).toBe('nonexistent');
    expect(chinaDstState(1988, 4, 17, 3)).toBe('dst');
    expect(chinaDstState(1988, 4, 10, 12)).toBe('standard'); // 1988 年夏令时自 4 月 17 日起
    expect(chinaDstState(1988, 9, 11, 1)).toBe('dst');
    expect(chinaDstState(1988, 9, 11, 2)).toBe('ambiguous');
    expect(chinaDstState(1988, 9, 11, 3)).toBe('standard');
    expect(chinaDstState(1992, 7, 1, 12)).toBe('standard');
  });
});
