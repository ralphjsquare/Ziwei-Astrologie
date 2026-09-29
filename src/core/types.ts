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

/** 紫微四化版本：天干 → 版本序号（1 起，默认 1，即《全书》原文）。可选天干：戊、庚、壬、癸（见 ADR-010）。 */
export type SihuaVariants = Partial<Record<'戊' | '庚' | '壬' | '癸', number>>;

export interface Options {
  trueSolarTime: boolean;
  baziDayBoundary: DayBoundary;
  ziweiDayBoundary: DayBoundary;
  leapMonthRule: LeapMonthRule;
  /** 辛年天魁天钺：'hu-ma' 魁寅钺午（“六辛逢虎马”，《紫微斗数全书》卷二安天魁天钺诀，默认）；'ma-hu' 魁午钺寅（“六辛逢马虎”，iztro 等软件采用）。 */
  kuiYueXin: 'hu-ma' | 'ma-hu';
  sihua: SihuaVariants;
  /** 大限起宫：'ming' 命宫起限（通行，默认）；'literal' 《全书》大限诀字面读法——阳男阴女从命前一宫（父母宫）起顺行，阴男阳女从命后一宫（兄弟宫）起逆行。 */
  decadeStart: 'ming' | 'literal';
}

export const DEFAULT_OPTIONS: Options = {
  trueSolarTime: false,
  baziDayBoundary: 'zi23',
  ziweiDayBoundary: 'zi23',
  leapMonthRule: 'midMonth',
  kuiYueXin: 'hu-ma',
  sihua: {},
  decadeStart: 'ming',
};

export const CHINA_STANDARD_PLACE: Place = { utcOffsetMinutes: 480, dstMinutes: 0 };
