import { describe, expect, it } from 'vitest';
import { RULES, fill, lintText, makeRuleSet, rulesContentHash, validateRules, type Rule } from '../src/rules';
import { computeCharts } from '../src/index';
import { interpretNatal, interpretYear, type InterpSection } from '../src/interpret';
import { crossReference } from '../src/crossref';
import { PALACE_NAMES } from '../src/ziwei/types';
import { STAR_ORDER } from '../src/ziwei/engine';
import { MAJOR_ORDER } from '../src/ziwei/tables';
import { rng, solarInput } from './helpers';

const mk = (over: Partial<Rule>): Rule => ({
  id: 't.1', topic: 't', when: { kind: 'x' }, title: 't', plain: 'p', evidenceType: 'school',
  sources: [{ ref: 'zwqs' }], classical: [], basis: 'textbook', review: { status: 'draft', reviewer: null, date: null, note: null, history: [] }, ...over,
});
const rs = (rules: Rule[], corpus = {}) => makeRuleSet(rules, [], [], RULES.sources, corpus as never);

describe('规则数据与出处校验', () => {
  it('内置规则集通过校验；每条古籍引文都是语料原文的子串（伪造引文会使校验失败）', () => {
    expect(validateRules(RULES)).toEqual([]);
    const all = [...RULES.ziwei, ...RULES.bazi, ...RULES.cross];
    const quoted = all.filter((r) => r.classical.length > 0);
    expect(quoted.length).toBeGreaterThanOrEqual(100);
    for (const r of quoted) for (const q of r.classical) expect(RULES.corpus[q.corpusRef].text.includes(q.quote), r.id).toBe(true);
    // 审核状态仍全部为“未审核”：引文不等于审核
    expect(all.every((r) => r.review.status === 'draft')).toBe(true);
  });
  it('无出处、出处不存在、classical 无原文、引文不在语料中、已审核无审核人，均校验失败', () => {
    expect(validateRules(rs([mk({ sources: [] })]))[0]).toMatch(/没有出处/);
    expect(validateRules(rs([mk({ sources: [{ ref: 'nope' }] })]))[0]).toMatch(/不在来源目录/);
    expect(validateRules(rs([mk({ evidenceType: 'classical' })]))[0]).toMatch(/必须包含语料原文/);
    expect(validateRules(rs([mk({ evidenceType: 'classical', classical: [{ quote: '某句', corpusRef: 'c1' }] })]))[0]).toMatch(/不存在（禁止手写/);
    const corpus = { c1: { book: 'b', section: 's', text: '原文一段', url: 'u', license: 'PD', retrievedAt: '2026-01-01', sha256: 'x' } };
    expect(validateRules(rs([mk({ evidenceType: 'classical', classical: [{ quote: '原文', corpusRef: 'c1' }] })], corpus))).toEqual([]);
    expect(validateRules(rs([mk({ evidenceType: 'classical', classical: [{ quote: '改写', corpusRef: 'c1' }] })], corpus))[0]).toMatch(/不是语料原文的子串/);
    expect(validateRules(rs([mk({ review: { status: 'approved', reviewer: null, date: null, note: null, history: [] } })]))[0]).toMatch(/审核人/);
    expect(validateRules(rs([mk({}), mk({})]))[0]).toMatch(/重复/);
    // 无古籍原文的解释最高只能“已审核”，不能“已确认”
    expect(validateRules(rs([mk({ review: { status: 'approved', reviewer: '某老师', date: 'd', note: null, history: [] } })]))[0]).toMatch(/已确认.*古籍原文/);
    expect(validateRules(rs([mk({ review: { status: 'reviewed', reviewer: '某老师', date: 'd', note: null, history: [] } })]))).toEqual([]);
    expect(validateRules(rs([mk({ evidenceType: 'structural', review: { status: 'approved', reviewer: '某老师', date: 'd', note: null, history: [] } })]))).toEqual([]);
  });
  it('语言准则：绝对化措辞须改为定性概率；敏感说法须同句“转述传统说法 + 定性概率”；不替人下指令', () => {
    expect(lintText('你一定会发财')[0]).toMatch(/定性概率/);
    expect(lintText('此命注定大富')[0]).toMatch(/定性概率/);
    expect(lintText('必然早亡')[0]).toMatch(/定性概率/);
    // 敏感说法：缺少概率用语或缺少传统说法转述都不通过
    expect(lintText('此人克夫')).not.toEqual([]);
    expect(lintText('传统上认为此格克夫')).not.toEqual([]);
    expect(lintText('较大概率克夫')).not.toEqual([]);
    // 同句同时具备：通过
    expect(lintText('传统上认为此组合较大概率与婚姻波折有关，即古人所称“克夫”之说')).toEqual([]);
    expect(lintText('古人认为此格有一定可能早亡，但这只是传统说法，不能据此判断寿数')).toEqual([]);
    expect(lintText('你必须离婚')).toContain('替读者下指令或直接断言个人未来');
    expect(lintText('化忌并不等于必然不利')).toEqual([]);
    expect(lintText('十二长生：病、死是象征性的比喻，传统上倾向于……')).toEqual([]);
    expect(validateRules(rs([mk({ plain: '此命注定大富' })]))[0]).toMatch(/语言准则/);
    for (const r of [...RULES.ziwei, ...RULES.bazi, ...RULES.cross]) expect(lintText(r.title + r.plain), r.id).toEqual([]);
  });
  it('覆盖：十四主星、十二宫、四化、五个局、命宫×十四主星、十三类刑冲合害均有规则', () => {
    for (const s of MAJOR_ORDER) { expect(RULES.byId.has(`zw.star.${s}`)).toBe(true); expect(RULES.byId.has(`zw.sip.命宫.${s}`)).toBe(true); }
    for (const p of PALACE_NAMES) { expect(RULES.byId.has(`zw.palace.${p}`)).toBe(true); expect(RULES.byId.has(`zw.flow.ming.${p}`)).toBe(true); }
    for (const t of ['禄', '权', '科', '忌']) { expect(RULES.byId.has(`zw.transform.${t}`)).toBe(true); expect(RULES.byId.has(`zw.flow.transform.${t}`)).toBe(true); }
    for (const n of [2, 3, 4, 5, 6]) expect(RULES.byId.has(`zw.bureau.${n}`)).toBe(true);
  });
  it('规则内容哈希稳定，且不随审核状态变化', () => {
    const h = rulesContentHash(RULES);
    expect(rulesContentHash(RULES)).toBe(h);
    const copy = JSON.parse(JSON.stringify(RULES.ziwei)) as Rule[];
    copy[0].review.status = 'approved';
    copy[0].review.reviewer = 'x';
    expect(rulesContentHash(makeRuleSet(copy, RULES.bazi, RULES.cross, RULES.sources, RULES.corpus))).toBe(h);
    expect(fill('{a}-{b}', { a: 1 })).toBe('1-{b}');
  });
});

const allItems = (secs: InterpSection[]) => secs.flatMap((s) => s.items);

describe('解读引擎', () => {
  it('随机 400 盘：本命与流年解读不抛错、无未替换占位符、每条有出处与依据等级', () => {
    const r = rng(99);
    for (let k = 0; k < 400; k++) {
      const y = r.int(1902, 2040), b = computeCharts(solarInput(y, r.int(1, 12), r.int(1, 28), r.int(0, 23), r.int(0, 59), r.next() < 0.5 ? 'M' : 'F'));
      const secs = [...interpretNatal(b, RULES), ...interpretYear(b, y + r.int(1, 60), RULES)];
      expect(secs.length).toBeGreaterThanOrEqual(8);
      for (const it of allItems(secs)) {
        expect(it.text).not.toMatch(/\{\w+\}/);
        expect(it.sources.length).toBeGreaterThan(0);
        expect(['classical', 'school', 'modern', 'structural']).toContain(it.evidenceType);
        expect(it.reviewLabel).toBeTruthy();
      }
    }
  });
  it('刑冲合害：引擎可能产生的全部类型都有解释规则', () => {
    const r = rng(5), types = new Set<string>();
    for (let k = 0; k < 3000; k++) {
      const b = computeCharts(solarInput(r.int(1902, 2099), r.int(1, 12), r.int(1, 28), r.int(0, 23), 0)).bazi;
      for (const rel of b.relations) types.add(rel.type);
    }
    for (const t of types) expect(RULES.byId.has(`bz.rel.${t}`), t).toBe(true);
    expect(types.size).toBeGreaterThanOrEqual(8);
  });
  it('主星入宫：命宫用专门规则，其余宫位用模板组合并标注 composed', () => {
    const b = computeCharts(solarInput(1990, 6, 15, 10, 30));
    const secs = interpretNatal(b, RULES);
    const ming = secs.find((s) => s.id === 'zw-ming')!.items;
    expect(ming.every((i) => i.ruleId.startsWith('zw.sip.命宫.'))).toBe(true);
    const composed = secs.find((s) => s.id === 'zw-palaces')!.items.filter((i) => i.composed);
    expect(composed.length).toBeGreaterThan(5);
    expect(composed[0].evidenceType).toBe('modern');
  });
  it('确定性：同一盘的解读输出逐字节相同', () => {
    const b = computeCharts(solarInput(1990, 6, 15, 10, 30));
    expect(JSON.stringify(interpretNatal(b, RULES))).toBe(JSON.stringify(interpretNatal(b, RULES)));
  });
  it('命宫无主星时借对宫，覆盖到 zw.empty-ming', () => {
    const r = rng(3);
    let hit = 0;
    for (let k = 0; k < 400 && !hit; k++) {
      const b = computeCharts(solarInput(r.int(1902, 2099), r.int(1, 12), r.int(1, 28), r.int(0, 23), 0));
      const ming = b.ziwei.palaces.find((p) => p.name === '命宫')!;
      if (!ming.stars.some((s) => s.kind === 'major')) { hit++; expect(interpretNatal(b, RULES).find((s) => s.id === 'zw-ming')!.items[0].ruleId).toBe('zw.empty-ming'); }
    }
    expect(hit).toBe(1);
  });
});

describe('紫微×八字并列对照（仅结构性）', () => {
  it('立春与春节之间出生：年干支口径不同，如实标注 differ', () => {
    const b = computeCharts(solarInput(2024, 2, 6, 12, 0)); // 立春已过（甲辰），春节 2/10 未到（紫微仍癸卯）
    const c = crossReference(b, RULES);
    const y = c.find((x) => x.ruleId === 'cr.year-stem')!;
    expect(y.relation).toBe('differ');
    expect(y.ziwei).toContain('癸卯');
    expect(y.bazi).toContain('甲辰');
  });
  it('两者一致时标 agree；无综合评分字段；带流年时含流年并列', () => {
    const b = computeCharts(solarInput(1990, 6, 15, 10, 30));
    const c = crossReference(b, RULES, 2024);
    expect(c.find((x) => x.ruleId === 'cr.year-stem')!.relation).toBe('agree');
    expect(c.some((x) => x.ruleId === 'cr.flow-year')).toBe(true);
    for (const it of c) expect(Object.keys(it)).not.toContain('score');
  });
});
