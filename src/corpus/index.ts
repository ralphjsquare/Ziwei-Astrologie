// 古籍语料的纯函数：维基文本清洗、分节、入库条目生成、引文候选检索、引文回写校验。
// 网络与文件读写在 tools/ 中；这里不访问环境。
import { sha256 } from '../core/hash';
import type { CorpusEntry, Rule } from '../rules';

/** 维基文本 → 纯文本：去模板、注释、脚注、HTML 标签，保留链接文字；标题行保留为“== 标题 ==”以便分节。 */
export function wikitextToPlain(src: string): string {
  let t = src.replace(/<!--[\s\S]*?-->/g, '');
  t = t.replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '');
  for (let i = 0; i < 5; i++) t = t.replace(/\{\{[^{}]*\}\}/g, '');
  t = t.replace(/\[\[(?:File|Image|文件|檔案|分類|Category)[^\]]*\]\]/gi, '');
  t = t.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2').replace(/\[\[([^\]]*)\]\]/g, '$1');
  t = t.replace(/'''?/g, '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
  return t.split('\n').map((l) => l.replace(/[ \t　]+$/g, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export interface Section { heading: string; text: string }

/** 按“== 标题 ==”分节；标题前的文字归入 heading=''（全文首段）。 */
export function splitSections(plain: string): Section[] {
  const out: Section[] = [];
  let cur: Section = { heading: '', text: '' };
  for (const line of plain.split('\n')) {
    const m = /^(={2,6})\s*(.+?)\s*\1\s*$/.exec(line);
    if (m) { if (cur.text.trim() || cur.heading) out.push({ heading: cur.heading, text: cur.text.trim() }); cur = { heading: m[2], text: '' }; }
    else cur.text += line + '\n';
  }
  if (cur.text.trim() || cur.heading) out.push({ heading: cur.heading, text: cur.text.trim() });
  return out.filter((s) => s.text.length > 0);
}

export interface CorpusSourceMeta {
  id: string; book: string; url: string; license: string; retrievedAt: string;
  /** 用户/审核人明确核对过来源站点的许可条款 */
  licenseVerified: boolean;
  /** 子页面标题（如 “卷一”），用作分节名前缀；无则空 */
  page?: string;
}

export class CorpusImportError extends Error {}

export function buildCorpusEntries(meta: CorpusSourceMeta, plain: string): Record<string, CorpusEntry> {
  if (!meta.licenseVerified) throw new CorpusImportError(`来源 ${meta.id} 的许可条款尚未标记为已核对（licenseVerified=false），拒绝入库`);
  if (!meta.license || !meta.url || !meta.retrievedAt) throw new CorpusImportError(`来源 ${meta.id} 缺少许可、URL 或获取日期`);
  const out: Record<string, CorpusEntry> = {};
  splitSections(plain).forEach((s, i) => {
    const key = `${meta.id}${meta.page ? '/' + meta.page : ''}#${i + 1}`;
    const section = [meta.page, s.heading].filter(Boolean).join('·') || meta.book;
    out[key] = { book: meta.book, section, text: s.text, url: meta.url, license: meta.license, retrievedAt: meta.retrievedAt, sha256: sha256(s.text) };
  });
  return out;
}

export interface QuoteCandidate { corpusRef: string; section: string; excerpt: string }

/** 在语料中检索包含关键词的段落，返回带上下文的摘录，供人工挑选引文。 */
export function findCandidates(corpus: Record<string, CorpusEntry>, keywords: string[], perKeyword = 3, context = 40): Record<string, QuoteCandidate[]> {
  const res: Record<string, QuoteCandidate[]> = {};
  for (const kw of keywords) {
    const list: QuoteCandidate[] = [];
    for (const [ref, c] of Object.entries(corpus)) {
      let from = 0;
      while (list.length < perKeyword) {
        const i = c.text.indexOf(kw, from);
        if (i < 0) break;
        list.push({ corpusRef: ref, section: `${c.book}·${c.section}`, excerpt: c.text.slice(Math.max(0, i - context), i + kw.length + context).replace(/\n/g, ' ') });
        from = i + kw.length + context;
      }
      if (list.length >= perKeyword) break;
    }
    res[kw] = list;
  }
  return res;
}

export interface QuotePatch { ruleId: string; quotes: { corpusRef: string; quote: string }[]; /** 审核人确认该引文确实支持本条解释 */ claimSupported: boolean }

/** 应用人工确认的引文：引文必须是语料原文的子串；claimSupported=true 才把依据等级升为 classical。 */
export function applyQuotes(rules: Rule[], corpus: Record<string, CorpusEntry>, patches: QuotePatch[]): { updated: number; errors: string[] } {
  const errors: string[] = [];
  let updated = 0;
  for (const p of patches) {
    const r = rules.find((x) => x.id === p.ruleId);
    if (!r) { errors.push(`找不到规则 ${p.ruleId}`); continue; }
    let ok = true;
    for (const q of p.quotes) {
      const c = corpus[q.corpusRef];
      if (!c) { errors.push(`${p.ruleId}: 语料 ${q.corpusRef} 不存在`); ok = false; }
      else if (!c.text.includes(q.quote)) { errors.push(`${p.ruleId}: 引文不是 ${q.corpusRef} 的原文子串`); ok = false; }
    }
    if (!ok) continue;
    for (const q of p.quotes) if (!r.classical.some((x) => x.corpusRef === q.corpusRef && x.quote === q.quote)) r.classical.push({ quote: q.quote, corpusRef: q.corpusRef });
    if (p.claimSupported && r.classical.length) { r.evidenceType = 'classical'; r.basis = 'chapter-pointer'; }
    updated++;
  }
  return { updated, errors };
}
