import { describe, expect, it } from 'vitest';
import { CorpusImportError, applyQuotes, buildCorpusEntries, findCandidates, splitSections, wikitextToPlain } from '../src/corpus';
import { RULES, validateRules, makeRuleSet, type CorpusEntry, type Rule } from '../src/rules';

const WIKI = `{{header|title=示例}}
<!-- 注释 -->
== 卷一 ==
紫微星[[乃|乃]]帝座，<ref>脚注</ref>主[[尊貴]]。
{{ruby|甲|jia}}
=== 太微賦 ===
太微垣中，紫微星為帝座。
== 卷二 ==
[[File:x.png]]天機屬木，'''主'''智慧。`;

const META = { id: 'zwqs', book: '紫微斗數全書', url: 'https://example.org/wiki/x', license: 'PD（原典）；站点文本 CC BY-SA 4.0', retrievedAt: '2026-10-01', licenseVerified: true };

describe('语料处理（纯函数，离线可测）', () => {
  it('维基文本清洗：去模板、注释、脚注、文件链接，保留链接文字', () => {
    const p = wikitextToPlain(WIKI);
    expect(p).not.toMatch(/\{\{|<!--|<ref|\[\[|'''/);
    expect(p).toContain('紫微星乃帝座，主尊貴。');
    expect(p).toContain('天機屬木，主智慧。');
  });
  it('分节：按标题切分，标题前无文字则不产生空节', () => {
    const s = splitSections(wikitextToPlain(WIKI));
    expect(s.map((x) => x.heading)).toEqual(['卷一', '太微賦', '卷二']);
    expect(s[1].text).toContain('太微垣中');
  });
  it('入库：未核对许可拒绝；核对后生成含 URL、许可、日期、SHA-256 的条目', () => {
    const plain = wikitextToPlain(WIKI);
    expect(() => buildCorpusEntries({ ...META, licenseVerified: false }, plain)).toThrow(CorpusImportError);
    const e = buildCorpusEntries(META, plain);
    const keys = Object.keys(e);
    expect(keys).toEqual(['zwqs#1', 'zwqs#2', 'zwqs#3']);
    expect(e['zwqs#2'].sha256).toHaveLength(64);
    expect(e['zwqs#2'].section).toBe('太微賦');
  });
  it('引文候选检索', () => {
    const corpus = buildCorpusEntries(META, wikitextToPlain(WIKI));
    const c = findCandidates(corpus, ['紫微星', '天機']);
    expect(c['紫微星'].length).toBeGreaterThanOrEqual(2);
    expect(c['天機'][0].excerpt).toContain('天機屬木');
  });
  it('引文回写：必须是语料原文子串；claimSupported 才升级为 classical；升级后通过全部校验', () => {
    const corpus = buildCorpusEntries(META, wikitextToPlain(WIKI)) as Record<string, CorpusEntry>;
    const rules = JSON.parse(JSON.stringify(RULES.ziwei)) as Rule[];
    const k = rules.findIndex((r) => r.classical.length === 0 && r.evidenceType === 'school'); // 找一条尚无引文的规则
    const id = rules[k].id;
    const bad = applyQuotes(rules, corpus, [{ ruleId: id, quotes: [{ corpusRef: 'zwqs#2', quote: '编造的一句话' }], claimSupported: true }]);
    expect(bad.errors[0]).toMatch(/不是.*原文子串/);
    expect(rules[k].classical).toEqual([]);
    const noSupport = applyQuotes(rules, corpus, [{ ruleId: id, quotes: [{ corpusRef: 'zwqs#2', quote: '紫微星為帝座' }], claimSupported: false }]);
    expect(noSupport.updated).toBe(1);
    expect(rules[k].evidenceType).toBe('school');
    applyQuotes(rules, corpus, [{ ruleId: id, quotes: [{ corpusRef: 'zwqs#2', quote: '紫微星為帝座' }], claimSupported: true }]);
    expect(rules[k].evidenceType).toBe('classical');
    expect(rules[k].classical).toHaveLength(1);
    expect(validateRules(makeRuleSet(rules, RULES.bazi, RULES.cross, RULES.sources, { ...RULES.corpus, ...corpus }))).toEqual([]);
  });
});
