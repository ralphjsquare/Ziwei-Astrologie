// “一页读懂”：把命盘里已有的事实与已有规则的要点，按主题归拢成几段白话。
// 约束：每个要点的“事实”来自排盘结果；“传统取象”只取规则里已有的 data 短语或现代通行取象，并附原规则条目（可展开看出处与审核状态）。
// 不新增任何断语，不做综合评分，不合并成“整体运势”。
import { BRANCHES, STEMS } from '../core/ganzhi';
import type { ChartBundle } from '../index';
import { ziweiYearLayer } from '../ziwei/timelayers';
import { baziYearLayer } from '../bazi/timelayers';
import { TEN_GODS } from '../bazi/tables';
import type { PalaceName } from '../ziwei/types';
import type { RuleSet } from '../rules';
import { ruleItem, type InterpItem } from './index';
import { tenGodCounts } from './stats';

export interface SummaryPoint { label: string; text: string; /** 文字里“传统取象”部分的性质，供界面标注 */ tag: string; item: InterpItem }
export interface SummaryBlock { id: string; heading: string; lead: string; points: SummaryPoint[] }

const TAG_TRAD = '传统说法·未审核', TAG_MODERN = '现代通行取象·非古籍', TAG_FACT = '排盘事实';
const modernTrait = (plain: string): string => plain.match(/另有“(.+?)”一类的性格取象/)?.[1].replace(/。$/, '') ?? '';

export function summarize(b: ChartBundle, R: RuleSet, year: number): SummaryBlock[] {
  const z = b.ziwei, bz = b.bazi;
  const pal = (n: PalaceName) => z.palaces.find((p) => p.name === n)!;
  const majors = (n: PalaceName) => pal(n).stars.filter((s) => s.kind === 'major');
  const trait = (star: string) => R.byId.get(`zw.star.${star}`)?.data?.trait ?? '';
  const out: SummaryBlock[] = [];

  // 1 基本盘面
  const ming = pal('命宫'), mm = majors('命宫');
  const basic: SummaryPoint[] = [];
  const bur = z.fiveElementBureau;
  basic.push({ label: '五行局', text: `${bur.name}。它决定紫微星的起点和大限的起始岁数。`, tag: TAG_FACT, item: ruleItem(R, `zw.bureau.${bur.number}`, undefined, bur.name) });
  if (mm.length) {
    basic.push({ label: '命宫', text: `命宫在${BRANCHES[ming.branch]}宫，主星${mm.map((s) => s.name).join('、')}。传统取象：${mm.map((s) => `${s.name}——${trait(s.name)}`).join('；')}。`, tag: TAG_TRAD, item: ruleItem(R, `zw.sip.命宫.${mm[0].name}`, undefined, `${mm[0].name}坐命宫`) });
  } else {
    const opp = majors('迁移').map((s) => s.name).join('、') || '无';
    basic.push({ label: '命宫', text: `命宫在${BRANCHES[ming.branch]}宫，没有主星（空宫）。传统上会借对宫（迁移宫）的主星参看，本盘迁移宫主星：${opp}。`, tag: TAG_TRAD, item: ruleItem(R, 'zw.empty-ming', undefined, '命宫无主星') });
  }
  const body = z.palaces.find((p) => p.isBody)!;
  basic.push({ label: '身宫', text: `身宫落在${BRANCHES[body.branch]}宫（${body.name}）。传统上与命宫并看。`, tag: TAG_TRAD, item: ruleItem(R, 'zw.body', undefined, `身宫在${body.name}`) });
  const dmS = STEMS[bz.dayMaster.stem];
  const mt = modernTrait(R.byId.get(`bz.stem.${dmS}`)!.plain);
  basic.push({ label: '日主', text: `日主${dmS}（${bz.dayMaster.yang ? '阳' : '阴'}${bz.dayMaster.element}）${mt ? `。现代通行的取象：${mt}。` : '。'}`, tag: TAG_MODERN, item: ruleItem(R, `bz.stem.${dmS}`, undefined, `日主${dmS}`) });
  const stg = bz.strength;
  basic.push({ label: '旺衰（候选）', text: `日主${stg.candidate}（${stg.deLing ? '得令' : '不得令'}）。这只是一个简化的候选结果，不是唯一结论。`, tag: TAG_TRAD, item: ruleItem(R, `bz.strength.${stg.candidate}`, undefined, `候选：${stg.candidate}`) });
  const ys = bz.yongshen[0];
  if (ys && ys.elements.length) basic.push({ label: '用神（候选）', text: `按扶抑法，候选五行：${ys.elements.join('、')}。不同流派取法不同，仅供参考。`, tag: TAG_TRAD, item: ruleItem(R, 'bz.yongshen.fuyi', undefined, `方法：${ys.method}`) });
  const pt = bz.patterns[0];
  if (pt && R.byId.has(`bz.pattern.${pt.key}`)) basic.push({ label: '格局（候选）', text: `${pt.name}（候选）。${pt.basis}`, tag: TAG_TRAD, item: ruleItem(R, `bz.pattern.${pt.key}`, undefined, pt.basis) });
  out.push({ id: 'sum-basic', heading: '先看这几件事', lead: `${b.input.gender === 'M' ? '男' : '女'}命，${STEMS[z.yearStem]}${BRANCHES[z.yearBranch]}年生，四柱 ${(['year', 'month', 'day', 'hour'] as const).map((k) => STEMS[bz.pillars[k].stem] + BRANCHES[bz.pillars[k].branch]).join(' ')}。`, points: basic });

  // 2 生活各方面：紫微十二宫里最常被关心的几个宫
  const aspects: [PalaceName, string][] = [['官禄', '事业'], ['财帛', '财务'], ['夫妻', '感情婚姻'], ['子女', '子女'], ['父母', '长辈'], ['田宅', '居所家业'], ['疾厄', '身体（仅作生活提醒）'], ['福德', '内心与精神']];
  const asp: SummaryPoint[] = aspects.map(([n, nick]) => {
    const p = pal(n), ms = majors(n), dom = R.byId.get(`zw.palace.${n}`)!.data!.domain;
    const text = ms.length
      ? `${nick}（${n}宫，${BRANCHES[p.branch]}宫）管“${dom}”，主星${ms.map((s) => s.name).join('、')}：${ms.map((s) => trait(s.name)).join('；')}。`
      : `${nick}（${n}宫，${BRANCHES[p.branch]}宫）管“${dom}”，本宫没有主星，传统上借对宫主星参看。`;
    return { label: nick, text, tag: TAG_TRAD, item: ruleItem(R, `zw.palace.${n}`, undefined, `${n}宫：${p.stars.map((s) => s.name).join('、') || '无星'}`) };
  });
  out.push({ id: 'sum-aspects', heading: '生活各方面，紫微怎么看', lead: '紫微斗数把生活分成十二个宫，每个宫看一个方面。下面是最常被关心的八个宫里落了哪些主星，以及传统上对这些星的取象。星的取象只是一种象征性的说法，并不等于这方面一定如此。', points: asp });

  // 3 变化：四化
  const tf: SummaryPoint[] = [];
  for (const p of z.palaces) for (const s of p.stars.filter((x) => x.transform)) {
    const t = s.transform!, meaning = R.byId.get(`zw.transform.${t}`)!.data!.meaning;
    tf.push({ label: `${s.name}化${t}`, text: `${s.name}化${t}，落在${p.name}宫（管“${R.byId.get(`zw.palace.${p.name}`)!.data!.domain}”）。化${t}的传统取象是“${meaning}”，传统上把它放在这个宫所管的方面来理解。`, tag: TAG_TRAD, item: ruleItem(R, `zw.transform.${t}`, undefined, `${s.name}化${t}在${p.name}宫`) });
  }
  out.push({ id: 'sum-sihua', heading: '出生年带来的四化', lead: `${STEMS[z.yearStem]}年生，四化是 ${z.fourTransforms.lu}化禄、${z.fourTransforms.quan}化权、${z.fourTransforms.ke}化科、${z.fourTransforms.ji}化忌。`, points: tf });

  // 4 八字的十神分布
  const tc = tenGodCounts(bz);
  const top = [...TEN_GODS].sort((a, c) => tc[c] - tc[a] || TEN_GODS.indexOf(a) - TEN_GODS.indexOf(c));
  const present = TEN_GODS.filter((g) => tc[g] > 0), absent = TEN_GODS.filter((g) => tc[g] === 0);
  const topG = top[0];
  out.push({
    id: 'sum-tengod', heading: '八字里的十神分布',
    lead: `十神是“其他字相对日主${dmS}是什么关系”的名称。统计范围：其余三个天干和全部藏干，共 ${Object.values(tc).reduce((a, c) => a + c, 0)} 个。出现最多的是${topG}（${tc[topG]} 个）；没有出现：${absent.join('、') || '无'}。这只是数量统计，不代表强弱或好坏。`,
    points: present.filter((g) => tc[g] === tc[topG]).slice(0, 2).map((g) => ({ label: g, text: `${g}出现 ${tc[g]} 个。`, tag: TAG_TRAD, item: ruleItem(R, `bz.god.${g}`, undefined, `${g}：${tc[g]} 个`) })),
  });

  // 5 当前阶段
  const cur: SummaryPoint[] = [];
  let lead = '';
  try {
    const zl = ziweiYearLayer(z, year), bl = baziYearLayer(bz, year);
    lead = `${year} 年（紫微虚岁 ${zl.age} 岁）。`;
    if (zl.decade) cur.push({ label: '紫微大限', text: `当前大限（${zl.decade.startAge}–${zl.decade.endAge} 岁）在${BRANCHES[zl.decade.branch]}宫（${zl.decade.palaceName}）；本十年的取象，传统上落在“${R.byId.get(`zw.palace.${zl.decade.palaceName}`)!.data!.domain}”。`, tag: TAG_TRAD, item: ruleItem(R, `zw.palace.${zl.decade.palaceName}`, undefined, `大限${zl.decade.startAge}–${zl.decade.endAge}`) });
    cur.push({ label: '紫微小限', text: `${year} 年小限落在${BRANCHES[zl.minorLimit.branch]}宫（${zl.minorLimit.palaceName}）。`, tag: TAG_TRAD, item: ruleItem(R, `zw.palace.${zl.minorLimit.palaceName}`, undefined, `小限在${zl.minorLimit.palaceName}`) });
    if (bl.activeLuck) cur.push({ label: '八字大运', text: `当前大运${STEMS[bl.activeLuck.stem]}${BRANCHES[bl.activeLuck.branch]}（${bl.activeLuck.startAge}–${bl.activeLuck.endAge} 岁），天干相对日主是${bl.activeLuck.stemTenGod}。`, tag: TAG_TRAD, item: ruleItem(R, `bz.god.${bl.activeLuck.stemTenGod}`, undefined, `大运天干：${bl.activeLuck.stemTenGod}`) });
    cur.push({ label: '八字流年', text: `${year} 年是${STEMS[bl.stem]}${BRANCHES[bl.branch]}年，天干相对日主是${bl.stemTenGod}。`, tag: TAG_TRAD, item: ruleItem(R, `bz.god.${bl.stemTenGod}`, undefined, `流年天干：${bl.stemTenGod}`) });
  } catch { lead = `${year} 年超出支持范围，无法显示当前阶段。`; }
  out.push({ id: 'sum-now', heading: '眼下走到哪一步', lead, points: cur });
  return out;
}
