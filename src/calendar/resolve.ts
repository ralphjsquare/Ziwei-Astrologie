// 把用户输入解析为排盘所需的统一时间（公历钟表时间、UTC 时刻、有效时间、时辰、日界）。
import { mod } from '../core/ganzhi';
import type { BirthInput, Options } from '../core/types';
import { addDays, civilFromEpoch, epochFromLocal, isValidCivil, type Civil } from './civil';
import { equationOfTimeSeconds } from './eot';
import { assertSupportedYear, jieInstantsAround, lunarMonthDays, lunarToSolar, solarToLunar, type LunarDate } from './lunar';

export interface ResolvedBirth {
  /** 钟表时间对应的公历日期时间（用户输入，农历输入则已换算） */
  clock: Civil;
  /** 出生时刻，UTC 纪元秒 */
  utcSec: number;
  /** 去除夏令时后的标准钟表时间；开启真太阳时则为真太阳时 */
  effective: Civil;
  trueSolarAdjustSeconds: number; // 未开启则为 0
  /** 时辰 0..11（子=0），以整点为界：23:00 起子时 */
  shichen: number;
  /** 有效时间落在 23:00–24:00（晚子时） */
  lateZi: boolean;
  /** 八字日柱所用日期（按日界规则可能为有效日期的次日） */
  baziDate: { y: number; m: number; d: number };
  /** 紫微所用农历日期（同上按日界规则） */
  ziweiLunar: LunarDate;
  /** 用户输入对应的农历日期（无日界调整，供展示） */
  clockLunar: LunarDate;
  flags: { termOnSameDay: boolean; nearTermBoundary: boolean; nearestJie: string; nearestJieMinutes: number };
}

export class InputError extends Error {}

export function shichenOfHour(hour: number): number {
  return Math.floor(mod(hour + 1, 24) / 2);
}

export function resolveBirth(input: BirthInput, opt: Options): ResolvedBirth {
  const { hour, minute, place } = input;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new InputError('hour must be 0..23');
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) throw new InputError('minute must be 0..59');
  if (!Number.isFinite(place.utcOffsetMinutes)) throw new InputError('utcOffsetMinutes required');
  if (opt.trueSolarTime && (place.longitude === undefined || !Number.isFinite(place.longitude))) {
    throw new InputError('trueSolarTime requires longitude');
  }

  let sy = input.year, sm = input.month, sd = input.day;
  if (input.calendar === 'lunar') {
    assertSupportedYear(input.year);
    const leap = !!input.leap;
    if (input.month < 1 || input.month > 12 || input.day < 1) throw new InputError('invalid lunar date');
    let days: number;
    try { days = lunarMonthDays(input.year, input.month, leap); } catch { throw new InputError('invalid lunar month'); }
    if (input.day > days) throw new InputError('invalid lunar day');
    ({ y: sy, m: sm, d: sd } = lunarToSolar({ year: input.year, month: input.month, leap, day: input.day }));
  } else if (!isValidCivil(sy, sm, sd)) throw new InputError('invalid solar date');
  assertSupportedYear(sy);

  const clock: Civil = { y: sy, m: sm, d: sd, hh: hour, mm: minute, ss: 0 };
  const utcSec = epochFromLocal(clock, place.utcOffsetMinutes);
  const stdOffset = place.utcOffsetMinutes - place.dstMinutes;

  const stdSec = utcSec + stdOffset * 60;
  let effSec = stdSec;
  if (opt.trueSolarTime) {
    // 真太阳时 = 协调世界时 + 经度×4分钟 + 均时差
    effSec = utcSec + Math.round(place.longitude! * 4 * 60) + equationOfTimeSeconds(utcSec);
  }
  const tst = effSec - stdSec;
  const effective = civilFromEpoch(effSec, 0);
  const shichen = shichenOfHour(effective.hh);
  const lateZi = effective.hh === 23;

  const shifted = (b: 'zi23' | 'zi00') => (lateZi && b === 'zi23' ? addDays(effective, 1) : { y: effective.y, m: effective.m, d: effective.d });
  const baziDate = shifted(opt.baziDayBoundary);
  const zd = shifted(opt.ziweiDayBoundary);
  assertSupportedYear(baziDate.y);
  assertSupportedYear(zd.y);

  const jie = jieInstantsAround(clock.y);
  let nearest = jie[0];
  for (const j of jie) if (Math.abs(j.epochSec - utcSec) < Math.abs(nearest.epochSec - utcSec)) nearest = j;
  const stdDay = civilFromEpoch(utcSec, stdOffset);
  const termOnSameDay = jie.some((j) => {
    const c = civilFromEpoch(j.epochSec, stdOffset);
    return c.y === stdDay.y && c.m === stdDay.m && c.d === stdDay.d;
  });
  // 1929 年以前历书按北京地方时（约 UTC+7:45）推算节令，与现代 UTC+8 口径最多相差约 15 分钟，故放宽提示范围
  const diffMin = (utcSec - nearest.epochSec) / 60;

  return {
    clock, utcSec, effective, trueSolarAdjustSeconds: tst, shichen, lateZi, baziDate,
    ziweiLunar: solarToLunar(zd.y, zd.m, zd.d),
    clockLunar: solarToLunar(clock.y, clock.m, clock.d),
    flags: { termOnSameDay, nearTermBoundary: Math.abs(diffMin) <= (clock.y < 1929 ? 20 : 2), nearestJie: nearest.name, nearestJieMinutes: Math.round(diffMin * 10) / 10 },
  };
}
