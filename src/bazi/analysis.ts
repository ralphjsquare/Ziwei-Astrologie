// 旺衰、格局、用神：输出"候选 + 依据"，不宣称唯一答案（ADR-005）。方法标识写入结果。
import { CONTROLS, GENERATES, STEM_ELEMENT, stemIsYang, type Element } from '../core/ganzhi';
import { HIDDEN_STEMS, type TenGod } from './tables';
import type { PatternCandidate, Pillar, StrengthEvidence, YongshenCandidate } from './types';
import { tenGodOf } from './engine-util';

const SUPPORT: TenGod[] = ['比肩', '劫财', '偏印', '正印'];

export function analyzeStrength(dm: number, p: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar }): StrengthEvidence {
  const counts: Record<string, number> = {};
  const add = (g: TenGod, w: number) => { counts[g] = (counts[g] ?? 0) + w; };
  add(p.year.stemTenGod!, 1); add(p.month.stemTenGod!, 1.5); add(p.hour.stemTenGod!, 1);
  const roleW = [1, 0.5, 0.25];
  for (const [k, pl] of Object.entries(p) as [string, Pillar][]) {
    const f = k === 'month' ? 2 : 1;
    pl.hidden.forEach((h, i) => add(h.tenGod, roleW[i] * f));
  }
  let support = 0, drain = 0;
  for (const [g, v] of Object.entries(counts)) (SUPPORT.includes(g as TenGod) ? (support += v) : (drain += v));
  const ratio = support / (support + drain);
  const dmEl = STEM_ELEMENT[dm];
  const monthMain = STEM_ELEMENT[HIDDEN_STEMS[p.month.branch][0]];
  const deLing = monthMain === dmEl || GENERATES[monthMain] === dmEl;
  const r = Math.round(ratio * 1000) / 1000;
  return {
    method: 'ziping-basic/1', deLing,
    support: Math.round(support * 100) / 100, drain: Math.round(drain * 100) / 100, ratio: r,
    candidate: r >= 0.55 ? '偏强' : r <= 0.45 ? '偏弱' : '中和', counts,
  };
}

/** 《子平真诠》月令取格（简化实现）：先看建禄、月刃，再取月令藏干透出者，否则取本气 */
export function analyzePatterns(dm: number, p: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar }): PatternCandidate[] {
  const out: PatternCandidate[] = [];
  const mb = p.month.branch;
  const ls = p.month.longSheng;
  if (ls === '临官') out.push({ key: '建禄格', name: '建禄格', basis: '月令为日主临官' });
  if (ls === '帝旺' && stemIsYang(dm)) out.push({ key: '月刃格', name: '月刃格', basis: '阳干日主，月令为帝旺（阳刃）' });
  const shown = [p.year.stem, p.month.stem, p.hour.stem];
  HIDDEN_STEMS[mb].forEach((s, i) => {
    const g = tenGodOf(dm, s);
    if (g === '比肩' || g === '劫财') return;
    out.push({
      key: `${g}格`, name: `${g}格`, hiddenStem: s, revealed: shown.includes(s),
      basis: `月令${['本气', '中气', '余气'][i]}${g}${shown.includes(s) ? '，透出天干' : '，未透'}`,
    });
  });
  // 排序：透干优先，其次本气优先；建禄、月刃排在最前
  const front = out.filter((x) => x.key === '建禄格' || x.key === '月刃格');
  const rest = out.filter((x) => !front.includes(x)).sort((a, b) => Number(!!b.revealed) - Number(!!a.revealed));
  return [...front, ...rest];
}

export function analyzeYongshen(dm: number, s: StrengthEvidence): YongshenCandidate[] {
  const el = STEM_ELEMENT[dm];
  const yin = (Object.keys(GENERATES) as Element[]).find((e) => GENERATES[e] === el)!;
  const guan = (Object.keys(CONTROLS) as Element[]).find((e) => CONTROLS[e] === el)!;
  if (s.candidate === '偏弱') return [{ method: 'fuyi/1', elements: [yin, el], note: '日主偏弱，扶抑法取印星与比劫扶助' }];
  if (s.candidate === '偏强') return [{ method: 'fuyi/1', elements: [GENERATES[el], CONTROLS[el], guan], note: '日主偏强，扶抑法取食伤、财星、官杀泄耗克制' }];
  return [{ method: 'fuyi/1', elements: [], note: '日主中和，扶抑法不单独取用，宜结合格局与调候判断' }];
}
