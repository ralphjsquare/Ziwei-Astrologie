import { SHENSHA_NAMES } from '../bazi/shensha';
// 解读引擎：由规则数据 + 盘面结构生成"白话解释 + 出处 + 依据等级 + 审核状态"。不含任何算法，也不含自由文本断语。
import { BRANCHES, STEMS } from '../core/ganzhi';
import type { ChartBundle } from '../index';
import { ziweiYearLayer } from '../ziwei/timelayers';
import { baziYearLayer } from '../bazi/timelayers';
import { PALACE_NAMES } from '../ziwei/types';
import { tenGodOf } from '../bazi/engine-util';
import { BASIS_LABEL, EVIDENCE_LABEL, REVIEW_LABEL, fill, type EvidenceType, type ReviewStatus, type Rule, type RuleSet } from '../rules';

export interface InterpSource { book: string; section?: string; note?: string; edition: string; verified: boolean }
export interface InterpItem {
  ruleId: string; title: string; text: string; context: string;
  evidenceType: EvidenceType; evidenceLabel: string; basisLabel: string; reviewStatus: ReviewStatus; reviewLabel: string;
  sources: InterpSource[];
  classical: { quote: string; source: string; variant?: string }[];
  composed?: boolean;
}
export interface InterpSection { id: string; heading: string; items: InterpItem[] }

export const DISCLAIMER = '本软件是传统文化研究与学习的参考工具。命理解释是传统观点的整理，没有经过科学验证，不构成医疗、投资、婚姻、法律等任何决定的依据。';

function toItem(R: RuleSet, rule: Rule, text: string, context: string, composed = false): InterpItem {
  return {
    ruleId: rule.id, title: rule.title, text, context,
    evidenceType: rule.evidenceType, evidenceLabel: EVIDENCE_LABEL[rule.evidenceType], basisLabel: BASIS_LABEL[rule.basis],
    reviewStatus: rule.review.status, reviewLabel: REVIEW_LABEL[rule.review.status],
    sources: rule.sources.map((s) => {
      const e = R.sources[s.ref];
      return { book: e.book, section: s.section, note: s.note ?? e.note, edition: e.edition, verified: e.verified };
    }),
    classical: rule.classical.map((q) => ({ quote: q.quote, source: `${R.corpus[q.corpusRef]?.book ?? ''}·${R.corpus[q.corpusRef]?.section ?? ''}`, ...(q.variant ? { variant: q.variant } : {}) })),
    ...(composed ? { composed } : {}),
  };
}
const need = (R: RuleSet, id: string): Rule => {
  const r = R.byId.get(id);
  if (!r) throw new Error(`missing rule ${id}`);
  return r;
};
/** 单条规则的展示项（供界面点击查看星曜、宫位含义） */
export const ruleItem = (R: RuleSet, id: string, text?: string, context = ''): InterpItem => {
  const r = need(R, id);
  return toItem(R, r, text ?? r.plain, context);
};
const short = (t: string) => t.split('；')[0].replace(/。$/, '');

export function interpretNatal(b: ChartBundle, R: RuleSet): InterpSection[] {
  const z = b.ziwei, bz = b.bazi;
  const zs: InterpSection[] = [];
  const overview: InterpItem[] = [];
  overview.push(toItem(R, need(R, `zw.bureau.${z.fiveElementBureau.number}`), need(R, `zw.bureau.${z.fiveElementBureau.number}`).plain, `${z.fiveElementBureau.name}（命宫纳音${z.fiveElementBureau.nayin}）`));
  const bodyP = z.palaces.find((p) => p.isBody)!;
  overview.push(toItem(R, need(R, 'zw.body'), need(R, 'zw.body').plain, `身宫落在${BRANCHES[bodyP.branch]}宫（${bodyP.name}）`));
  zs.push({ id: 'zw-overview', heading: '紫微·命盘概览', items: overview });

  const ming = z.palaces.find((p) => p.name === '命宫')!;
  const mingItems: InterpItem[] = [];
  const mingMajors = ming.stars.filter((s) => s.kind === 'major');
  if (!mingMajors.length) {
    const opp = z.palaces.find((p) => p.name === '迁移')!;
    const borrowed = opp.stars.filter((s) => s.kind === 'major').map((s) => s.name).join('、') || '无';
    mingItems.push(toItem(R, need(R, 'zw.empty-ming'), need(R, 'zw.empty-ming').plain, `命宫（${BRANCHES[ming.branch]}）无主星；迁移宫主星：${borrowed}`));
  }
  for (const s of mingMajors) {
    const rule = need(R, `zw.sip.命宫.${s.name}`);
    mingItems.push(toItem(R, rule, rule.plain, `${s.name}坐命宫（${BRANCHES[ming.branch]}宫）`));
  }
  zs.push({ id: 'zw-ming', heading: '紫微·命宫', items: mingItems });

  const palaceItems: InterpItem[] = [];
  const tmpl = need(R, 'zw.compose.star-in-palace');
  for (const name of PALACE_NAMES) {
    const p = z.palaces.find((x) => x.name === name)!;
    const pr = need(R, `zw.palace.${name}`);
    const stars = p.stars.map((s) => s.name + (s.transform ? `化${s.transform}` : '')).join('、') || '无星';
    palaceItems.push(toItem(R, pr, pr.plain, `${BRANCHES[p.branch]}宫·${name}宫${p.isBody ? '（身宫）' : ''}：${stars}`));
    if (name !== '命宫') {
      for (const s of p.stars.filter((x) => x.kind === 'major')) {
        const sr = need(R, `zw.star.${s.name}`);
        const trait = sr.data!.trait;
        palaceItems.push(toItem(R, tmpl, fill(tmpl.plain, { star: s.name, palace: name, trait, domain: pr.data!.domain, starShort: short(trait) }), `${s.name}在${name}宫`, true));
      }
    }
    for (const s of p.stars.filter((x) => x.transform)) {
      const tr = need(R, `zw.transform.${s.transform}`);
      palaceItems.push(toItem(R, tr, `${s.name}${tr.title}：${tr.plain}`, `${s.name}化${s.transform}在${name}宫`));
    }
  }
  zs.push({ id: 'zw-palaces', heading: '紫微·十二宫', items: palaceItems });

  const brItems: InterpItem[] = [];
  for (const p of z.palaces) for (const s of p.stars.filter((x) => x.kind === 'major' && x.brightness)) {
    const br = need(R, `zw.brightness.${s.brightness}`);
    brItems.push(toItem(R, br, br.plain, `${s.name}在${BRANCHES[p.branch]}宫（${p.name}宫）：${s.brightness}`));
  }
  if (brItems.length) zs.push({ id: 'zw-brightness', heading: '紫微·主星庙旺利陷', items: brItems });

  // 八字
  const dm = bz.dayMaster.stem;
  const items1: InterpItem[] = [];
  const dmR = need(R, `bz.stem.${STEMS[dm]}`);
  items1.push(toItem(R, dmR, dmR.plain, `日主${STEMS[dm]}（${bz.dayMaster.element}，${bz.dayMaster.yang ? '阳' : '阴'}）`));
  const kong = bz.kongWang.map((x) => BRANCHES[x]).join('');
  const hit = (['year', 'month', 'day', 'hour'] as const).filter((k) => k !== 'day' && bz.kongWang.includes(bz.pillars[k].branch)).map((k) => ({ year: '年', month: '月', day: '日', hour: '时' })[k] + '支');
  items1.push(toItem(R, need(R, 'bz.kongwang'), need(R, 'bz.kongwang').plain, `日柱旬空：${kong}${hit.length ? `；${hit.join('、')}落空亡` : '；原局其余地支未落空亡'}`));
  const nm = { year: '年', month: '月', day: '日', hour: '时' };
  for (const k of ['year', 'month', 'hour'] as const) {
    const g = bz.pillars[k].stemTenGod!;
    items1.push(toItem(R, need(R, `bz.god.${g}`), need(R, `bz.god.${g}`).plain, `${nm[k]}干${STEMS[bz.pillars[k].stem]}：${g}`));
  }
  for (const k of ['year', 'month', 'day', 'hour'] as const) {
    const ls = bz.pillars[k].longSheng;
    items1.push(toItem(R, need(R, `bz.ls.${ls}`), need(R, `bz.ls.${ls}`).plain, `日主在${nm[k]}支${BRANCHES[bz.pillars[k].branch]}：${ls}`));
  }
  const sections: InterpSection[] = [...zs, { id: 'bz-basic', heading: '八字·日主与十神', items: items1 }];

  const st = bz.strength;
  const sr = need(R, `bz.strength.${st.candidate}`);
  const items2: InterpItem[] = [toItem(R, sr, sr.plain, `候选：${st.candidate}（得令：${st.deLing ? '是' : '否'}；助力 ${st.support}，泄耗克 ${st.drain}，占比 ${st.ratio}）`)];
  const ys = bz.yongshen[0];
  const yr = need(R, 'bz.yongshen.fuyi');
  items2.push(toItem(R, yr, fill(yr.plain, { elements: ys.elements.join('、') || '（暂不单取）', note: ys.note }), `方法：${ys.method}`));
  for (const p of bz.patterns.slice(0, 3)) {
    const pr = need(R, `bz.pattern.${p.key}`);
    items2.push(toItem(R, pr, pr.plain, `${p.name}（候选）：${p.basis}`));
  }
  sections.push({ id: 'bz-strength', heading: '八字·旺衰、格局、用神（候选）', items: items2 });

  {
    const th = need(R, 'bz.tiaohou');
    const key = `qtbj/${STEMS[dm]}${BRANCHES[bz.pillars.month.branch]}#1`;
    const ent = R.corpus[key];
    const item = toItem(R, th, ent ? th.plain : `${th.plain}（所用电子本没有收录“${STEMS[dm]}日主·${BRANCHES[bz.pillars.month.branch]}月”条目，此处从略。）`, `日主${STEMS[dm]}，出生月${BRANCHES[bz.pillars.month.branch]}月`);
    if (ent) item.classical = [{ quote: ent.text, source: `${ent.book}·${ent.section}` }];
    sections.push({ id: 'bz-tiaohou', heading: '八字·调候参考（穷通宝鉴）', items: [item] });
  }

  {
    const PN = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
    const ss: InterpItem[] = [];
    for (const name of SHENSHA_NAMES) {
      const hits = bz.shensha.filter((h) => h.name === name);
      if (!hits.length) continue;
      const key = name.replace(/（.*）/, '');
      const rule = R.byId.get(`bz.shensha.${key}`) ?? need(R, `modern_shensha.${key}`);
      ss.push(toItem(R, rule, rule.plain, hits.map((h) => `${PN[h.pillar]}（以${h.basis}为准${h.qualified === undefined ? '' : h.qualified ? (name === '三奇贵人' ? '，顺布成立' : '，德秀同见') : (name === '三奇贵人' ? '，仅检测到组合、未顺布' : '，仅单见德或秀')}）`).join('、')));
    }
    if (ss.length) sections.push({ id: 'bz-shensha', heading: '八字·神煞（仅列位置）', items: ss });
  }

  const items3: InterpItem[] = [];
  const seen = new Set<string>();
  for (const rel of bz.relations) {
    const key = rel.type + rel.members.map((m) => m.pos + m.char).join('');
    if (seen.has(key)) continue;
    seen.add(key);
    const rr = R.byId.get(`bz.rel.${rel.type}`);
    if (!rr) continue;
    items3.push(toItem(R, rr, rr.plain, rel.members.map((m) => `${m.pos}${m.char}`).join('、') + (rel.element ? `（${rel.element}）` : '')));
  }
  if (!items3.length) items3.push(toItem(R, need(R, 'bz.kongwang'), '原局四柱之间没有明显的合冲刑害关系。', '原局无刑冲合害'));
  sections.push({ id: 'bz-relations', heading: '八字·刑冲合害', items: items3.slice(0, 16) });

  const lr = need(R, 'bz.luck.direction');
  const l = bz.luck;
  sections.push({
    id: 'bz-luck', heading: '八字·大运',
    items: [toItem(R, lr, lr.plain, `${l.direction === 1 ? '顺' : '逆'}排；起运 ${l.start.years} 岁 ${l.start.months} 个月 ${l.start.days} 天（约 ${l.startDate.y} 年 ${l.startDate.m} 月 ${l.startDate.d} 日）`)],
  });
  return sections;
}

/** 流年解读（紫微流年 + 八字流年） */
export function interpretYear(b: ChartBundle, year: number, R: RuleSet): InterpSection[] {
  const zl = ziweiYearLayer(b.ziwei, year);
  const bl = baziYearLayer(b.bazi, year);
  const secs: InterpSection[] = [];
  const zi: InterpItem[] = [];
  const natalName = b.ziwei.palaces[zl.flowMingBranch].name;
  const fm = need(R, `zw.flow.ming.${natalName}`);
  zi.push(toItem(R, fm, fm.plain, `${year}年（${STEMS[zl.yearStem]}${BRANCHES[zl.yearBranch]}），虚岁 ${zl.age}`));
  if (zl.decade) {
    const dr = need(R, 'zw.flow.decade');
    const pr = need(R, `zw.palace.${zl.decade.palaceName}`);
    zi.push(toItem(R, dr, fill(dr.plain, { palace: zl.decade.palaceName, startAge: zl.decade.startAge, endAge: zl.decade.endAge, domain: pr.data!.domain }), `大限：${BRANCHES[zl.decade.branch]}宫（${zl.decade.palaceName}）`));
  }
  {
    const mr = need(R, 'zw.flow.minor');
    const pr = need(R, `zw.palace.${zl.minorLimit.palaceName}`);
    zi.push(toItem(R, mr, fill(mr.plain, { palace: zl.minorLimit.palaceName, domain: pr.data!.domain }), `小限：${BRANCHES[zl.minorLimit.branch]}宫（${zl.minorLimit.palaceName}）`));
  }
  for (const tr of zl.transforms) {
    const rr = need(R, `zw.flow.transform.${tr.transform}`);
    const tRule = need(R, `zw.transform.${tr.transform}`);
    const pr = need(R, `zw.palace.${tr.natalPalace}`);
    zi.push(toItem(R, rr, fill(rr.plain, { star: tr.star, transformName: tRule.title, palace: tr.natalPalace, domain: pr.data!.domain, meaning: tRule.data!.meaning }), `${tr.star}化${tr.transform}落${tr.natalPalace}宫`));
  }
  secs.push({ id: 'zw-year', heading: `紫微·${year}年流年`, items: zi });

  const bi: InterpItem[] = [];
  const dm = b.bazi.dayMaster.stem;
  if (bl.activeLuck) {
    const lk = bl.activeLuck;
    const g = tenGodOf(dm, lk.stem);
    const lr = need(R, 'bz.flow.luck');
    bi.push(toItem(R, lr, fill(lr.plain, { luck: STEMS[lk.stem] + BRANCHES[lk.branch], god: g, godTrait: need(R, `bz.god.${g}`).plain.split('。')[0] }), `${lk.startAge}–${lk.endAge} 岁（约 ${lk.startYear} 年起）`));
  }
  const yr = need(R, 'bz.flow.year');
  bi.push(toItem(R, yr, fill(yr.plain, { year: STEMS[bl.stem] + BRANCHES[bl.branch], god: bl.stemTenGod, godTrait: need(R, `bz.god.${bl.stemTenGod}`).plain.split('。')[0] }), `${year}年 ${STEMS[bl.stem]}${BRANCHES[bl.branch]}（立春起）`));
  const seen = new Set<string>();
  for (const rel of bl.relations) {
    const key = rel.type + rel.members.map((m) => m.pos + m.char).join('');
    if (seen.has(key)) continue;
    seen.add(key);
    const rr = R.byId.get(`bz.rel.${rel.type}`);
    if (rr) bi.push(toItem(R, rr, rr.plain, rel.members.map((m) => `${m.pos}${m.char}`).join('、') + (rel.element ? `（${rel.element}）` : '')));
  }
  secs.push({ id: 'bz-year', heading: `八字·${year}年流年`, items: bi });
  return secs;
}
