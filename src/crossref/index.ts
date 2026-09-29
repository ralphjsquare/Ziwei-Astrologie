// 紫微 × 八字 并列对照（v1 仅做结构性对照）。只读两个引擎的输出，不反向影响，不打分。
import { BRANCHES, STEMS } from '../core/ganzhi';
import type { ChartBundle } from '../index';
import { tenGodOf } from '../bazi/engine-util';
import { ziweiYearLayer } from '../ziwei/timelayers';
import { baziYearLayer } from '../bazi/timelayers';
import { EVIDENCE_LABEL, REVIEW_LABEL, type RuleSet } from '../rules';

export type CrossRelation = 'agree' | 'differ' | 'info';
export interface CrossItem {
  ruleId: string; title: string; ziwei: string; bazi: string; relation: CrossRelation;
  note: string; evidenceLabel: string; reviewLabel: string; source: string;
}

export const CROSS_DISCLAIMER =
  '两套体系使用的是同一组出生数据，因此它们“一致”并不构成独立证据，不能据此认为结论更可靠。这里只做并列展示，不给综合评分，也不判断谁对谁错。';

export function crossReference(b: ChartBundle, R: RuleSet, year?: number): CrossItem[] {
  const z = b.ziwei, bz = b.bazi;
  const out: CrossItem[] = [];
  const mk = (id: string, ziwei: string, bazi: string, relation: CrossRelation): void => {
    const r = R.byId.get(id)!;
    out.push({
      ruleId: id, title: r.title, ziwei, bazi, relation, note: r.plain,
      evidenceLabel: EVIDENCE_LABEL[r.evidenceType], reviewLabel: REVIEW_LABEL[r.review.status],
      source: r.sources.map((s) => R.sources[s.ref].book + (s.section ? '·' + s.section : '')).join('；'),
    });
  };
  const zy = STEMS[z.yearStem] + BRANCHES[z.yearBranch];
  const by = STEMS[bz.pillars.year.stem] + BRANCHES[bz.pillars.year.branch];
  mk('cr.year-stem', `农历${b.resolved.ziweiLunar.year}年：${zy}`, `立春年：${by}`, zy === by ? 'agree' : 'differ');
  mk('cr.element', `五行局：${z.fiveElementBureau.name}（命宫纳音${z.fiveElementBureau.nayin}）`,
    `日主：${STEMS[bz.dayMaster.stem]}（${bz.dayMaster.element}）；日柱纳音${bz.pillars.day.nayin}；年柱纳音${bz.pillars.year.nayin}`, 'info');
  const l = bz.luck;
  mk('cr.direction', `大限${z.decadeDirection === 1 ? '顺' : '逆'}行，${z.fiveElementBureau.number}岁起限（虚岁）`,
    `大运${l.direction === 1 ? '顺' : '逆'}排，${l.start.years}岁${l.start.months}个月${l.start.days}天起运`, z.decadeDirection === l.direction ? 'agree' : 'differ');
  mk('cr.sihua', `${STEMS[z.yearStem]}年四化：${z.fourTransforms.lu}禄 ${z.fourTransforms.quan}权 ${z.fourTransforms.ke}科 ${z.fourTransforms.ji}忌`,
    `年干${STEMS[z.yearStem]}相对日主的十神：${tenGodOf(bz.dayMaster.stem, z.yearStem)}`, 'info');
  if (year !== undefined) {
    const zl = ziweiYearLayer(z, year), bl = baziYearLayer(bz, year);
    mk('cr.flow-year', `${year}年（${STEMS[zl.yearStem]}${BRANCHES[zl.yearBranch]}）流年命宫落本命${z.palaces[zl.flowMingBranch].name}宫；流年四化：${zl.transforms.map((t) => t.star + t.transform).join(' ')}`,
      `${STEMS[bl.stem]}${BRANCHES[bl.branch]}年，天干十神${bl.stemTenGod}${bl.activeLuck ? `；大运${STEMS[bl.activeLuck.stem]}${BRANCHES[bl.activeLuck.branch]}` : ''}`, 'info');
  }
  return out;
}
