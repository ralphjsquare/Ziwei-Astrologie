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
  edition?: string;
  /** 源文本按版面硬换行（行中断句）时，合并单个换行、保留空行分段 */
  joinLines?: boolean;
  /** 子页面标题（如 “卷一”），用作分节名前缀；无则空 */
  page?: string;
}

export class CorpusImportError extends Error {}

export function buildCorpusEntries(meta: CorpusSourceMeta, plain: string): Record<string, CorpusEntry> {
  if (!meta.licenseVerified) throw new CorpusImportError(`来源 ${meta.id} 的许可条款尚未标记为已核对（licenseVerified=false），拒绝入库`);
  if (!meta.license || !meta.url || !meta.retrievedAt) throw new CorpusImportError(`来源 ${meta.id} 缺少许可、URL 或获取日期`);
  const out: Record<string, CorpusEntry> = {};
  splitSections(plain).forEach((sec, i) => {
    const s = meta.joinLines ? { heading: sec.heading, text: sec.text.replace(/(?<!\n)\n(?!\n)/g, '') } : sec;
    const key = `${meta.id}${meta.page ? '/' + meta.page : ''}#${i + 1}`;
    const section = [meta.page, s.heading].filter(Boolean).join('·') || meta.book;
    out[key] = { book: meta.book, section, text: s.text, url: meta.url, license: meta.license, retrievedAt: meta.retrievedAt, sha256: sha256(s.text), ...(meta.edition ? { edition: meta.edition } : {}) };
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

export interface GroundingItem { ruleId: string; plain: string; book: string; quotes: string[] }

/**
 * 依据语料对规则“落地”：白话解释改写为忠实转述，引文逐条在语料中定位（必须是某一条语料原文的唯一子串），
 * 出处改为语料所在篇目。`evidenceType` 保持 school（转述说明），`basis` 记为 quoted。返回错误列表。
 */
export function applyGrounding(rules: Rule[], corpus: Record<string, CorpusEntry>, items: GroundingItem[], bookRefs: Record<string, string>): { updated: number; errors: string[] } {
  const errors: string[] = [];
  let updated = 0;
  for (const it of items) {
    const r = rules.find((x) => x.id === it.ruleId);
    if (!r) { errors.push(`找不到规则 ${it.ruleId}`); continue; }
    const pool = Object.entries(corpus).filter(([k]) => k.startsWith(it.book === 'zwqs' ? 'zwqs' : it.book));
    const found: { corpusRef: string; quote: string }[] = [];
    let ok = true;
    for (const q of it.quotes) {
      const hits = pool.filter(([, c]) => c.text.includes(q));
      if (hits.length === 0) { errors.push(`${it.ruleId}: 引文在语料中找不到：${q.slice(0, 24)}…`); ok = false; }
      else if (hits.length > 1) { errors.push(`${it.ruleId}: 引文在多条语料中重复，请加长以唯一定位：${q.slice(0, 24)}…（${hits.map((h) => h[0]).join('、')}）`); ok = false; }
      else found.push({ corpusRef: hits[0][0], quote: q });
    }
    if (!ok) continue;
    r.plain = it.plain;
    r.classical = found.map((f) => { const old = r.classical.find((o) => o.quote === f.quote && o.variant); return old ? { ...f, variant: old.variant } : f; });
    const sections = [...new Set(found.map((f) => corpus[f.corpusRef].section))];
    r.sources = sections.map((sec) => ({ ref: bookRefs[it.book] ?? it.book, section: sec, note: it.book === 'zpzq' || it.book === 'yhzp' ? '【版本未核实】引文来自第三方电子书转录本，整理者与底本不明，须对照影印本核对' : it.book === 'dts' ? '引文来自维基文库《滴天髓輯要》转录本，页面未附影印本，须对照影印本核对' : '引文来自维基文库转录本，底本未标明，须对照影印本核对' }));
    r.basis = 'quoted';
    if (r.evidenceType === 'structural') r.evidenceType = 'structural';
    else if (r.evidenceType !== 'school') r.evidenceType = 'school';
    updated++;
  }
  return { updated, errors };
}
