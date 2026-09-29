import { hashOf } from '../core/hash';
import zwJson from './ziwei.json';
import bzJson from './bazi.json';
import crJson from './cross.json';
import srcJson from './sources.json';
import corpusJson from './corpus.json';

export type EvidenceType = 'classical' | 'school' | 'modern' | 'structural';
export type ReviewStatus = 'draft' | 'reviewed' | 'approved' | 'rejected';
export const EVIDENCE_LABEL: Record<EvidenceType, string> = { classical: '古籍原文', school: '流派观点', modern: '现代整理', structural: '算法结构' };
export const REVIEW_LABEL: Record<ReviewStatus, string> = { draft: '未审核', reviewed: '已审核', approved: '已确认', rejected: '已驳回' };

export interface ReviewRecord { status: ReviewStatus; reviewer: string | null; date: string | null; note: string | null; history: { status: ReviewStatus; reviewer: string | null; date: string | null; note: string | null }[] }
export interface RuleSourceRef { ref: string; section?: string; note?: string }
export interface Rule {
  id: string;
  topic: string;
  when: Record<string, string | number>;
  title: string;
  plain: string;
  evidenceType: EvidenceType;
  sources: RuleSourceRef[];
  classical: { quote: string; corpusRef: string }[];
  review: ReviewRecord;
  data?: Record<string, string>;
}
export interface SourceEntry { book: string; author: string; edition: string; verified: boolean; note: string }
export interface CorpusEntry { book: string; section: string; text: string; url: string; license: string; retrievedAt: string; sha256: string }

export interface RuleSet {
  version: string;
  ziwei: Rule[];
  bazi: Rule[];
  cross: Rule[];
  sources: Record<string, SourceEntry>;
  corpus: Record<string, CorpusEntry>;
  byId: Map<string, Rule>;
}

export function makeRuleSet(z: Rule[], b: Rule[], c: Rule[], sources: Record<string, SourceEntry>, corpus: Record<string, CorpusEntry>): RuleSet {
  const byId = new Map<string, Rule>();
  for (const r of [...z, ...b, ...c]) byId.set(r.id, r);
  return { version: 'rules/1', ziwei: z, bazi: b, cross: c, sources, corpus, byId };
}

export const RULES: RuleSet = makeRuleSet(
  zwJson as unknown as Rule[], bzJson as unknown as Rule[], crJson as unknown as Rule[],
  srcJson as Record<string, SourceEntry>, corpusJson as unknown as Record<string, CorpusEntry>,
);

/** 规则内容哈希（不含审核状态，审核不改变解释内容）。 */
export const rulesContentHash = (rs: RuleSet): string =>
  hashOf([...rs.byId.values()].map((r) => ({ id: r.id, when: r.when, title: r.title, plain: r.plain, evidenceType: r.evidenceType, sources: r.sources, classical: r.classical, data: r.data ?? null })));

/** 校验：任何规则必须有出处；classical 必须引用语料库中的原文；ID 唯一。返回错误列表。 */
export function validateRules(rs: RuleSet): string[] {
  const errs: string[] = [];
  const seen = new Set<string>();
  const types: EvidenceType[] = ['classical', 'school', 'modern', 'structural'];
  const statuses: ReviewStatus[] = ['draft', 'reviewed', 'approved', 'rejected'];
  for (const r of [...rs.ziwei, ...rs.bazi, ...rs.cross]) {
    const at = `规则 ${r.id}`;
    if (!r.id) errs.push('存在缺少 id 的规则');
    if (seen.has(r.id)) errs.push(`${at}: id 重复`);
    seen.add(r.id);
    if (!r.title || !r.plain) errs.push(`${at}: 缺少标题或白话解释`);
    if (!types.includes(r.evidenceType)) errs.push(`${at}: evidenceType 非法`);
    if (!statuses.includes(r.review?.status)) errs.push(`${at}: review.status 非法`);
    if (!r.sources?.length) errs.push(`${at}: 没有出处（sources 为空）`);
    for (const s of r.sources ?? []) if (!rs.sources[s.ref]) errs.push(`${at}: 出处 ${s.ref} 不在来源目录`);
    if (r.evidenceType === 'classical' && !r.classical.length) errs.push(`${at}: classical 类规则必须包含语料原文引用`);
    for (const q of r.classical) {
      const c = rs.corpus[q.corpusRef];
      if (!c) errs.push(`${at}: 语料引用 ${q.corpusRef} 不存在（禁止手写古籍原文）`);
      else if (!c.text.includes(q.quote)) errs.push(`${at}: 引文不是语料原文的子串`);
    }
    if ((r.review.status === 'reviewed' || r.review.status === 'approved') && !r.review.reviewer) errs.push(`${at}: 已审核状态必须记录审核人`);
  }
  for (const [k, c] of Object.entries(rs.corpus)) {
    if (!c.url || !c.license || !c.sha256 || !c.retrievedAt) errs.push(`语料 ${k}: 缺少来源 URL、许可、获取日期或校验和`);
  }
  return errs;
}

/** 占位符替换；未提供的变量原样保留以便测试发现。 */
export const fill = (t: string, v: Record<string, string | number>): string => t.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m));
