// 《渊海子平》参照：按命盘的日主、月令、十神、日柱／时柱格局、流年与日柱的冲合，挑出相应的规则条目（bz.yhzp.*）。
// 本文件只做“条件判断”，白话与引文全部来自规则数据；判定依据是书中给出的名单与定义（见各规则的引文）。
import { BRANCHES, CONTROLS, STEMS, STEM_ELEMENT, type Element } from '../core/ganzhi';
import type { BaziChart } from '../bazi/types';
import type { TenGod } from '../bazi/tables';
import type { InterpItem } from './index';

/** 按规则 id 生成条目；context 为“本盘为什么命中”的说明 */
export type MkItem = (id: string, context: string) => InterpItem;

const PN = { year: '年', month: '月', day: '日', hour: '时' } as const;
const gz = (p: { stem: number; branch: number }) => STEMS[p.stem] + BRANCHES[p.branch];
// 书中的四组名单（引文见规则）
const RIGUI = ['丁酉', '丁亥', '癸巳', '癸卯'], RIDE = ['甲寅', '戊辰', '丙辰', '庚辰', '壬戌'], KUIGANG = ['壬辰', '庚戌', '戊戌', '庚辰'], RIREN = ['戊午', '丙午', '壬子'], JINSHEN = ['癸酉', '己巳', '乙丑'];

export function yhzpNatal(bz: BaziChart, mk: MkItem): InterpItem[] {
  const P = bz.pillars, dm = STEMS[bz.dayMaster.stem], mb = BRANCHES[P.month.branch];
  const out: InterpItem[] = [];
  out.push(mk('bz.yhzp.frame', `日主${dm}，月令${mb}`));
  out.push(mk('bz.yhzp.yueling', `月令${mb}`));
  out.push(mk(`bz.yhzp.stem.${dm}`, `日主${dm}`));
  out.push(mk(`bz.yhzp.branch.${mb}`, `出生月${mb}`));
  out.push(mk(`bz.yhzp.xingqing.${bz.dayMaster.element}`, `日主${dm}属${bz.dayMaster.element}`));

  // 十神：透干（年、月、时干）或月令本气
  const seen = new Map<TenGod, string[]>();
  const note = (g: TenGod, where: string) => seen.set(g, [...(seen.get(g) ?? []), where]);
  for (const k of ['year', 'month', 'hour'] as const) note(P[k].stemTenGod!, `${PN[k]}干${STEMS[P[k].stem]}`);
  const benqi = P.month.hidden[0];
  note(benqi.tenGod, `月令${mb}本气${STEMS[benqi.stem]}`);
  const has = (g: TenGod) => seen.has(g);
  const ctx = (g: TenGod) => `${g}：${seen.get(g)!.join('、')}`;
  const map: [TenGod[], string][] = [[['伤官'], '伤官'], [['食神'], '食神'], [['正财'], '正财'], [['偏财'], '偏财'], [['正官'], '正官'], [['七杀'], '七杀'], [['正印', '偏印'], '印绶'], [['偏印'], '倒食'], [['劫财'], '劫财']];
  for (const [gods, id] of map) {
    const hit = gods.filter(has);
    if (hit.length) out.push(mk(`bz.yhzp.god.${id}`, hit.map(ctx).join('；')));
  }
  if (has('正官') && has('七杀')) out.push(mk('bz.yhzp.god.官杀混杂', `${ctx('正官')}；${ctx('七杀')}`));
  const ren = bz.shensha.filter((h) => h.name === '羊刃');
  if (ren.length) out.push(mk('bz.yhzp.god.阳刃', ren.map((h) => `${PN[h.pillar]}支${BRANCHES[P[h.pillar].branch]}（以${h.basis}为准）`).join('、')));

  const d = gz(P.day), h = gz(P.hour);
  if (RIGUI.includes(d)) out.push(mk('bz.yhzp.pillar.日贵', `日柱${d}`));
  if (RIDE.includes(d)) out.push(mk('bz.yhzp.pillar.日德', `日柱${d}`));
  if (KUIGANG.includes(d)) out.push(mk('bz.yhzp.pillar.魁罡', `日柱${d}`));
  if (RIREN.includes(d)) out.push(mk('bz.yhzp.pillar.日刃', `日柱${d}`));
  if (JINSHEN.includes(h)) out.push(mk('bz.yhzp.pillar.金神', `时柱${h}`));
  return out;
}

const el = (s: number): Element => STEM_ELEMENT[s];
const he5 = (a: number, b: number) => Math.abs(a - b) === 5;
// 天干相克但同时五合的一对（如丙克辛、丙辛合），按“合”处理，不再算“征”（实现取舍，见 ADR-022）
const ke = (a: number, b: number) => CONTROLS[el(a)] === el(b) && !he5(a, b);
const chong = (a: number, b: number) => (((a - b) % 12) + 12) % 12 === 6;
const he6 = (a: number, b: number) => (a + b) % 12 === 1;

/** 征太岁／晦：日柱（及当前大运）与流年干支的冲克、相合。无命中则返回空数组。 */
export function yhzpYear(bz: BaziChart, yearStem: number, yearBranch: number, luck: { stem: number; branch: number } | null, mk: MkItem): InterpItem[] {
  const D = bz.pillars.day, sui = STEMS[yearStem] + BRANCHES[yearBranch];
  const zheng: string[] = [], hui: string[] = [];
  if (ke(D.stem, yearStem)) zheng.push(`日干${STEMS[D.stem]}克太岁${STEMS[yearStem]}`);
  if (ke(yearStem, D.stem)) zheng.push(`太岁${STEMS[yearStem]}克日干${STEMS[D.stem]}`);
  if (chong(D.branch, yearBranch)) zheng.push(`日支${BRANCHES[D.branch]}冲太岁${BRANCHES[yearBranch]}`);
  if (he5(D.stem, yearStem)) hui.push(`日干${STEMS[D.stem]}合太岁${STEMS[yearStem]}`);
  if (he6(D.branch, yearBranch)) hui.push(`日支${BRANCHES[D.branch]}合太岁${BRANCHES[yearBranch]}`);
  if (luck) {
    const lz = STEMS[luck.stem] + BRANCHES[luck.branch];
    if (ke(luck.stem, yearStem)) zheng.push(`大运${lz}天干克太岁${STEMS[yearStem]}`);
    if (chong(luck.branch, yearBranch)) zheng.push(`大运${lz}地支冲太岁${BRANCHES[yearBranch]}`);
    if (he5(luck.stem, yearStem)) hui.push(`大运${lz}天干合太岁${STEMS[yearStem]}`);
  }
  const out: InterpItem[] = [];
  if (zheng.length) out.push(mk('bz.yhzp.zheng', `流年${sui}：${zheng.join('；')}`));
  if (hui.length) out.push(mk('bz.yhzp.hui', `流年${sui}：${hui.join('；')}`));
  return out;
}
