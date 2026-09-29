import { BRANCHES, STEMS, STEM_ELEMENT, jiaziIndex, jiaziName, mod, nayinName, stemIsYang, yinMonthStem, ziHourStem } from '../core/ganzhi';
import type { BirthInput, Options } from '../core/types';
import { civilFromEpoch, daysFromCivil, civilFromDays, dayPillarIndex } from '../calendar/civil';
import { jieInstantsAround, type TermInstant } from '../calendar/lunar';
import type { ResolvedBirth } from '../calendar/resolve';
import { analyzePatterns, analyzeStrength, analyzeYongshen } from './analysis';
import { tenGodOf } from './engine-util';
import { computeShenSha } from './shensha';
import { computeRelations } from './relations';
import { HIDDEN_ROLE, HIDDEN_STEMS, LONG_SHENG, LONG_SHENG_START, RULES_VERSION } from './tables';
import type { BaziChart, LuckCycle, Pillar } from './types';

export function longShengOf(stem: number, branch: number): string {
  const start = LONG_SHENG_START[stem];
  return LONG_SHENG[mod(stemIsYang(stem) ? branch - start : start - branch, 12)];
}

export function makePillar(stem: number, branch: number, dm: number | null): Pillar {
  const d = dm ?? stem;
  return {
    stem, branch, jiazi: jiaziIndex(stem, branch), nayin: nayinName(jiaziIndex(stem, branch)),
    stemTenGod: dm === null ? null : tenGodOf(dm, stem),
    hidden: HIDDEN_STEMS[branch].map((s, i) => ({ stem: s, role: HIDDEN_ROLE[i], tenGod: tenGodOf(d, s) })),
    longSheng: longShengOf(d, branch),
  };
}

/** 公历 y-m-d 加若干年月日（月末溢出则取当月最后一天） */
export function addYmd(y: number, m: number, d: number, years: number, months: number, days: number) {
  let yy = y + years;
  let mm = m + months;
  yy += Math.floor((mm - 1) / 12);
  mm = mod(mm - 1, 12) + 1;
  const dim = daysFromCivil(mm === 12 ? yy + 1 : yy, mm === 12 ? 1 : mm + 1, 1) - daysFromCivil(yy, mm, 1);
  return civilFromDays(daysFromCivil(yy, mm, Math.min(d, dim)) + days);
}

export const CYCLE_COUNT = 10;

/** 起运换算（《三命通会》卷二“论大运”：三日折一岁；一日四个月、一时辰十天，一年按 360 日）：出生到节令的相差秒数 → 年月日时 */
export function qiyunOffset(diffSec: number): { years: number; months: number; days: number; hours: number } {
  const conv = diffSec * 120;
  const years = Math.floor(conv / 31104000);
  let rem = conv - years * 31104000;
  const months = Math.floor(rem / 2592000); rem -= months * 2592000;
  const days = Math.floor(rem / 86400); rem -= days * 86400;
  return { years, months, days, hours: Math.floor(rem / 3600) };
}

export function buildBazi(_input: BirthInput, r: ResolvedBirth, _opt: Options, gender: 'M' | 'F'): BaziChart {
  const steps: BaziChart['steps'] = [];
  const jie: TermInstant[] = jieInstantsAround(r.clock.y);
  let cur = 0;
  for (let i = 0; i < jie.length; i++) if (jie[i].epochSec <= r.utcSec) cur = i;
  const curJie = jie[cur], nextJie = jie[cur + 1], prevJie = jie[cur - 1] ?? curJie;
  const lichun = jie.filter((j) => j.name === '立春' && j.epochSec <= r.utcSec).pop()!;
  const baziYear = civilFromEpoch(lichun.epochSec, 480).y;
  const yIdx = mod(baziYear - 4, 60);
  const yStem = yIdx % 10, yBranch = yIdx % 12;
  steps.push({ id: 'year', text: `以立春为界，出生在${baziYear}年立春之后，年柱${STEMS[yStem]}${BRANCHES[yBranch]}` });

  const mBranch = curJie.branch!;
  const mStem = (yinMonthStem(yStem) + mod(mBranch - 2, 12)) % 10;
  steps.push({ id: 'month', text: `以节令为界，出生在${curJie.name}之后，月支${BRANCHES[mBranch]}；五虎遁得月干${STEMS[mStem]}` });

  const dIdx = dayPillarIndex(r.baziDate.y, r.baziDate.m, r.baziDate.d);
  const dStem = dIdx % 10, dBranch = dIdx % 12;
  steps.push({ id: 'day', text: `日柱按${r.baziDate.y}-${r.baziDate.m}-${r.baziDate.d}推算为${STEMS[dStem]}${BRANCHES[dBranch]}${r.lateZi ? '（晚子时，按日界规则处理）' : ''}` });

  const hBranch = r.shichen;
  const hStem = (ziHourStem(dStem) + hBranch) % 10;
  steps.push({ id: 'hour', text: `时辰${BRANCHES[hBranch]}时（整点分界），五鼠遁得时干${STEMS[hStem]}` });

  const pillars = {
    year: makePillar(yStem, yBranch, dStem), month: makePillar(mStem, mBranch, dStem),
    day: makePillar(dStem, dBranch, dStem), hour: makePillar(hStem, hBranch, dStem),
  };
  pillars.day.stemTenGod = null;

  const xunStart = dIdx - (dIdx % 10);
  const kong = [mod(xunStart + 10, 12), mod(xunStart + 11, 12)];

  // 大运
  const yang = stemIsYang(yStem);
  const dir: 1 | -1 = (yang && gender === 'M') || (!yang && gender === 'F') ? 1 : -1;
  const refJie = dir === 1 ? nextJie : curJie;
  const diffSec = Math.abs(refJie.epochSec - r.utcSec);
  const { years, months, days, hours } = qiyunOffset(diffSec);
  const std = { y: r.clock.y, m: r.clock.m, d: r.clock.d };
  const startDate = addYmd(std.y, std.m, std.d, years, months, days);
  steps.push({
    id: 'luck',
    text: `${yang ? '阳' : '阴'}${gender === 'M' ? '男' : '女'}，大运${dir === 1 ? '顺' : '逆'}排；${dir === 1 ? '顺数至下一' : '逆数至上一'}节令${refJie.name}，相差${Math.round(diffSec / 60)}分钟，三天折一年，起运${years}岁${months}个月${days}天`,
  });
  const mIdx = pillars.month.jiazi;
  const cycles: LuckCycle[] = [];
  for (let i = 0; i < CYCLE_COUNT; i++) {
    const j = mod(mIdx + dir * (i + 1), 60);
    const st = j % 10, br = j % 12;
    cycles.push({
      index: i, stem: st, branch: br, jiazi: j, nayin: nayinName(j), startAge: years + 10 * i, endAge: years + 10 * i + 9,
      startYear: startDate.y + 10 * i, stemTenGod: tenGodOf(dStem, st),
    });
  }

  const units = [
    { pos: '年', stem: yStem, branch: yBranch }, { pos: '月', stem: mStem, branch: mBranch },
    { pos: '日', stem: dStem, branch: dBranch }, { pos: '时', stem: hStem, branch: hBranch },
  ];
  const strength = analyzeStrength(dStem, pillars);
  return {
    schema: 'bazi-chart/1', school: 'ziping', gender, pillars,
    dayMaster: { stem: dStem, element: STEM_ELEMENT[dStem], yang: stemIsYang(dStem) },
    kongWang: kong,
    boundaries: {
      yearStartName: '立春', yearStartEpochSec: lichun.epochSec, monthJie: curJie.name, monthStartEpochSec: curJie.epochSec,
      nextJieEpochSec: nextJie.epochSec, prevJieEpochSec: prevJie.epochSec,
    },
    luck: { direction: dir, start: { years, months, days, hours }, startDate, referenceJie: refJie.name, diffMinutes: Math.round(diffSec / 60), cycles },
    relations: computeRelations(units),
    shensha: computeShenSha(pillars),
    strength, patterns: analyzePatterns(dStem, pillars), yongshen: analyzeYongshen(dStem, strength),
    steps, rulesVersion: RULES_VERSION,
  };
}

export { jiaziName };
