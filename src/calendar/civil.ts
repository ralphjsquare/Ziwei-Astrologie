// 公历日期算术（不使用 Date，避免环境时区与 ICU 版本影响）。
import { mod } from '../core/ganzhi';

export interface Civil { y: number; m: number; d: number; hh: number; mm: number; ss: number }

/** 自 1970-01-01 起的天数（Howard Hinnant 算法，先验公历） */
export function daysFromCivil(y: number, m: number, d: number): number {
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function civilFromDays(z: number): { y: number; m: number; d: number } {
  z += 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return { y: y + (m <= 2 ? 1 : 0), m, d };
}

export function isValidCivil(y: number, m: number, d: number): boolean {
  if (![y, m, d].every(Number.isInteger) || m < 1 || m > 12 || d < 1) return false;
  const c = civilFromDays(daysFromCivil(y, m, d));
  return c.y === y && c.m === m && c.d === d;
}

/** 把"墙上时间"按偏移换算为 UTC 纪元秒 */
export function epochFromLocal(c: Civil, offsetMinutes: number): number {
  return daysFromCivil(c.y, c.m, c.d) * 86400 + c.hh * 3600 + c.mm * 60 + c.ss - offsetMinutes * 60;
}

/** UTC 纪元秒加偏移后拆成公历时间 */
export function civilFromEpoch(epochSec: number, offsetMinutes: number): Civil {
  const local = epochSec + offsetMinutes * 60;
  const days = Math.floor(local / 86400);
  const rem = local - days * 86400;
  const { y, m, d } = civilFromDays(days);
  return { y, m, d, hh: Math.floor(rem / 3600), mm: Math.floor((rem % 3600) / 60), ss: rem % 60 };
}

/** 儒略日数（当日正午，整数） */
export const julianDayNumber = (y: number, m: number, d: number): number => daysFromCivil(y, m, d) + 2440588;

/** 日柱六十甲子序号：以 2000-01-01（戊午，序号 54）为锚点 */
export const dayPillarIndex = (y: number, m: number, d: number): number => mod(julianDayNumber(y, m, d) - 2451545 + 54, 60);

export const addDays = (c: { y: number; m: number; d: number }, n: number) => civilFromDays(daysFromCivil(c.y, c.m, c.d) + n);
