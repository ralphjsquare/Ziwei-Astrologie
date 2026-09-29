// 合盘（两人并列对照）：只读两个人的命盘，列出结构性事实与传统所说的关系类型，不打分、不判断合不合适。
// 紫微与八字各自独立处理，不互相混算（ADR-013、ADR-014）。
import { BRANCHES, STEMS, STEM_ELEMENT, BRANCH_ELEMENT } from '../core/ganzhi';
import type { ChartBundle } from '../index';
import { tenGodOf } from '../bazi/engine-util';
import { computeRelations, type Unit } from '../bazi/relations';
import { BRANCH_CLASH, BRANCH_HARM, BRANCH_SIX_COMBINE, THREE_COMBINE } from '../bazi/tables';
import { EVIDENCE_LABEL, REVIEW_LABEL, type RuleSet } from '../rules';

export interface SynastryItem {
  ruleId: string; title: string; system: '八字' | '紫微'; a: string; b: string; note: string;
  evidenceLabel: string; reviewLabel: string; source: string;
}

export const SYNASTRY_DISCLAIMER =
  '合盘只并列展示两个人命盘之间的结构关系与传统说法，不给“合不合”“匹配度”之类的综合评分，也不据此判断关系好坏；传统术语只是文化上的描述，不代表现实中的结果。';

const pair = (a: number, b: number, p: [number, number, ...unknown[]]) => (a === p[0] && b === p[1]) || (a === p[1] && b === p[0]);
/** 两个地支的传统关系类型（可多个）；同支记“同支”。 */
export function branchRelations(a: number, b: number): string[] {
  const out: string[] = [];
  if (a === b) out.push('同支');
  if (BRANCH_SIX_COMBINE.some((p) => pair(a, b, p))) out.push('六合');
  if (BRANCH_CLASH.some((p) => pair(a, b, p))) out.push('六冲');
  if (BRANCH_HARM.some((p) => pair(a, b, p))) out.push('六害');
  if (THREE_COMBINE.some((g) => a !== b && g.branches.includes(a) && g.branches.includes(b))) out.push('三合（同一三合局）');
  return out;
}
const relText = (r: string[]) => (r.length ? r.join('、') : '无特殊关系');

export function synastry(A: ChartBundle, B: ChartBundle, R: RuleSet): SynastryItem[] {
  const out: SynastryItem[] = [];
  const mk = (id: string, system: '八字' | '紫微', a: string, b: string): void => {
    const r = R.byId.get(id)!;
    out.push({ ruleId: id, title: r.title, system, a, b, note: r.plain, evidenceLabel: EVIDENCE_LABEL[r.evidenceType], reviewLabel: REVIEW_LABEL[r.review.status], source: r.sources.map((s) => R.sources[s.ref].book + (s.section ? '·' + s.section : '')).join('；') });
  };
  const za = A.ziwei, zb = B.ziwei, ba = A.bazi, bb = B.bazi;
  const P = (c: ChartBundle['bazi'], k: 'year' | 'month' | 'day' | 'hour') => STEMS[c.pillars[k].stem] + BRANCHES[c.pillars[k].branch];

  // —— 八字 ——
  const dmA = ba.dayMaster.stem, dmB = bb.dayMaster.stem;
  const stemRel = computeRelations([{ pos: 'A', stem: dmA, branch: 0 }, { pos: 'B', stem: dmB, branch: 0 }]).filter((r) => r.type.startsWith('天干'));
  mk('sy.bz.daymaster', '八字', `日主${STEMS[dmA]}（${ba.dayMaster.element}）；${STEMS[dmB]}对其为${tenGodOf(dmA, dmB)}`, `日主${STEMS[dmB]}（${bb.dayMaster.element}）；${STEMS[dmA]}对其为${tenGodOf(dmB, dmA)}；日干关系：${stemRel.length ? stemRel.map((r) => r.type + (r.element ? '（化' + r.element + '）' : '')).join('、') : '无合冲'}`);
  mk('sy.bz.daybranch', '八字', `日支${BRANCHES[ba.pillars.day.branch]}`, `日支${BRANCHES[bb.pillars.day.branch]}；关系：${relText(branchRelations(ba.pillars.day.branch, bb.pillars.day.branch))}`);
  mk('sy.bz.yearbranch', '八字', `年支${BRANCHES[ba.pillars.year.branch]}`, `年支${BRANCHES[bb.pillars.year.branch]}；关系：${relText(branchRelations(ba.pillars.year.branch, bb.pillars.year.branch))}`);
  const units = (c: ChartBundle['bazi'], tag: string): Unit[] => (['year', 'month', 'day', 'hour'] as const).map((k) => ({ pos: tag + { year: '年', month: '月', day: '日', hour: '时' }[k], stem: c.pillars[k].stem, branch: c.pillars[k].branch }));
  const cross = computeRelations([...units(ba, 'A'), ...units(bb, 'B')]).filter((r) => new Set(r.members.map((m) => m.pos[0])).size > 1);
  mk('sy.bz.cross-relations', '八字', `A：${(['year', 'month', 'day', 'hour'] as const).map((k) => P(ba, k)).join(' ')}`, `B：${(['year', 'month', 'day', 'hour'] as const).map((k) => P(bb, k)).join(' ')}；跨盘关系共${cross.length}项：${cross.map((r) => `${r.type}（${r.members.map((m) => m.pos + m.char).join('－')}）`).join('、') || '无'}`);
  const count = (c: ChartBundle['bazi']) => {
    const n: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    for (const k of ['year', 'month', 'day', 'hour'] as const) { n[STEM_ELEMENT[c.pillars[k].stem]]++; n[BRANCH_ELEMENT[c.pillars[k].branch]]++; }
    return Object.entries(n).map(([e, v]) => `${e}${v}`).join(' ');
  };
  mk('sy.bz.elements', '八字', `A 八字五行（天干+地支本位）：${count(ba)}`, `B：${count(bb)}`);

  // —— 紫微 ——
  const nameAt = (z: ChartBundle['ziwei'], br: number) => z.palaces.find((p) => p.branch === br)!;
  const starsAt = (z: ChartBundle['ziwei'], br: number) => nameAt(z, br).stars.filter((s) => s.kind === 'major').map((s) => s.name).join('') || '无主星';
  mk('sy.zw.ming', '紫微', `命宫${BRANCHES[za.mingBranch]}（${starsAt(za, za.mingBranch)}）；落入对方${nameAt(zb, za.mingBranch).name}宫`, `命宫${BRANCHES[zb.mingBranch]}（${starsAt(zb, zb.mingBranch)}）；落入对方${nameAt(za, zb.mingBranch).name}宫；两命宫地支关系：${relText(branchRelations(za.mingBranch, zb.mingBranch))}`);
  const spouse = (z: ChartBundle['ziwei']) => z.palaces.find((p) => p.name === '夫妻')!;
  const sa = spouse(za), sb = spouse(zb);
  mk('sy.zw.spouse', '紫微', `夫妻宫${BRANCHES[sa.branch]}（${starsAt(za, sa.branch)}）；与对方命宫${BRANCHES[zb.mingBranch]}的关系：${relText(branchRelations(sa.branch, zb.mingBranch))}`, `夫妻宫${BRANCHES[sb.branch]}（${starsAt(zb, sb.branch)}）；与对方命宫${BRANCHES[za.mingBranch]}的关系：${relText(branchRelations(sb.branch, za.mingBranch))}`);
  const fall = (from: ChartBundle['ziwei'], to: ChartBundle['ziwei']) => {
    const f = from.fourTransforms;
    return ([['禄', f.lu], ['权', f.quan], ['科', f.ke], ['忌', f.ji]] as const).map(([t, star]) => {
      const hit = to.palaces.find((p) => p.stars.some((s) => s.name === star));
      return `${star}化${t}→对方${hit ? hit.name + '宫' : '（未落宫）'}`;
    }).join('；');
  };
  mk('sy.zw.sihua', '紫微', `A 的${STEMS[za.yearStem]}年四化落入 B 盘：${fall(za, zb)}`, `B 的${STEMS[zb.yearStem]}年四化落入 A 盘：${fall(zb, za)}`);
  return out;
}
