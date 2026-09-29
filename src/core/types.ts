export type Gender = 'M' | 'F';
export type DayBoundary = 'zi23' | 'zi00'; // 23:00 起算次日 / 00:00 起算次日
export type LeapMonthRule = 'midMonth' | 'currentMonth' | 'nextMonth';

export interface Place {
  /** 出生地钟表时间相对 UTC 的总偏移（分钟，含夏令时），如北京时间 480，1988 年夏令时期间 540 */
  utcOffsetMinutes: number;
  /** 其中夏令时部分（分钟，0 或 60）；排盘时从钟表时间中扣除 */
  dstMinutes: number;
  /** 出生地东经（度，东正西负）；开启真太阳时时必填 */
  longitude?: number;
}

export interface BirthInput {
  calendar: 'solar' | 'lunar';
  year: number;
  month: number;
  day: number;
  /** 农历输入时是否闰月 */
  leap?: boolean;
  hour: number;
  minute: number;
  gender: Gender;
  place: Place;
}

export interface Options {
  trueSolarTime: boolean;
  baziDayBoundary: DayBoundary;
  ziweiDayBoundary: DayBoundary;
  leapMonthRule: LeapMonthRule;
}

export const DEFAULT_OPTIONS: Options = {
  trueSolarTime: false,
  baziDayBoundary: 'zi23',
  ziweiDayBoundary: 'zi23',
  leapMonthRule: 'midMonth',
};

export const CHINA_STANDARD_PLACE: Place = { utcOffsetMinutes: 480, dstMinutes: 0 };
