// 白话解读报告：把排盘事实与已有规则的要点，按“先看全貌、再看性格、各方面、变化、现阶段”的顺序写成一篇可连续阅读的文字。
// 约束与“一页读懂”相同：事实来自排盘；传统取象只取规则里已有的短语与转述；不新增断语，不做评分，不下指令。
// 每个段落带来源标记（排盘事实／传统说法／现代通行说法／说明），并附规则 id 供界面展开出处。
import { BRANCHES, STEMS } from '../core/ganzhi';
import type { ChartBundle } from '../index';
import { ziweiYearLayer } from '../ziwei/timelayers';
import { baziYearLayer } from '../bazi/timelayers';
import { TEN_GODS } from '../bazi/tables';
import type { RuleSet } from '../rules';
import { DISCLAIMER, ruleItem } from './index';
import { tenGodCounts } from './stats';
import { yhzpNatal, yhzpYear } from './yhzp';
import { GOD_ABSENT, GOD_PHASE, GOD_READING, PALACE_FRAME, STAR_READING, TAG_LABEL_ZH, TRANSFORM_PHASE, type Tag } from './reading-data';

export type ParaTag = 'fact' | 'trad' | 'modern' | 'note';
export interface ReportPara { text: string; tag: ParaTag; ruleId?: string }
export interface ReportSection { id: string; heading: string; paras: ReportPara[] }
export interface Report { title: string; sections: ReportSection[] }
export const TAG_LABEL: Record<ParaTag, string> = { fact: '排盘事实', trad: '传统说法', modern: '现代通行说法', note: '说明' };

const TAIL = '以上是传统说法，并不代表现实中一定如此；电子本版本未核实。';
const stripTail = (s: string) => s.replace(TAIL, '').trim();
const between = (plain: string, re: RegExp) => re.exec(plain)?.[1]?.trim() ?? '';
// 十神 → 渊海子平里对应的规则 id（比肩书中无专章）
const GOD_YHZP: Record<string, string> = { 伤官: '伤官', 食神: '食神', 正财: '正财', 偏财: '偏财', 正官: '正官', 七杀: '七杀', 正印: '印绶', 偏印: '倒食', 劫财: '劫财' };

export function buildReport(b: ChartBundle, R: RuleSet, year: number, name = ''): Report {
  const z = b.ziwei, bz = b.bazi, P = bz.pillars;
  const sections: ReportSection[] = [];
  const dm = STEMS[bz.dayMaster.stem], mb = BRANCHES[P.month.branch];
  const pillars = (['year', 'month', 'day', 'hour'] as const).map((k) => STEMS[P[k].stem] + BRANCHES[P[k].branch]).join(' ');
  const domain = (n: string) => R.byId.get(`zw.palace.${n}`)!.data!.domain;
  const pal = (n: string) => z.palaces.find((p) => p.name === n)!;
  const majors = (n: string) => pal(n).stars.filter((s) => s.kind === 'major').map((s) => s.name);
  /** 该宫看哪些主星；空宫借对宫（相差 6 位） */
  const seen = (n: string): { stars: string[]; borrowed: string | null } => {
    const own = majors(n);
    if (own.length) return { stars: own, borrowed: null };
    const opp = z.palaces[(pal(n).branch + 6) % 12];
    return { stars: opp.stars.filter((s) => s.kind === 'major').map((s) => s.name), borrowed: opp.name };
  };
  const join = (xs: string[]) => xs.slice(0, 2).join('；同时');
  const tc = tenGodCounts(bz);
  const ranked = [...TEN_GODS].sort((a, c) => tc[c] - tc[a] || TEN_GODS.indexOf(a) - TEN_GODS.indexOf(c));
  const topGod = ranked[0];
  const modernTrait = between(R.byId.get(`bz.stem.${dm}`)!.plain, /另有“(.+?)”一类的性格取象/).replace(/。$/, '');

  const mingSeen = seen('命宫');
  const tagsZ = new Set<Tag>(mingSeen.stars.slice(0, 2).flatMap((s) => STAR_READING[s].tags));
  const tagsB = new Set<Tag>(ranked.filter((g) => tc[g] > 0).slice(0, 2).flatMap((g) => GOD_READING[g].tags));
  const both = [...tagsZ].filter((t) => tagsB.has(t));
  const lab = (xs: Iterable<Tag>) => [...xs].map((t) => TAG_LABEL_ZH[t]).join('、');

  // 开头
  sections.push({ id: 'how', heading: '先说怎么读', paras: [
    { tag: 'note', text: '下面是把你的命盘改写成日常语言的解读。段末的标记告诉你它的性质：“排盘事实”是算出来的，可以复核；“现代通行说法”是现代命理里常见的取象，由本项目整理，比古籍更通俗；“传统说法”转述古籍与流派的看法。所有说法都是象征性的倾向，不是对你的判断。' },
  ] });

  // 一句话读你的盘
  const ov: ReportPara[] = [];
  const mingStar = mingSeen.stars[0];
  if (mingStar) ov.push({ tag: 'modern', ruleId: `zw.star.${mingStar}`, text: `整体看，你给人的印象较有可能是：${join(mingSeen.stars.map((s) => STAR_READING[s].style))}。内在气质上，八字日主${dm}${modernTrait ? `，现代命理的取象是“${modernTrait}”` : ''}。` });
  else ov.push({ tag: 'modern', text: `八字日主${dm}${modernTrait ? `，现代命理的取象是“${modernTrait}”` : ''}。紫微命宫以及对宫都没有主星，取象较为平淡，更多取决于四化、辅星和大限、流年的引动。` });
  ov.push(both.length
    ? { tag: 'modern', text: `紫微和八字这两套相互独立的体系，在这几点上取象相近：${lab(both)}。相近的地方不妨多留意，它们较有可能是你比较稳定的特质。` }
    : { tag: 'modern', text: `紫微偏向“${lab(tagsZ) || '（取象较平淡）'}”，八字偏向“${lab(tagsB) || '（取象较平淡）'}”，两者没有明显重合。这很常见，可以把它们看成同一个人的不同侧面。` });
  sections.push({ id: 'overview', heading: '一句话读你的盘', paras: ov });

  // 一眼看懂（命盘数据）
  const mm = majors('命宫');
  const body = z.palaces.find((p) => p.isBody)!;
  const ys = bz.yongshen[0];
  sections.push({ id: 'glance', heading: '命盘数据（可复核）', paras: [
    { tag: 'fact', text: `${name ? name + '，' : ''}${b.input.gender === 'M' ? '男' : '女'}命，${STEMS[z.yearStem]}${BRANCHES[z.yearBranch]}年生。紫微斗数：${z.fiveElementBureau.name}；命宫在${BRANCHES[z.mingBranch]}宫，${mm.length ? '主星' + mm.join('、') : '没有主星（空宫）'}；身宫在${BRANCHES[body.branch]}宫（${body.name}）；命主${z.mingZhu}，身主${z.shenZhu}。` },
    { tag: 'fact', text: `八字：${pillars}。日主${dm}（${bz.dayMaster.yang ? '阳' : '阴'}${bz.dayMaster.element}），生在${mb}月；按应用的简化算法，日主${bz.strength.candidate}（候选，不是定论）${ys && ys.elements.length ? `；扶抑法的用神候选是${ys.elements.join('、')}` : ''}。除日主外共有 ${Object.values(tc).reduce((a, c) => a + c, 0)} 个十神，出现最多的是${topGod}（${tc[topGod]} 个）。` },
  ] });

  // 你是什么样的人
  const char: ReportPara[] = [];
  if (mingStar) {
    const r = STAR_READING;
    char.push({ tag: 'modern', ruleId: `zw.star.${mingStar}`, text: `紫微命宫在${BRANCHES[z.mingBranch]}宫，${mingSeen.borrowed ? '没有主星，传统上借对宫（' + mingSeen.borrowed + '宫）的' : '主星是'}${mingSeen.stars.join('、')}。${mingSeen.stars.slice(0, 2).map((s) => `${s}的特点：做事较有可能${r[s].style}。优势是${r[s].gift}；需要留意的是${r[s].watch}。`).join('')}` });
  }
  const strengthText = bz.strength.candidate === '偏强'
    ? '按简化算法，日主偏强（候选）：自身力量比较充足，较有可能有主见、愿意主动。传统的思路是让这股力量有出口——用在表达、赚取和承担责任上（五行上叫“泄、耗、克”）。'
    : bz.strength.candidate === '偏弱'
      ? '按简化算法，日主偏弱（候选）：自身力量需要补充，较有可能更需要来自学习、长辈和同伴的支持。传统的思路是“扶”——补充印星和比劫（生我、同我）的力量。'
      : '按简化算法，日主比较均衡（候选），没有明显需要大幅偏补的地方。';
  char.push({ tag: 'modern', ruleId: `bz.strength.${bz.strength.candidate}`, text: `八字日主${dm}（${bz.dayMaster.yang ? '阳' : '阴'}${bz.dayMaster.element}），生在${mb}月。${modernTrait ? `现代命理的取象：${modernTrait}。` : ''}${strengthText}${ys && ys.elements.length ? `按扶抑法，候选的有利五行是${ys.elements.join('、')}；这只是传统的一种思路，不同流派取法不同。` : ''}` });
  const gods = ranked.filter((g) => tc[g] > 0).slice(0, 2);
  char.push({ tag: 'modern', ruleId: GOD_YHZP[topGod] ? `bz.yhzp.god.${GOD_YHZP[topGod]}` : undefined, text: `八字十神里最突出的是${gods.map((g) => `${g}（${tc[g]} 个）：${GOD_READING[g].text}`).join('；其次是')}。` });
  const grp = (gs: string[]) => gs.reduce((a, g) => a + tc[g as keyof typeof tc], 0);
  const absent: string[] = [];
  if (grp(['比肩', '劫财']) === 0) absent.push(GOD_ABSENT.比劫);
  if (grp(['食神', '伤官']) === 0) absent.push(GOD_ABSENT.食伤);
  if (grp(['正财', '偏财']) === 0) absent.push(GOD_ABSENT.财);
  if (grp(['正官', '七杀']) === 0) absent.push(GOD_ABSENT.官杀);
  if (grp(['正印', '偏印']) === 0) absent.push(GOD_ABSENT.印);
  if (absent.length) char.push({ tag: 'modern', text: `反过来看，没有出现的类别也有说法：${absent.join('')}` });
  sections.push({ id: 'character', heading: '你是什么样的人', paras: char });

  // 各宫的读法
  const shown = new Set<string>(mingSeen.stars.slice(0, 2)); // 已在“你是什么样的人”里完整介绍过的星
  const palaceReading = (n: string): ReportPara => {
    const v = seen(n);
    const frame = PALACE_FRAME[n];
    const src = v.borrowed ? `${n}宫没有主星，传统上借对宫（${v.borrowed}宫）的${v.stars.join('、') || '（也无主星）'}来看。` : `${n}宫有${v.stars.join('、')}。`;
    if (!v.stars.length) return { tag: 'modern', ruleId: `zw.palace.${n}`, text: `${frame}：${n}宫与对宫都没有主星，取象较为平淡，更多取决于四化、辅星以及大限、流年的引动。` };
    const ref = `zw.star.${v.stars[0]}`;
    const tfs = pal(n).stars.filter((s) => s.transform).map((s) => `本宫还有${s.name}化${s.transform}：这方面${TRANSFORM_PHASE[s.transform!]}。`).join('');
    const parts = v.stars.slice(0, 2).map((st) => {
      const r = STAR_READING[st];
      if (n === '疾厄') return `${st}提示要留意${r.watch}。`;
      if (shown.has(st)) return `${st}（前文已介绍）：这方面较有可能${r.style}。`;
      shown.add(st);
      return `${st}一面：较有可能${r.style}；优势是${r.gift}；要留意${r.watch}。`;
    });
    return { tag: 'modern', ruleId: ref, text: `${frame}：${src}${parts.join('')}${n === '疾厄' ? '这只是生活节奏上的提醒，不是对身体状况的判断。' : ''}${tfs}` };
  };
  const careerParas = [palaceReading('官禄'), palaceReading('财帛')];
  if (grp(['正财', '偏财']) === 0) careerParas.push({ tag: 'modern', text: GOD_ABSENT.财 });
  sections.push({ id: 'career', heading: '事业与财务', paras: careerParas });
  sections.push({ id: 'love', heading: '感情与家庭', paras: ['夫妻', '子女', '田宅', '父母'].map(palaceReading) });
  sections.push({ id: 'mind', heading: '内心与身体', paras: ['福德', '疾厄'].map(palaceReading) });

  // 出生年四化
  const tfParas: ReportPara[] = [{ tag: 'fact', text: `${STEMS[z.yearStem]}年生，四化是${z.fourTransforms.lu}化禄、${z.fourTransforms.quan}化权、${z.fourTransforms.ke}化科、${z.fourTransforms.ji}化忌。` }];
  for (const p of z.palaces) for (const s of p.stars.filter((x) => x.transform)) {
    tfParas.push({ tag: 'modern', ruleId: `zw.transform.${s.transform}`, text: `${s.name}化${s.transform}落在${p.name}宫（管“${domain(p.name)}”）：这方面${TRANSFORM_PHASE[s.transform!]}。` });
  }
  sections.push({ id: 'sihua', heading: '出生年带来的几处“变化点”', paras: tfParas });

  // 眼下
  const nowP: ReportPara[] = [];
  try {
    const zl = ziweiYearLayer(z, year), bl = baziYearLayer(bz, year);
    nowP.push({ tag: 'fact', text: `${year} 年（${STEMS[bl.stem]}${BRANCHES[bl.branch]}年，紫微虚岁 ${zl.age} 岁）。` });
    if (zl.decade) {
      const sv = seen(zl.decade.palaceName);
      nowP.push({ tag: 'modern', ruleId: `zw.palace.${zl.decade.palaceName}`, text: `紫微的大限（${zl.decade.startAge}–${zl.decade.endAge} 岁）走到${BRANCHES[zl.decade.branch]}宫（${zl.decade.palaceName}宫），这十年的重点较有可能放在“${domain(zl.decade.palaceName)}”上。${sv.stars.length ? `该宫的${sv.borrowed ? '对宫' : ''}主星是${sv.stars.join('、')}，处理这方面时较有可能${join(sv.stars.map((s) => STAR_READING[s].style))}。` : ''}` });
    }
    if (bl.activeLuck) {
      const lk = bl.activeLuck, g = lk.stemTenGod;
      nowP.push({ tag: 'modern', ruleId: `bz.god.${g}`, text: `八字的大运走到${STEMS[lk.stem]}${BRANCHES[lk.branch]}（${lk.startAge}–${lk.endAge} 岁），天干对日主来说是${g}，这十年的主题偏向“${GOD_PHASE[g]}”。` });
    }
    nowP.push({ tag: 'modern', ruleId: `bz.god.${bl.stemTenGod}`, text: `${year} 年的天干对日主来说是${bl.stemTenGod}，这一年的主题偏向“${GOD_PHASE[bl.stemTenGod]}”。` });
    const fm = z.palaces[zl.flowMingBranch];
    nowP.push({ tag: 'modern', ruleId: `zw.palace.${fm.name}`, text: `紫微的流年命宫落在${BRANCHES[zl.flowMingBranch]}宫，也就是本命盘的${fm.name}宫（管“${domain(fm.name)}”），这一年的关注点较有可能和这方面有关。` });
    for (const t of zl.transforms) nowP.push({ tag: 'modern', ruleId: `zw.transform.${t.transform}`, text: `流年${t.star}化${t.transform}落在${t.natalPalace}宫（管“${domain(t.natalPalace)}”）：这方面${TRANSFORM_PHASE[t.transform]}。` });
    const mk = (id: string, context: string) => ruleItem(R, id, undefined, context);
    for (const it of yhzpYear(bz, bl.stem, bl.branch, bl.activeLuck, mk)) nowP.push({ tag: 'trad', text: `${it.context}。${stripTail(it.text)}`, ruleId: it.ruleId });
  } catch { nowP.push({ tag: 'note', text: `${year} 年超出支持范围，无法显示这一部分。` }); }
  sections.push({ id: 'now', heading: `眼下：${year} 年`, paras: nowP });

  // 延伸阅读：渊海子平
  const ext = yhzpNatal(bz, (id, context) => ruleItem(R, id, undefined, context));
  sections.push({ id: 'ext', heading: '延伸阅读：古籍里与你的盘相关的条目（《渊海子平》）', paras: [
    { tag: 'note', text: '下面是《渊海子平》里与你的盘面条件对应的条目的转述。电子本版本未核实，书中说法也常有互相矛盾之处，请当作了解古人怎么看，而不是对你的判断。' },
    ...ext.filter((i) => !['bz.yhzp.frame', 'bz.yhzp.yueling'].includes(i.ruleId)).map((i) => ({ text: `${i.title.replace('渊海子平：', '')}（${i.context}）：${stripTail(i.text).replace(/^《渊海子平》/, '')}`, tag: 'trad' as const, ruleId: i.ruleId })),
  ] });

  sections.push({ id: 'limits', heading: '最后几句', paras: [
    { tag: 'note', text: '这篇解读由程序按规则和文本库生成，不了解你的真实经历，也没有考虑出生时间的细微误差、出生地的差异和你做过的选择。排盘结果可以复核，解读文字都是未经审核的传统与现代说法。遇到需要做决定的事，请以现实中的信息和专业意见为准。' + DISCLAIMER },
  ] });
  return { title: `${name || '命盘'}的白话解读`, sections };
}

export function reportToMarkdown(r: Report, date: string): string {
  const lines = [`# ${r.title}`, '', `> 生成日期 ${date}。段落末尾的标记说明该段的性质；所有解释均为“未审核”。`, ''];
  for (const s of r.sections) {
    lines.push(`## ${s.heading}`, '');
    for (const p of s.paras) lines.push(`${p.text}${p.tag === 'note' ? '' : ` 〔${TAG_LABEL[p.tag]}〕`}`, '');
  }
  return lines.join('\n');
}
