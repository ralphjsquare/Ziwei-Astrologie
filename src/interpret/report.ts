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
import { summarize, type SummaryBlock } from './summary';
import { tenGodCounts } from './stats';
import { yhzpNatal, yhzpYear } from './yhzp';

export type ParaTag = 'fact' | 'trad' | 'modern' | 'note';
export interface ReportPara { text: string; tag: ParaTag; ruleId?: string }
export interface ReportSection { id: string; heading: string; paras: ReportPara[] }
export interface Report { title: string; sections: ReportSection[] }
export const TAG_LABEL: Record<ParaTag, string> = { fact: '排盘事实', trad: '传统说法', modern: '现代通行说法', note: '说明' };

const TAIL = '以上是传统说法，并不代表现实中一定如此；电子本版本未核实。';
const stripTail = (s: string) => s.replace(TAIL, '').trim();
const between = (plain: string, re: RegExp) => re.exec(plain)?.[1]?.trim() ?? '';
const pick = (blocks: SummaryBlock[], id: string) => blocks.find((x) => x.id === id)!;
const tagOf = (t: string): ParaTag => (t.startsWith('排盘事实') ? 'fact' : t.startsWith('现代') ? 'modern' : 'trad');
// 十神 → 渊海子平里对应的规则 id（比肩书中无专章）
const GOD_YHZP: Record<string, string> = { 伤官: '伤官', 食神: '食神', 正财: '正财', 偏财: '偏财', 正官: '正官', 七杀: '七杀', 正印: '印绶', 偏印: '倒食', 劫财: '劫财' };

export function buildReport(b: ChartBundle, R: RuleSet, year: number, name = ''): Report {
  const z = b.ziwei, bz = b.bazi, P = bz.pillars;
  const blocks = summarize(b, R, year);
  const sections: ReportSection[] = [];
  const dm = STEMS[bz.dayMaster.stem], mb = BRANCHES[P.month.branch];
  const pillars = (['year', 'month', 'day', 'hour'] as const).map((k) => STEMS[P[k].stem] + BRANCHES[P[k].branch]).join(' ');
  const basic = pick(blocks, 'sum-basic');

  sections.push({ id: 'how', heading: '先说怎么读', paras: [
    { tag: 'note', text: '这是一篇把命盘里的内容改写成日常语言的说明。每一段末尾的标记告诉你它的性质：“排盘事实”是按历法与口诀算出来的，可以复核；“传统说法”是古籍或流派的看法，“现代通行说法”是现代命理书里常见的取象，这两类都只是象征性的说法，不是对你的判断。' },
    { tag: 'note', text: DISCLAIMER },
  ] });

  // 一眼看懂
  const mm = z.palaces.find((p) => p.name === '命宫')!.stars.filter((s) => s.kind === 'major').map((s) => s.name);
  const body = z.palaces.find((p) => p.isBody)!;
  const ys = bz.yongshen[0];
  const tc = tenGodCounts(bz);
  const topGod = [...TEN_GODS].sort((a, c) => tc[c] - tc[a] || TEN_GODS.indexOf(a) - TEN_GODS.indexOf(c))[0];
  sections.push({ id: 'glance', heading: '一眼看懂', paras: [
    { tag: 'fact', text: `${name ? name + '，' : ''}${b.input.gender === 'M' ? '男' : '女'}命，${STEMS[z.yearStem]}${BRANCHES[z.yearBranch]}年生。` },
    { tag: 'fact', text: `紫微斗数：${z.fiveElementBureau.name}；命宫在${BRANCHES[z.mingBranch]}宫，${mm.length ? '主星' + mm.join('、') : '没有主星（空宫）'}；身宫在${BRANCHES[body.branch]}宫（${body.name}）；命主${z.mingZhu}，身主${z.shenZhu}。` },
    { tag: 'fact', text: `八字：${pillars}。日主${dm}（${bz.dayMaster.yang ? '阳' : '阴'}${bz.dayMaster.element}），生在${mb}月；按应用的简化算法，日主${bz.strength.candidate}（候选，不是定论）${ys && ys.elements.length ? `；扶抑法的用神候选是${ys.elements.join('、')}` : ''}。` },
    { tag: 'fact', text: `八字里除日主外共有 ${Object.values(tc).reduce((a, c) => a + c, 0)} 个十神，出现最多的是${topGod}（${tc[topGod]} 个）。` },
  ] });

  // 性格与气质
  const char: ReportPara[] = [];
  const pm = basic.points.find((p) => p.label === '命宫')!;
  char.push({ text: pm.text, tag: tagOf(pm.tag), ruleId: pm.item.ruleId });
  const pd = basic.points.find((p) => p.label === '日主')!;
  char.push({ text: pd.text, tag: tagOf(pd.tag), ruleId: pd.item.ruleId });
  const stemRule = R.byId.get(`bz.yhzp.stem.${dm}`), xqRule = R.byId.get(`bz.yhzp.xingqing.${bz.dayMaster.element}`);
  if (stemRule) char.push({ text: `《渊海子平》用诗来比喻${dm}：${between(stemRule.plain, /关于.：(.+?)以上是传统说法/s)}`, tag: 'trad', ruleId: stemRule.id });
  if (xqRule) char.push({ text: `同一本书把五行配上性情，日主属${bz.dayMaster.element}：${between(xqRule.plain, /日主五行属.：(.+?)以上是传统说法/s)}`, tag: 'trad', ruleId: xqRule.id });
  const gid = GOD_YHZP[topGod];
  if (gid && R.byId.has(`bz.yhzp.god.${gid}`)) char.push({ text: `你的八字里${topGod}最多。${stripTail(R.byId.get(`bz.yhzp.god.${gid}`)!.plain)}`, tag: 'trad', ruleId: `bz.yhzp.god.${gid}` });
  char.push({ tag: 'note', text: '紫微和八字是两套相互独立的体系，取象有时相近、有时不同。相近的地方可以多留意，不同的地方不必强求统一。' });
  sections.push({ id: 'character', heading: '性格与气质（取象）', paras: char });

  // 各方面
  const asp = pick(blocks, 'sum-aspects');
  sections.push({ id: 'aspects', heading: '生活各方面', paras: [{ tag: 'note', text: asp.lead }, ...asp.points.map((p) => ({ text: p.text, tag: tagOf(p.tag), ruleId: p.item.ruleId }))] });

  // 四化
  const sh = pick(blocks, 'sum-sihua');
  sections.push({ id: 'sihua', heading: '出生年带来的四化', paras: [{ tag: 'fact', text: sh.lead }, ...sh.points.map((p) => ({ text: p.text, tag: tagOf(p.tag), ruleId: p.item.ruleId }))] });

  // 现阶段
  const now = pick(blocks, 'sum-now');
  const nowParas: ReportPara[] = [{ tag: 'fact', text: now.lead }, ...now.points.map((p) => ({ text: p.text, tag: tagOf(p.tag), ruleId: p.item.ruleId }))];
  try {
    const zl = ziweiYearLayer(z, year), bl = baziYearLayer(bz, year);
    const fm = z.palaces[zl.flowMingBranch];
    nowParas.push({ tag: 'trad', text: `这一年的流年命宫落在${BRANCHES[zl.flowMingBranch]}宫，也就是本命盘的${fm.name}宫（管“${R.byId.get(`zw.palace.${fm.name}`)!.data!.domain}”），传统上这一年的关注点会和这一方面有关。`, ruleId: `zw.palace.${fm.name}` });
    if (zl.transforms.length) nowParas.push({ tag: 'fact', text: `流年四化：${zl.transforms.map((t) => `${t.star}化${t.transform}落${t.natalPalace}宫`).join('，')}。` });
    const mk = (id: string, context: string) => ruleItem(R, id, undefined, context);
    for (const it of yhzpYear(bz, bl.stem, bl.branch, bl.activeLuck, mk)) nowParas.push({ tag: 'trad', text: `${it.context}。${stripTail(it.text)}`, ruleId: it.ruleId });
  } catch { /* 超出支持年份时已由 now.lead 说明 */ }
  sections.push({ id: 'now', heading: `眼下：${year} 年`, paras: nowParas });

  // 延伸阅读：渊海子平
  const ext = yhzpNatal(bz, (id, context) => ruleItem(R, id, undefined, context));
  sections.push({ id: 'ext', heading: '延伸阅读：古籍里与你的盘相关的条目（《渊海子平》）', paras: [
    { tag: 'note', text: '下面是《渊海子平》里与你的盘面条件对应的条目的转述。电子本版本未核实，书中说法也常有互相矛盾之处，请当作了解古人怎么看，而不是对你的判断。' },
    ...ext.filter((i) => !['bz.yhzp.frame', 'bz.yhzp.yueling'].includes(i.ruleId)).map((i) => ({ text: `${i.title.replace('渊海子平：', '')}（${i.context}）：${stripTail(i.text).replace(/^《渊海子平》/, '')}`, tag: 'trad' as const, ruleId: i.ruleId })),
  ] });

  sections.push({ id: 'limits', heading: '最后几句', paras: [
    { tag: 'note', text: '这篇文字由程序按规则生成，不了解你的真实经历，也没有考虑出生时间的细微误差、出生地的差异和你做过的选择。排盘结果可以复核，解释部分都是未经审核的传统说法。遇到需要做决定的事，请以现实中的信息和专业意见为准。' },
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
