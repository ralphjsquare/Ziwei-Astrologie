import { BRANCHES, STEMS, jiaziIndex, mod, nayinName, yinMonthStem } from '../core/ganzhi';
import { jieInstantsAround } from '../calendar/lunar';
import { civilFromEpoch } from '../calendar/civil';
import { tenGodOf } from './engine-util';
import { computeRelations, relationsInvolving } from './relations';
import { HIDDEN_STEMS, type TenGod } from './tables';
import type { BaziChart, LuckCycle, Relation } from './types';

export interface BaziMonthLayer { jie: string; startEpochSec: number; stem: number; branch: number; nayin: string; stemTenGod: TenGod }
export interface BaziYearLayer {
  year: number; stem: number; branch: number; nayin: string;
  startEpochSec: number; // 立春
  stemTenGod: TenGod; hiddenTenGods: { stem: number; tenGod: TenGod }[];
  activeLuck: LuckCycle | null;
  relations: Relation[]; // 涉及流年、大运的合冲刑害
  months: BaziMonthLayer[];
}

/** 八字流年、流月。year 为流年标签（立春至下一立春）。 */
export function baziYearLayer(c: BaziChart, year: number): BaziYearLayer {
  const idx = mod(year - 4, 60);
  const stem = idx % 10, branch = idx % 12;
  const dm = c.dayMaster.stem;
  const jie = [...jieInstantsAround(year), ...jieInstantsAround(year + 1)]
    .filter((j, i, a) => a.findIndex((x) => x.epochSec === j.epochSec) === i)
    .sort((a, b) => a.epochSec - b.epochSec);
  const start = jie.find((j) => j.name === '立春' && civilFromEpoch(j.epochSec, 480).y === year)!;
  const from = jie.indexOf(start);
  const months: BaziMonthLayer[] = [];
  for (let k = 0; k < 12; k++) {
    const j = jie[from + k];
    const st = (yinMonthStem(stem) + k) % 10;
    const br = j.branch!;
    months.push({ jie: j.name, startEpochSec: j.epochSec, stem: st, branch: br, nayin: nayinName(jiaziIndex(st, br)), stemTenGod: tenGodOf(dm, st) });
  }
  const luck = c.luck.cycles.find((x) => year >= x.startYear && year < x.startYear + 10) ?? null;
  const p = c.pillars;
  const units = [
    { pos: '年', stem: p.year.stem, branch: p.year.branch }, { pos: '月', stem: p.month.stem, branch: p.month.branch },
    { pos: '日', stem: p.day.stem, branch: p.day.branch }, { pos: '时', stem: p.hour.stem, branch: p.hour.branch },
  ];
  const extra = [{ pos: '流年', stem, branch }];
  if (luck) extra.unshift({ pos: '大运', stem: luck.stem, branch: luck.branch });
  const rels = relationsInvolving(computeRelations([...units, ...extra]), extra.map((x) => x.pos));
  return {
    year, stem, branch, nayin: nayinName(idx), startEpochSec: start.epochSec, stemTenGod: tenGodOf(dm, stem),
    hiddenTenGods: HIDDEN_STEMS[branch].map((s) => ({ stem: s, tenGod: tenGodOf(dm, s) })),
    activeLuck: luck, relations: rels, months,
  };
}
export const ganzhiLabel = (stem: number, branch: number) => STEMS[stem] + BRANCHES[branch];
