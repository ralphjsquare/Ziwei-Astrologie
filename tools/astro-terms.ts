// 独立天文参照：用 astronomy-engine 求太阳视黄经 15° 倍数的时刻（UTC 纪元秒）。仅用于测试与核对，不进入运行时。
import * as Astronomy from 'astronomy-engine';

/** 序号与 tyme4ts 一致：0=上年冬至(270°)，1=小寒(285°)…23=大雪(255°) */
export const termLongitude = (index: number): number => (270 + 15 * index) % 360;

export function astroTermEpochSec(year: number, index: number): number {
  const lon = termLongitude(index);
  // 搜索起点取该节气常年日期前 20 天左右
  const approxMonthDay = [[-1, 12, 22], [0, 1, 6], [0, 1, 20], [0, 2, 4], [0, 2, 19], [0, 3, 6], [0, 3, 21], [0, 4, 5], [0, 4, 20], [0, 5, 6], [0, 5, 21], [0, 6, 6],
    [0, 6, 21], [0, 7, 7], [0, 7, 23], [0, 8, 7], [0, 8, 23], [0, 9, 8], [0, 9, 23], [0, 10, 8], [0, 10, 23], [0, 11, 7], [0, 11, 22], [0, 12, 7]][index];
  const start = new Date(Date.UTC(year + approxMonthDay[0], approxMonthDay[1] - 1, approxMonthDay[2] - 12));
  const t = Astronomy.SearchSunLongitude(lon, start, 40);
  if (!t) throw new Error('no term found');
  return Math.round(t.date.getTime() / 1000);
}

/** 朔（新月）时刻，UTC 纪元秒，返回 [from, to) 范围内所有新月 */
export function astroNewMoons(fromEpochSec: number, toEpochSec: number): number[] {
  const out: number[] = [];
  let t = Astronomy.SearchMoonPhase(0, new Date(fromEpochSec * 1000), 40);
  while (t && t.date.getTime() / 1000 < toEpochSec) {
    out.push(Math.round(t.date.getTime() / 1000));
    t = Astronomy.SearchMoonPhase(0, new Date(t.date.getTime() + 20 * 86400000), 40);
  }
  return out;
}

export interface AstroMonth { startDay: number; /* 自 1970-01-01 起的北京日 */ month: number; leap: boolean }

/** 独立推算农历月：朔日按 UTC+8 取日；月序由中气定，无中气的月为闰月。仅对 [year0, year1] 年内起始的月有效。 */
export function astroLunarMonths(year0: number, year1: number, termEpoch: (y: number, i: number) => number): AstroMonth[] {
  const DAY = 86400, OFF = 8 * 3600;
  const dayOf = (sec: number) => Math.floor((sec + OFF) / DAY);
  const moons = astroNewMoons(Date.UTC(year0 - 1, 9, 1) / 1000, Date.UTC(year1 + 2, 2, 1) / 1000).map(dayOf);
  // 中气：冬至(序号0)、大寒(2)、雨水(4)…（偶数序号）。以含冬至的月为十一月，逐月编号；
  // 冬至到下一冬至之间若有 13 个月，则第一个不含中气的月为闰月。
  const zhongqiDays: number[] = [];
  const winterDays: number[] = [];
  for (let y = year0 - 1; y <= year1 + 2; y++) {
    for (let i = 0; i < 24; i += 2) {
      const day = dayOf(termEpoch(y, i));
      zhongqiDays.push(day);
      if (i === 0) winterDays.push(day);
    }
  }
  const hasZq = (k: number) => zhongqiDays.some((d) => d >= moons[k] && d < moons[k + 1]);
  const winterMonth = (k: number) => winterDays.some((d) => d >= moons[k] && d < moons[k + 1]);
  const out: AstroMonth[] = [];
  const winterIdx: number[] = [];
  for (let k = 0; k + 1 < moons.length; k++) if (winterMonth(k)) winterIdx.push(k);
  for (let w = 0; w + 1 < winterIdx.length; w++) {
    const a0 = winterIdx[w], a1 = winterIdx[w + 1];
    const n = a1 - a0;
    let leapAt = -1;
    if (n === 13) {
      for (let k = a0 + 1; k < a1; k++) if (!hasZq(k)) { leapAt = k; break; }
    }
    let m = 11;
    for (let k = a0; k < a1; k++) {
      if (k === leapAt) { out.push({ startDay: moons[k], month: m, leap: true }); continue; }
      if (k > a0) m = (m % 12) + 1;
      out.push({ startDay: moons[k], month: m, leap: false });
    }
  }
  return out;
}
