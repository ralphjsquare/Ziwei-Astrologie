// 命盘图形所需的统计量。只做“数量／区间”的描述，不打分，不判断好坏。
import { BRANCH_ELEMENT, STEM_ELEMENT, STEMS, BRANCHES, type Element } from '../core/ganzhi';
import { TEN_GODS, type TenGod } from '../bazi/tables';
import type { BaziChart } from '../bazi/types';
import type { ZiweiChart } from '../ziwei/types';

export const ELEMENTS: Element[] = ['木', '火', '土', '金', '水'];
const KEYS = ['year', 'month', 'day', 'hour'] as const;

/** 五行数量：A=四天干＋四地支（共八个字）；B=四天干＋全部藏干（地支改按其藏干计） */
export function elementCounts(bz: BaziChart): { eight: Record<Element, number>; withHidden: Record<Element, number> } {
  const zero = (): Record<Element, number> => ({ 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 });
  const eight = zero(), withHidden = zero();
  for (const k of KEYS) {
    const p = bz.pillars[k];
    eight[STEM_ELEMENT[p.stem]]++; eight[BRANCH_ELEMENT[p.branch]]++;
    withHidden[STEM_ELEMENT[p.stem]]++;
    for (const h of p.hidden) withHidden[STEM_ELEMENT[h.stem]]++;
  }
  return { eight, withHidden };
}

/** 十神数量：其余三个天干＋全部藏干（日主本身不计） */
export function tenGodCounts(bz: BaziChart): Record<TenGod, number> {
  const c = Object.fromEntries(TEN_GODS.map((g) => [g, 0])) as Record<TenGod, number>;
  for (const k of KEYS) {
    const p = bz.pillars[k];
    if (p.stemTenGod) c[p.stemTenGod]++;
    for (const h of p.hidden) c[h.tenGod]++;
  }
  return c;
}

export interface TimelineSeg { from: number; to: number; label: string; sub: string; current: boolean }
export interface Timeline { age: number; max: number; luck: TimelineSeg[]; decade: TimelineSeg[] }

/** 人生阶段时间轴：八字大运（实岁起讫）与紫微大限（虚岁起讫），以及指定流年对应的虚岁位置 */
export function lifeTimeline(z: ZiweiChart, bz: BaziChart, year: number): Timeline {
  const age = year - z.input.lunarYear + 1;
  const luck = bz.luck.cycles.map((c) => ({ from: c.startAge, to: c.endAge, label: STEMS[c.stem] + BRANCHES[c.branch], sub: c.stemTenGod, current: age - 1 >= c.startAge && age - 1 <= c.endAge }));
  const decade = [...z.palaces].sort((a, b) => a.decade.startAge - b.decade.startAge).map((p) => ({ from: p.decade.startAge, to: p.decade.endAge, label: `${BRANCHES[p.branch]}宫`, sub: p.name, current: age >= p.decade.startAge && age <= p.decade.endAge }));
  return { age, max: Math.min(100, Math.max(...luck.map((s) => s.to), 100)), luck, decade };
}
