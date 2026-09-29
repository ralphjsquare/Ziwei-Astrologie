// 把 crosscheck.json 里与第二来源（Kanripo 文渊阁四库本）不一致的《三命通会》引文，生成可勾选的确认表 docs/sources/CROSSCHECK_REVIEW.md。
// 用法：npx tsx tools/crosscheck-sheet.ts（需先运行 npm run corpus:crosscheck 下载四库本到本地）
import { readFileSync, writeFileSync } from 'node:fs';
import * as OpenCC from 'opencc-js';

const t2s = OpenCC.Converter({ from: 'tw', to: 'cn' });
const FOLD: Record<string, string> = { 隂: '阴', 夀: '寿', 䕃: '荫', 㤀: '忘', 刼: '劫', 逄: '逢', 髙: '高', 寛: '宽', 恵: '惠', 惟: '唯', 徳: '德', 巳: '己', 已: '己', 戍: '戌', 冝: '宜', 麤: '粗', 𢎞: '弘', 絶: '绝', 槩: '概', 竒: '奇', 㓙: '凶', 㡬: '几', 㸔: '看', 乗: '乘', 㑹: '会', 葢: '盖', 毋: '母' };
const fold = (s: string) => s.replace(/./gu, (c) => FOLD[c] ?? c);
const norm = (s: string) => fold(t2s(s.replace(/<pb:[^>]*>/g, '').replace(/｛[^｝]*｝/g, '').replace(/[¶\s]/g, '').replace(/[^㐀-鿿\u{20000}-\u{2ffff}]/gu, '')).replace(/煞/g, '杀'));

const cc = JSON.parse(readFileSync('docs/sources/crosscheck.json', 'utf8')) as { rows: { ruleId: string; quote: string; found: boolean }[] };
const corpus = JSON.parse(readFileSync('src/rules/corpus.json', 'utf8')) as Record<string, { text: string; section: string }>;
let kan = '';
for (let i = 1; i <= 12; i++) kan += norm(readFileSync(`docs/sources/raw/kanripo-smtht/KR3g0042_${String(i).padStart(3, '0')}.txt`, 'utf8')) + '|';

const bad = cc.rows.filter((r) => !r.found);
const byQuote = new Map<string, string[]>();
for (const r of bad) byQuote.set(r.quote, [...(byQuote.get(r.quote) ?? []), r.ruleId]);

const L = ['# 《三命通会》引文差异确认表', '',
  '维基文库转录本（本项目语料）与 Kanripo 文渊阁四库全书本逐条核对，一致的已忽略繁简、异体字、己/巳误刻；下面是文字确有不同的引文。已裁决的结果记在 `crosscheck-decisions.json`。',
  '', '- **保留**：仍用维基文库文字，但在规则里标注“与四库本有异文”。',
  '- **删除引文**：这条规则不再带这句引文（规则本身保留，降回“流派观点”）。',
  '- 两个版本都是转录本，都不等于影印本；无法判断谁对时，建议选“保留”并保持 draft。', '', '---', ''];
let n = 0;
for (const [quote, rules] of byQuote) {
  n++;
  const nq = norm(quote);
  const ref = Object.entries(corpus).find(([k, c]) => k.startsWith('smtht') && c.text.includes(quote));
  const wiki = ref ? (() => { const i = ref[1].text.indexOf(quote); return `${ref[1].text.slice(Math.max(0, i - 20), i)}【${quote}】${ref[1].text.slice(i + quote.length, i + quote.length + 20)}`; })() : '（未找到）';
  let k = '（四库本未找到相近文字）';
  for (let s = 0; s + 4 <= nq.length; s += 2) { const p = nq.slice(s, s + 4); const at = kan.indexOf(p); if (at >= 0) { k = kan.slice(Math.max(0, at - s), at - s + nq.length + 6); break; } }
  L.push(`## ${n}. ${rules.join('、')}`, '', `- 维基文库出处：${ref ? ref[0] + '（' + ref[1].section + '）' : '—'}`, `- 维基文库原文：${wiki}`, `- 四库本对应处（已转简体、去标点）：${k}`, `- 本项目引文（去标点）：${nq}`, '',
    `- [ ] 保留（标注异文）（Q${n}-keep）`, `- [ ] 删除引文（Q${n}-drop）`, '- 备注：', '', '---', '');
}
writeFileSync('docs/sources/CROSSCHECK_REVIEW.md', L.join('\n'), 'utf8');
console.log(`已生成 docs/sources/CROSSCHECK_REVIEW.md（${n} 处差异，涉及 ${bad.length} 条规则引文）`);
