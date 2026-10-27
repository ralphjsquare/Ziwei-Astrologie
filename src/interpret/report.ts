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
import { HEALTH_ACTION, COMBO_READING, ELEMENT_PRACTICE, GOD_ABSENT_PRACTICE, GOD_PRACTICE, PALACE_PRACTICE, SPOUSE_TIP, STAR_PRACTICE, TRANSFORM_ACTION, ELEMENT_NOTE, GOD_ABSENT, GOD_PHASE, GOD_READING, JI_CHONG, MULTI_TRANSFORM, PALACE_FRAME, PATTERN_READING, PILLAR_DOMAIN, PILLAR_NAME, POS_DOMAIN, REL_MEANING, SPOUSE_GOD, STAR_ORDER_FOR_COMBO, STAR_READING, TAG_LABEL_ZH, TRANSFORM_PHASE, type Tag } from './reading-data';
import { sihuaFor } from '../ziwei/tables';
import { elementCounts } from './stats';

const pnm = (n: string) => (n.endsWith('宫') ? n : n + '宫');
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
  const grp0 = (gs: string[]) => gs.reduce((a, g) => a + tc[g as keyof typeof tc], 0);
  const ranked = [...TEN_GODS].sort((a, c) => tc[c] - tc[a] || TEN_GODS.indexOf(a) - TEN_GODS.indexOf(c));
  const topGod = ranked[0];
  const modernTrait = between(R.byId.get(`bz.stem.${dm}`)!.plain, /另有“(.+?)”一类的性格取象/).replace(/。$/, '');

  const mingSeen = seen('命宫');
  const tagsZ = new Set<Tag>(mingSeen.stars.slice(0, 2).flatMap((s) => STAR_READING[s].tags));
  const tagsB = new Set<Tag>(ranked.filter((g) => tc[g] > 0).slice(0, 2).flatMap((g) => GOD_READING[g].tags));
  const both = [...tagsZ].filter((t) => tagsB.has(t));
  const lab = (xs: Iterable<Tag>) => [...xs].map((t) => TAG_LABEL_ZH[t]).join('、');

  const starPalace = (star: string) => z.palaces.find((p) => p.stars.some((x) => x.name === star));
  const combo = (stars: string[]): string | null => {
    const two = STAR_ORDER_FOR_COMBO.filter((x) => stars.includes(x)).slice(0, 2);
    return two.length === 2 ? COMBO_READING[two.join('')] ?? null : null;
  };
  const comboShown = new Set<string>();
  const comboPara = (stars: string[]): string => {
    const c = combo(stars);
    if (!c) return '';
    const key = STAR_ORDER_FOR_COMBO.filter((x) => stars.includes(x)).slice(0, 2).join('');
    if (comboShown.has(key)) return `${key}同宫的组合前文已讲过。`;
    comboShown.add(key);
    return `${STAR_ORDER_FOR_COMBO.filter((x) => stars.includes(x)).slice(0, 2).join('、')}同宫的组合：${c}。`;
  };
  const jiStar = z.fourTransforms.ji, jiPal = starPalace(jiStar);
  const ec = elementCounts(bz).eight;
  const lackEl = (['木', '火', '土', '金', '水'] as const).filter((e) => ec[e] === 0), manyEl = (['木', '火', '土', '金', '水'] as const).filter((e) => ec[e] >= 3);

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

  // 这个盘最值得留意的几件事
  const keys: ReportPara[] = [];
  if (jiPal) keys.push({ tag: 'modern', ruleId: 'zw.transform.忌', text: `出生年的化忌是${jiStar}，落在${pnm(jiPal.name)}：“${domain(jiPal.name)}”是这个盘里最需要多费心、最容易纠结的地方。` });
  const emptyKey = ['命宫', '官禄', '财帛', '夫妻', '福德', '田宅'].filter((n) => majors(n).length === 0);
  if (emptyKey.length) keys.push({ tag: 'modern', text: `${emptyKey.join('、')}是空宫（没有主星），按传统借对宫的星来看，这些方面的取象会更依赖对宫、四化以及大限流年的引动。` });
  if (lackEl.length || manyEl.length) keys.push({ tag: 'fact', text: `八字的五行分布${manyEl.length ? '偏多的是' + manyEl.join('、') : ''}${manyEl.length && lackEl.length ? '，' : ''}${lackEl.length ? '缺少' + lackEl.join('、') : ''}（只统计四天干四地支）。` });
  const absentNames: string[] = [];
  if (grp0(['比肩', '劫财']) === 0) absentNames.push('比肩劫财');
  if (grp0(['食神', '伤官']) === 0) absentNames.push('食神伤官');
  if (grp0(['正财', '偏财']) === 0) absentNames.push('财星');
  if (grp0(['正官', '七杀']) === 0) absentNames.push('官杀');
  if (grp0(['正印', '偏印']) === 0) absentNames.push('印星');
  if (absentNames.length) keys.push({ tag: 'fact', text: `八字十神里没有出现：${absentNames.join('、')}。` });
  sections.push({ id: 'keys', heading: '这个盘最值得留意的几件事', paras: keys.length ? keys : [{ tag: 'note', text: '盘面上没有特别突出的空缺或集中之处。' }] });

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
  {
    const m = z.mingBranch, tri = [m, (m + 4) % 12, (m + 8) % 12, (m + 6) % 12].map((b2) => z.palaces[b2]);
    const names = tri.map((p) => `${pnm(p.name)}（${BRANCHES[p.branch]}，${p.stars.filter((x) => x.kind === 'major').map((x) => x.name).join('、') || '空'}）`);
    const tally = new Map<Tag, number>();
    for (const p of tri) for (const st of p.stars.filter((x) => x.kind === 'major')) for (const t of STAR_READING[st.name].tags) tally.set(t, (tally.get(t) ?? 0) + 1);
    const topTags = [...tally.entries()].sort((a2, c2) => c2[1] - a2[1]).slice(0, 3).map(([t]) => TAG_LABEL_ZH[t]);
    const tfIn = tri.flatMap((p) => p.stars.filter((x) => x.transform).map((x) => `${x.name}化${x.transform}`));
    char.push({ tag: 'modern', text: `传统看命宫，不只看命宫本身，还要看它的“三方四正”——和它成三角的两个宫，加上对宫，共四个宫：${names.join('、')}。这四个宫的主星合起来，取象的重心是：${topTags.join('、') || '较平淡'}。${tfIn.length ? '其中带有四化：' + tfIn.join('、') + '，变化会更明显。' : '这四个宫里没有四化，整体较平稳，变化更多来自大限和流年。'}` });
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

  // 八字再深入一层：四柱各管什么、格局、五行、地支关系
  const deep: ReportPara[] = [];
  deep.push({ tag: 'note', text: '八字把四柱对应到人生的四个位置：年柱管祖辈与早年的环境，月柱管父母、事业和成长环境，日柱管自己和配偶，时柱管子女、晚年和成果。下面按这四个位置看你的盘里各是什么。' });
  for (const k of ['year', 'month', 'hour'] as const) {
    const sg = P[k].stemTenGod!, bg = P[k].hidden[0].tenGod;
    deep.push({ tag: 'modern', ruleId: `bz.god.${sg}`, text: `${PILLAR_NAME[k]}（${PILLAR_DOMAIN[k]}）：天干${STEMS[P[k].stem]}是${sg}，地支${BRANCHES[P[k].branch]}的本气是${bg}。${PILLAR_DOMAIN[k].split('、')[0]}方面，${sg}的取象是“${GOD_READING[sg].text}”${bg !== sg ? `；${bg}的取象是“${GOD_READING[bg].text}”` : ''}。` });
  }
  const spouseGod = P.day.hidden[0].tenGod;
  deep.push({ tag: 'modern', ruleId: `bz.god.${spouseGod}`, text: `日柱（${PILLAR_DOMAIN.day}）：日支${BRANCHES[P.day.branch]}叫“配偶宫”，它的本气是${spouseGod}，所以${SPOUSE_GOD[spouseGod]}。` });
  const patt = bz.patterns[0];
  if (patt && PATTERN_READING[patt.name]) deep.push({ tag: 'modern', ruleId: R.byId.has(`bz.pattern.${patt.key}`) ? `bz.pattern.${patt.key}` : undefined, text: `格局（候选）：${patt.name}。${PATTERN_READING[patt.name]}。格局的判定方法各流派不同，这里只是一种常见的取法。` });
  const elTxt = [...manyEl.map((e) => ELEMENT_NOTE[e].many), ...lackEl.map((e) => ELEMENT_NOTE[e].none)];
  deep.push({ tag: 'modern', text: `五行分布（四天干四地支）：${(['木', '火', '土', '金', '水'] as const).map((e) => e + ec[e]).join('，')}。${elTxt.length ? elTxt.join('；') + '。' : '分布比较均匀，没有特别突出或缺失的五行。'}` });
  const seenRel = new Set<string>();
  const relParas: ReportPara[] = [];
  for (const rel of bz.relations) {
    const key = rel.type + rel.members.map((m) => m.pos + m.char).join('');
    if (seenRel.has(key)) continue;
    seenRel.add(key);
    const meaning = REL_MEANING[rel.type];
    if (!meaning) continue;
    const doms = rel.members.map((m) => POS_DOMAIN[m.pos]).filter(Boolean);
    relParas.push({ tag: 'modern', ruleId: R.byId.has(`bz.rel.${rel.type}`) ? `bz.rel.${rel.type}` : undefined, text: `${rel.members.map((m) => m.pos + m.char).join('、')}${rel.element ? `（${rel.element}）` : ''}：${doms.length ? `涉及${doms.join('与')}；` : ''}${meaning}。` });
  }
  if (relParas.length) { deep.push({ tag: 'note', text: '四柱之间还有一些合、冲、刑、害的关系，它们描述的是不同位置之间的互动：' }); deep.push(...relParas.slice(0, 6)); }
  else deep.push({ tag: 'modern', text: '四柱之间没有明显的合冲刑害，各个位置之间的互动较平稳。' });
  sections.push({ id: 'bazideep', heading: '八字再深入一层', paras: deep });

  // 各宫的读法
  const shown = new Set<string>(mingSeen.stars.slice(0, 2)); // 已在“你是什么样的人”里完整介绍过的星
  const palaceReading = (n: string): ReportPara => {
    const v = seen(n);
    const frame = PALACE_FRAME[n];
    const src = v.borrowed ? `${pnm(n)}没有主星，传统上借对宫（${v.borrowed}宫）的${v.stars.join('、') || '（也无主星）'}来看。` : `${pnm(n)}有${v.stars.join('、')}。`;
    if (!v.stars.length) return { tag: 'modern', ruleId: `zw.palace.${n}`, text: `${frame}：${pnm(n)}与对宫都没有主星，取象较为平淡，更多取决于四化、辅星以及大限、流年的引动。` };
    const ref = `zw.star.${v.stars[0]}`;
    const tfs = pal(n).stars.filter((s) => s.transform).map((s) => `本宫还有${s.name}化${s.transform}：这方面${TRANSFORM_PHASE[s.transform!]}。`).join('');
    const parts = v.stars.slice(0, 2).map((st) => {
      const r = STAR_READING[st];
      if (n === '疾厄') return `${st}提示要留意${r.watch}。`;
      if (shown.has(st)) return `${st}（前文已介绍）：这方面较有可能${r.style}。`;
      shown.add(st);
      return `${st}一面：较有可能${r.style}；优势是${r.gift}；要留意${r.watch}。`;
    });
    const cb = n === '疾厄' ? '' : comboPara(v.stars);
    return { tag: 'modern', ruleId: ref, text: `${frame}：${src}${parts.join('')}${cb}${n === '疾厄' ? '这只是生活节奏上的提醒，不是对身体状况的判断。' : ''}${tfs}` };
  };
  const careerParas = [palaceReading('官禄'), palaceReading('财帛')];
  if (grp(['正财', '偏财']) === 0) careerParas.push({ tag: 'modern', text: GOD_ABSENT.财 });
  sections.push({ id: 'career', heading: '事业与财务', paras: careerParas });
  const lovParas = ['夫妻', '子女', '田宅', '父母'].map(palaceReading);
  {
    const refStar = b.input.gender === 'M' ? ['正财', '偏财'] : ['正官', '七杀'];
    const label = b.input.gender === 'M' ? '财星' : '官杀';
    const n1 = tc[refStar[0] as keyof typeof tc], n2 = tc[refStar[1] as keyof typeof tc];
    lovParas.splice(1, 0, { tag: 'modern', ruleId: `bz.god.${P.day.hidden[0].tenGod}`, text: `八字的角度：日支${BRANCHES[P.day.branch]}是配偶宫，本气是${P.day.hidden[0].tenGod}，${SPOUSE_GOD[P.day.hidden[0].tenGod]}。传统上${b.input.gender === 'M' ? '男命以财星' : '女命以官杀'}作为感情的参照，你的八字里${n1 + n2 === 0 ? `没有${label}，感情的缘分较有可能更多由大运、流年来引动，而不是平时就“在场”` : `${label}共有 ${n1 + n2} 个（${refStar[0]} ${n1}、${refStar[1]} ${n2}）`}。` });
  }
  sections.push({ id: 'love', heading: '感情与家庭', paras: lovParas });
  sections.push({ id: 'mind', heading: '内心与身体', paras: ['福德', '疾厄'].map(palaceReading) });

  // 出生年四化
  const tfParas: ReportPara[] = [{ tag: 'fact', text: `${STEMS[z.yearStem]}年生，四化是${z.fourTransforms.lu}化禄、${z.fourTransforms.quan}化权、${z.fourTransforms.ke}化科、${z.fourTransforms.ji}化忌。` }];
  for (const p of z.palaces) for (const s of p.stars.filter((x) => x.transform)) {
    tfParas.push({ tag: 'modern', ruleId: `zw.transform.${s.transform}`, text: `${s.name}化${s.transform}落在${pnm(p.name)}（管“${domain(p.name)}”）：这方面${TRANSFORM_PHASE[s.transform!]}。` });
  }
  for (const p of z.palaces) {
    const ts = p.stars.filter((x) => x.transform).map((x) => x.transform!);
    if (ts.length >= 2) {
      const key = ['禄', '权', '科', '忌'].filter((t) => ts.includes(t as never)).slice(0, 2).join('');
      if (MULTI_TRANSFORM[key]) tfParas.push({ tag: 'modern', text: `${pnm(p.name)}里同时有${p.stars.filter((x) => x.transform).map((x) => x.name + '化' + x.transform).join('、')}：${MULTI_TRANSFORM[key]}。` });
    }
  }
  if (jiPal) {
    const opp = z.palaces[(jiPal.branch + 6) % 12];
    tfParas.push({ tag: 'modern', ruleId: 'zw.transform.忌', text: `化忌的对宫：${jiStar}化忌在${pnm(jiPal.name)}，它的对宫是${pnm(opp.name)}（管“${domain(opp.name)}”）。${JI_CHONG}——也就是说，“${domain(jiPal.name)}”方面的牵挂，较有可能顺带影响“${domain(opp.name)}”。` });
  }
  sections.push({ id: 'sihua', heading: '出生年带来的几处“变化点”', paras: tfParas });

  // 人生十年一页：八字大运与紫微大限对照
  {
    const lifeP: ReportPara[] = [{ tag: 'note', text: '把一生按十年一段列出来。八字的大运按实岁，紫微的大限按虚岁，两者起点不同，所以这里用每段大运的中点对应紫微大限，只作大致对照。' }];
    const decadeAt = (vage: number) => z.palaces.find((p) => vage >= p.decade.startAge && vage <= p.decade.endAge);
    const curAge = year - z.input.lunarYear + 1;
    for (const c of bz.luck.cycles.slice(0, 9)) {
      const mid = Math.round((c.startAge + c.endAge) / 2) + 1, zd = decadeAt(mid);
      const cur = curAge - 1 >= c.startAge && curAge - 1 <= c.endAge;
      lifeP.push({ tag: 'modern', text: `${c.startAge}–${c.endAge} 岁${cur ? '（现在）' : ''}：大运${STEMS[c.stem]}${BRANCHES[c.branch]}，对日主是${c.stemTenGod}，主题偏“${GOD_PHASE[c.stemTenGod]}”；${zd ? `紫微大限走${BRANCHES[zd.branch]}宫（${pnm(zd.name)}），重点在“${domain(zd.name)}”。` : '紫微大限未到。'}` });
    }
    sections.push({ id: 'life', heading: '人生十年一页', paras: lifeP });
  }

  // 眼下
  const nowP: ReportPara[] = [];
  try {
    const zl = ziweiYearLayer(z, year), bl = baziYearLayer(bz, year);
    nowP.push({ tag: 'fact', text: `${year} 年（${STEMS[bl.stem]}${BRANCHES[bl.branch]}年，紫微虚岁 ${zl.age} 岁）。` });
    if (zl.decade) {
      const sv = seen(zl.decade.palaceName);
      nowP.push({ tag: 'modern', ruleId: `zw.palace.${zl.decade.palaceName}`, text: `紫微的大限（${zl.decade.startAge}–${zl.decade.endAge} 岁）走到${BRANCHES[zl.decade.branch]}宫（${pnm(zl.decade.palaceName)}），这十年的重点较有可能放在“${domain(zl.decade.palaceName)}”上。${sv.stars.length ? `该宫的${sv.borrowed ? '对宫' : ''}主星是${sv.stars.join('、')}，处理这方面时较有可能${join(sv.stars.map((s) => STAR_READING[s].style))}。` : ''}` });
    }
    if (zl.decade) {
      const dp = z.palaces[zl.decade.branch];
      const dsh = sihuaFor(dp.stem, z.variants.sihua);
      const dts = (['禄', '权', '科', '忌'] as const).map((t, i) => { const sp = starPalace(dsh[i]); return sp ? `${dsh[i]}化${t}落${pnm(sp.name)}（管“${domain(sp.name)}”）：这方面${TRANSFORM_PHASE[t]}` : ''; }).filter(Boolean);
      nowP.push({ tag: 'modern', text: `这十年的大限天干是${STEMS[dp.stem]}，大限四化为：${dts.join('；')}。` });
    }
    if (bl.activeLuck) {
      const lk = bl.activeLuck, g = lk.stemTenGod;
      nowP.push({ tag: 'modern', ruleId: `bz.god.${g}`, text: `八字的大运走到${STEMS[lk.stem]}${BRANCHES[lk.branch]}（${lk.startAge}–${lk.endAge} 岁），天干对日主来说是${g}，这十年的主题偏向“${GOD_PHASE[g]}”。` });
    }
    nowP.push({ tag: 'modern', ruleId: `bz.god.${bl.stemTenGod}`, text: `${year} 年的天干对日主来说是${bl.stemTenGod}，这一年的主题偏向“${GOD_PHASE[bl.stemTenGod]}”。` });
    const fm = z.palaces[zl.flowMingBranch];
    nowP.push({ tag: 'modern', ruleId: `zw.palace.${fm.name}`, text: `紫微的流年命宫落在${BRANCHES[zl.flowMingBranch]}宫，也就是本命盘的${pnm(fm.name)}（管“${domain(fm.name)}”），这一年的关注点较有可能和这方面有关。` });
    for (const t of zl.transforms) nowP.push({ tag: 'modern', ruleId: `zw.transform.${t.transform}`, text: `流年${t.star}化${t.transform}落在${pnm(t.natalPalace)}（管“${domain(t.natalPalace)}”）：这方面${TRANSFORM_PHASE[t.transform]}。` });
    {
      // 叠加：流年四化的星与本命、大限四化的星相同（同星重叠，或一禄一忌）
      const T = ['禄', '权', '科', '忌'] as const;
      const layers: [string, Record<string, string>][] = [['本命', Object.fromEntries(([z.fourTransforms.lu, z.fourTransforms.quan, z.fourTransforms.ke, z.fourTransforms.ji]).map((st, i) => [st, T[i]]))]];
      if (zl.decade) layers.push(['大限', Object.fromEntries(sihuaFor(z.palaces[zl.decade.branch].stem, z.variants.sihua).map((st, i) => [st, T[i]]))]);
      const over: string[] = [];
      for (const t of zl.transforms) for (const [ln, m] of layers) {
        const o = m[t.star];
        if (!o) continue;
        if (o === t.transform) over.push(`${t.star}在${ln}和${year}年流年里都是化${o}，同一种取象叠加了两次，这方面的“${TRANSFORM_PHASE[o]}”会更明显`);
        else over.push(`${t.star}在${ln}是化${o}，到${year}年流年是化${t.transform}：同一颗星一${o}一${t.transform}，较有可能“既有${TRANSFORM_PHASE[o]}的一面，也有${TRANSFORM_PHASE[t.transform]}的一面”`);
      }
      if (over.length) nowP.push({ tag: 'modern', text: `几层叠加起来看：${over.join('；')}。` });
    }
    const mk = (id: string, context: string) => ruleItem(R, id, undefined, context);
    for (const it of yhzpYear(bz, bl.stem, bl.branch, bl.activeLuck, mk)) nowP.push({ tag: 'trad', text: `${it.context}。${stripTail(it.text)}`, ruleId: it.ruleId });
  } catch { nowP.push({ tag: 'note', text: `${year} 年超出支持范围，无法显示这一部分。` }); }
  sections.push({ id: 'now', heading: `眼下：${year} 年`, paras: nowP });

  // 生活中怎么用
  {
    const ap: ReportPara[] = [{ tag: 'note', text: '前面讲的是“盘里有什么”，这一节讲“放到日常里可以怎么用”。这里的做法都是自我观察和日常习惯层面的参考，不是替你做决定；涉及健康、财务、婚姻、法律等重要事项，请以现实中的信息和专业意见为准。' }];
    const ming = mingSeen.stars.slice(0, 2);
    const act = (palace: string, t: string) => (palace === '疾厄' ? HEALTH_ACTION[t] : TRANSFORM_ACTION[t]);
    // 1 发挥优势
    const use: string[] = ming.map((st) => `命宫的${st}：${STAR_PRACTICE[st].use}`);
    const luPal = starPalace(z.fourTransforms.lu);
    if (luPal) use.push(`出生年的化禄（${z.fourTransforms.lu}）落在${pnm(luPal.name)}，这方面较容易有机会，可以多把精力放在“${PALACE_PRACTICE[luPal.name]}”上`);
    if (use.length) ap.push({ tag: 'modern', text: `先说怎么发挥优势。${use.join('；')}。` });
    // 2 补盲点
    const habit: string[] = ming.map((st) => `命宫的${st}：${STAR_PRACTICE[st].habit}`);
    if (jiPal) habit.push(`出生年的化忌（${jiStar}）落在${pnm(jiPal.name)}，在“${PALACE_PRACTICE[jiPal.name]}”上，${act(jiPal.name, '忌')}`);
    ap.push({ tag: 'modern', text: `再说怎么补盲点。${habit.join('；')}。` });
    // 3 八字的缺与多
    const el2: string[] = [...manyEl.map((e) => `${e}偏多：${ELEMENT_PRACTICE[e].many}`), ...lackEl.map((e) => `缺${e}：${ELEMENT_PRACTICE[e].none}`)];
    const gp: string[] = [];
    if (grp0(['比肩', '劫财']) === 0) gp.push(`没有比劫：${GOD_ABSENT_PRACTICE.比劫}`);
    if (grp0(['食神', '伤官']) === 0) gp.push(`没有食伤：${GOD_ABSENT_PRACTICE.食伤}`);
    if (grp0(['正财', '偏财']) === 0) gp.push(`没有财星：${GOD_ABSENT_PRACTICE.财}`);
    if (grp0(['正官', '七杀']) === 0) gp.push(`没有官杀：${GOD_ABSENT_PRACTICE.官杀}`);
    if (grp0(['正印', '偏印']) === 0) gp.push(`没有印星：${GOD_ABSENT_PRACTICE.印}`);
    const topPr = GOD_PRACTICE[topGod];
    if (el2.length || gp.length) ap.push({ tag: 'modern', text: `八字的偏多与缺失，也可以变成日常的小习惯。${[...el2, ...gp].join('；')}。` });
    ap.push({ tag: 'modern', text: `八字里${topGod}最突出，把它的长处用好：${topPr.focus}；同时留意：${topPr.watch}。` });
    // 4 与伴侣相处
    const sg = P.day.hidden[0].tenGod;
    ap.push({ tag: 'modern', text: `和伴侣相处：从配偶宫看，${SPOUSE_GOD[sg]}。可以参考的相处方式：${SPOUSE_TIP[sg]}。这只是一个角度，真实的关系要看两个人的实际沟通。` });
    // 5 眼下怎么安排
    try {
      const zl = ziweiYearLayer(z, year), bl = baziYearLayer(bz, year);
      const now: string[] = [];
      if (bl.activeLuck) { const g = GOD_PRACTICE[bl.activeLuck.stemTenGod]; now.push(`这十年的大运偏向“${GOD_PHASE[bl.activeLuck.stemTenGod]}”，较适合把重心放在${g.focus}；要留意${g.watch}`); }
      if (zl.decade) now.push(`紫微大限的重点领域是“${PALACE_PRACTICE[zl.decade.palaceName]}”，这十年里不妨在这方面多花一点心思`);
      const yg = GOD_PRACTICE[bl.stemTenGod];
      now.push(`${year} 年的主题偏向“${GOD_PHASE[bl.stemTenGod]}”，较适合${yg.focus}；要留意${yg.watch}`);
      ap.push({ tag: 'modern', text: `眼下怎么安排。${now.join('；')}。` });
      const fl = zl.transforms.map((t) => `${t.star}化${t.transform}落在${pnm(t.natalPalace)}（${PALACE_PRACTICE[t.natalPalace]}）：${act(t.natalPalace, t.transform)}`);
      ap.push({ tag: 'modern', text: `${year} 年流年四化给出的几个关注点。${fl.join('；')}。` });
      // 6 小练习
      const q: string[] = [];
      if (jiPal) q.push(`在“${PALACE_PRACTICE[jiPal.name]}”上，最近最让你费心的事是什么？有没有一个可以先动手改的小细节？`);
      const fj = zl.transforms.find((t) => t.transform === '忌');
      if (fj) q.push(`今年在“${PALACE_PRACTICE[fj.natalPalace]}”上，有没有可以提前留出缓冲、提前沟通的安排？`);
      const fl2 = zl.transforms.find((t) => t.transform === '禄');
      if (fl2) q.push(`今年在“${PALACE_PRACTICE[fl2.natalPalace]}”上较容易有机会，你想把哪一件事做成？`);
      q.push('回头看过去三年，哪些做法让你比较顺，哪些做法反复卡住？这些和上面讲的取象有没有对得上的地方？');
      ap.push({ tag: 'modern', text: `最后给几个可以自己想一想的问题：${q.map((x, i) => `（${i + 1}）${x}`).join('')}` });
    } catch { /* 年份超出范围时略过 */ }
    sections.push({ id: 'apply', heading: '生活中怎么用', paras: ap });
  }

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
