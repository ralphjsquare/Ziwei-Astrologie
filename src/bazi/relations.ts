import { BRANCHES, STEMS } from '../core/ganzhi';
import {
  BRANCH_CLASH, BRANCH_HARM, BRANCH_SIX_COMBINE, HALF_COMBINE, PUNISH_GROUPS, PUNISH_PAIR, SELF_PUNISH, STEM_CLASH,
  STEM_COMBINE, THREE_COMBINE, THREE_MEET,
} from './tables';
import type { Relation } from './types';

export interface Unit { pos: string; stem: number; branch: number }

const has = (a: number, b: number, p: [number, number, ...unknown[]]) => (a === p[0] && b === p[1]) || (a === p[1] && b === p[0]);

/** 计算若干"柱"（年月日时、大运、流年、流月等）之间的天干合冲与地支合冲刑害会。 */
export function computeRelations(units: Unit[]): Relation[] {
  const out: Relation[] = [];
  const S = (u: Unit) => ({ pos: u.pos, char: STEMS[u.stem] });
  const B = (u: Unit) => ({ pos: u.pos, char: BRANCHES[u.branch] });
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const a = units[i], b = units[j];
      for (const p of STEM_COMBINE) if (has(a.stem, b.stem, p)) out.push({ type: '天干五合', members: [S(a), S(b)], element: p[2] });
      for (const p of STEM_CLASH) if (has(a.stem, b.stem, p)) out.push({ type: '天干相冲', members: [S(a), S(b)] });
      for (const p of BRANCH_SIX_COMBINE) if (has(a.branch, b.branch, p)) out.push({ type: '地支六合', members: [B(a), B(b)], ...(p[2] ? { element: p[2] } : {}) });
      for (const p of BRANCH_CLASH) if (has(a.branch, b.branch, p)) out.push({ type: '地支六冲', members: [B(a), B(b)] });
      for (const p of BRANCH_HARM) if (has(a.branch, b.branch, p)) out.push({ type: '地支六害', members: [B(a), B(b)] });
      for (const p of PUNISH_PAIR) if (has(a.branch, b.branch, p)) out.push({ type: p[2], members: [B(a), B(b)] });
      if (a.branch === b.branch && SELF_PUNISH.includes(a.branch)) out.push({ type: '自刑', members: [B(a), B(b)] });
    }
  }
  const findBranch = (br: number) => units.filter((u) => u.branch === br);
  for (const g of PUNISH_GROUPS) {
    const present = g.branches.map(findBranch);
    if (present.every((x) => x.length)) out.push({ type: '三刑', members: present.map((x) => B(x[0])) });
    else {
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
        if (present[i].length && present[j].length) out.push({ type: `${g.name}（不全）`, members: [B(present[i][0]), B(present[j][0])] });
      }
    }
  }
  for (const g of THREE_COMBINE) {
    const present = g.branches.map(findBranch);
    if (present.every((x) => x.length)) out.push({ type: '地支三合', members: present.map((x) => B(x[0])), element: g.element });
  }
  for (const h of HALF_COMBINE) {
    const g = THREE_COMBINE.find((t) => t.element === h.element && h.pair.every((x) => t.branches.includes(x)))!;
    if (g.branches.map(findBranch).every((x) => x.length)) continue; // 已成三合
    const [x, y] = h.pair.map(findBranch);
    if (x.length && y.length) out.push({ type: '地支半合', members: [B(x[0]), B(y[0])], element: h.element });
  }
  for (const g of THREE_MEET) {
    const present = g.branches.map(findBranch);
    if (present.every((x) => x.length)) out.push({ type: '地支三会', members: present.map((x) => B(x[0])), element: g.element });
  }
  return out;
}

/** 仅保留涉及指定位置（如流年、大运）的关系 */
export const relationsInvolving = (rels: Relation[], positions: string[]): Relation[] =>
  rels.filter((r) => r.members.some((m) => positions.includes(m.pos)));
