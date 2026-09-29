// 农历与节气：对历法库 tyme4ts 的唯一适配层。其余模块不得直接引用该库。
import { SolarDay, LunarDay, SolarTerm } from 'tyme4ts';
import { epochFromLocal } from './civil';
import corrections from './hko-corrections.json';

export const SUPPORTED_MIN_YEAR = 1901;
export const SUPPORTED_MAX_YEAR = 2100;

export class OutOfRangeError extends Error {}
export function assertSupportedYear(y: number): void {
  if (!Number.isInteger(y) || y < SUPPORTED_MIN_YEAR || y > SUPPORTED_MAX_YEAR) {
    throw new OutOfRangeError(`year ${y} outside supported range ${SUPPORTED_MIN_YEAR}-${SUPPORTED_MAX_YEAR}`);
  }
}

export interface LunarDate { year: number; month: number; leap: boolean; day: number }

/** 历法库的原始结果（未做官方数据校正），仅供生成校正表与测试使用 */
export function libSolarToLunar(y: number, m: number, d: number): LunarDate {
  const ld = SolarDay.fromYmd(y, m, d).getLunarDay();
  const lm = ld.getLunarMonth();
  return { year: lm.getYear(), month: lm.getMonth(), leap: lm.isLeap(), day: ld.getDay() };
}

// 官方数据校正：与香港天文台《公历与农历日期对照表》逐日核对后，历法库与官方不一致的日子以官方为准（tools/hko.ts 生成；见 ADR-002）。
type Corr = { entries: [[number, number, number], [number, number, boolean, number]][]; invalidLunar: [number, number, boolean, number][] };
const CORR = corrections as unknown as Corr;
const bySolar = new Map(CORR.entries.map(([s, l]) => [s.join('-'), { year: l[0], month: l[1], leap: l[2], day: l[3] } as LunarDate]));
const byLunar = new Map(CORR.entries.map(([s, l]) => [l.join('-'), { y: s[0], m: s[1], d: s[2] }]));
const invalid = new Set(CORR.invalidLunar.map((l) => l.join('-')));
const lkey = (l: LunarDate) => [l.year, l.month, l.leap, l.day].join('-');

export function solarToLunar(y: number, m: number, d: number): LunarDate {
  return bySolar.get(`${y}-${m}-${d}`) ?? libSolarToLunar(y, m, d);
}

export function lunarToSolar(l: LunarDate): { y: number; m: number; d: number } {
  const hit = byLunar.get(lkey(l));
  if (hit) return hit;
  if (invalid.has(lkey(l))) throw new RangeError(`lunar date ${lkey(l)} does not exist in the official calendar`);
  const s = LunarDay.fromYmd(l.year, l.leap ? -l.month : l.month, l.day).getSolarDay();
  return { y: s.getYear(), m: s.getMonth(), d: s.getDay() };
}

/** 该农历月的天数（用于输入校验） */
export function lunarMonthDays(year: number, month: number, leap: boolean): number {
  if (byLunar.has([year, month, leap, 30].join('-'))) return 30;
  if (invalid.has([year, month, leap, 30].join('-'))) return 29;
  return LunarDay.fromYmd(year, leap ? -month : month, 1).getLunarMonth().getDayCount();
}

/** 二十四节气，序号 0 为上一年冬至，与 tyme4ts 一致 */
export const TERM_NAMES = [
  '冬至', '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种',
  '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪',
] as const;

export interface TermInstant { name: string; index: number; jie: boolean; branch: number | null; epochSec: number }

/** 十二节令对应的月支（子=0）：小寒→丑 … 大雪→子 */
const JIE_BRANCH: Record<number, number> = { 1: 1, 3: 2, 5: 3, 7: 4, 9: 5, 11: 6, 13: 7, 15: 8, 17: 9, 19: 10, 21: 11, 23: 0 };

const cache = new Map<number, TermInstant[]>();
/** 某公历年内的 24 个节气时刻（UTC 纪元秒；历法库按北京时间 UTC+8 给出）。冬至（序号 0）属上一年 12 月。 */
export function termInstants(year: number): TermInstant[] {
  const hit = cache.get(year);
  if (hit) return hit;
  const out: TermInstant[] = [];
  for (let i = 0; i < 24; i++) {
    const t = SolarTerm.fromIndex(year, i).getJulianDay().getSolarTime();
    const epochSec = epochFromLocal(
      { y: t.getYear(), m: t.getMonth(), d: t.getDay(), hh: t.getHour(), mm: t.getMinute(), ss: t.getSecond() },
      480,
    );
    out.push({ name: TERM_NAMES[i], index: i, jie: i in JIE_BRANCH, branch: i in JIE_BRANCH ? JIE_BRANCH[i] : null, epochSec });
  }
  cache.set(year, out);
  return out;
}

/** 出生前后三年的全部节令（12 节），按时间升序 */
export function jieInstantsAround(year: number): TermInstant[] {
  const all: TermInstant[] = [];
  for (const y of [year - 1, year, year + 1]) {
    for (const t of termInstants(y)) if (t.jie && !all.some((x) => x.epochSec === t.epochSec)) all.push(t);
  }
  return all.sort((a, b) => a.epochSec - b.epochSec);
}
