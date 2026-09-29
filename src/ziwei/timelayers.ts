import { BRANCHES, STEMS, mod } from '../core/ganzhi';
import { SIHUA } from './tables';
import type { Palace, PalaceName, Transform, ZiweiChart } from './types';
import { PALACE_NAMES } from './types';

export interface FlowStarTransform { star: string; transform: Transform; natalPalace: PalaceName; branch: number }
export interface FlowMonth { month: number; branch: number; natalPalace: PalaceName; stars: string[] }
export interface ZiweiYearLayer {
  year: number; age: number; // 虚岁（以农历年计）
  yearStem: number; yearBranch: number;
  decade: { branch: number; palaceName: PalaceName; startAge: number; endAge: number } | null; // 起限前为 null
  flowMingBranch: number;
  flowPalaces: { name: PalaceName; branch: number; natalName: PalaceName }[]; // 以流年命宫重排的十二宫
  transforms: FlowStarTransform[];
  douJunBranch: number;
  months: FlowMonth[];
  steps: string[];
}

const findStar = (c: ZiweiChart, star: string): Palace | undefined => c.palaces.find((p) => p.stars.some((s) => s.name === star));

/** 紫微流年、流月。year 按农历年干支（正月初一换年）计。 */
export function ziweiYearLayer(c: ZiweiChart, year: number): ZiweiYearLayer {
  const idx = mod(year - 4, 60);
  const stem = idx % 10, branch = idx % 12;
  const age = year - c.input.lunarYear + 1;
  const steps: string[] = [`${year}年干支${STEMS[stem]}${BRANCHES[branch]}，虚岁${age}`];
  const dec = c.palaces.find((p) => age >= p.decade.startAge && age <= p.decade.endAge);
  const flowPalaces = PALACE_NAMES.map((name, k) => {
    const b = mod(branch - k, 12);
    return { name, branch: b, natalName: c.palaces[b].name };
  });
  steps.push(`流年命宫：太岁${BRANCHES[branch]}宫入命，即本命${c.palaces[branch].name}`);
  const t: Transform[] = ['禄', '权', '科', '忌'];
  const transforms: FlowStarTransform[] = [];
  SIHUA[stem].forEach((star, i) => {
    const p = findStar(c, star);
    if (p) transforms.push({ star, transform: t[i], natalPalace: p.name, branch: p.branch });
  });
  steps.push(`流年四化（${STEMS[stem]}干）：${SIHUA[stem].map((s, i) => s + '化' + t[i]).join('、')}`);
  const dou = mod(branch - (c.input.effectiveMonth - 1) + c.input.hourBranch, 12);
  steps.push(`斗君：由流年${BRANCHES[branch]}宫起正月逆数至生月，再顺数至生时，得${BRANCHES[dou]}宫`);
  const months: FlowMonth[] = [];
  for (let m = 1; m <= 12; m++) {
    const b = mod(dou + m - 1, 12);
    months.push({ month: m, branch: b, natalPalace: c.palaces[b].name, stars: c.palaces[b].stars.map((s) => s.name) });
  }
  return {
    year, age, yearStem: stem, yearBranch: branch,
    decade: dec ? { branch: dec.branch, palaceName: dec.name, startAge: dec.decade.startAge, endAge: dec.decade.endAge } : null,
    flowMingBranch: branch, flowPalaces, transforms, douJunBranch: dou, months, steps,
  };
}
