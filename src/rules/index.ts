import { hashOf } from '../core/hash';
import zwJson from './ziwei.json';
import bzJson from './bazi.json';
import crJson from './cross.json';
import srcJson from './sources.json';
import corpusJson from './corpus.json';

export type EvidenceType = 'classical' | 'school' | 'modern' | 'structural';
export type ReviewStatus = 'draft' | 'reviewed' | 'approved' | 'rejected';
export const EVIDENCE_LABEL: Record<EvidenceType, string> = { classical: '古籍原文', school: '流派观点', modern: '现代整理', structural: '算法结构' };
export type Basis = 'algorithmic' | 'template' | 'quoted' | 'chapter-pointer' | 'textbook';
export const BASIS_LABEL: Record<Basis, string> = {
  algorithmic: '算法定义', template: '模板组合', quoted: '转述古籍并附原文引文（转录本，底本待核）', 'chapter-pointer': '篇目指引（未核对原文）', textbook: '通行说法（无具体篇目，待核）',
};
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
  /** 依据类型：算法定义 / 模板组合 / 篇目指引 / 通行说法 */
  basis: Basis;
  review: ReviewRecord;
  data?: Record<string, string>;
}
export interface SourceEntry { book: string; author: string; edition: string; verified: boolean; note: string }
export interface CorpusEntry { book: string; section: string; text: string; url: string; license: string; retrievedAt: string; sha256: string; /** 底本/版本说明（维基文库转录本多未标明底本） */ edition?: string }

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

/** 定性概率用语（由小到大），解释文字涉及婚姻波折、健康起伏、寿数、灾厄等敏感说法时，必须使用这一类词。 */
export const PROBABILITY_LEVELS = ['极小概率', '较小概率', '有一定可能', '较大概率', '极大概率'] as const;
const PROB_WORDS = /极小概率|较小概率|小概率|不太可能|有一定可能|有可能|可能|较大概率|大概率|很可能|极大概率|多半/;
const ATTRIBUTION = /传统上|古人|旧说|古籍|命书|一般认为|有的说法|有些流派|某些流派/;
const SENSITIVE = /克夫|克妻|克父|克母|克子|短命|早亡|夭折|血光|灾祸|大凶|官司|离婚|重病/;

/**
 * 解释文字的语言准则（docs/INTERPRETATION_GUIDELINES.md）：
 * 1. 不用绝对化、宿命化措辞（必定、注定、肯定会……），改用定性概率表述；
 * 2. 涉及婚姻波折、寿数、灾厄等敏感说法（克夫、短命……）时，同一句里必须同时有“传统说法的转述”和“定性概率用语”；
 * 3. 不替读者下指令。返回违规描述列表。
 */
export function lintText(text: string): string[] {
  const out: string[] = [];
  if (/必定|一定会|注定|肯定会|绝对|定会|势必|必死/.test(text) || /(?<!不等于|并不|不一定|不是)必然/.test(text)) {
    out.push('绝对化/宿命化用语，请改用定性概率表述（极小概率／较小概率／有一定可能／较大概率／极大概率）');
  }
  for (const sentence of text.split(/[。；！？\n]/)) {
    if (SENSITIVE.test(sentence) && !(PROB_WORDS.test(sentence) && ATTRIBUTION.test(sentence))) {
      out.push(`敏感说法“${SENSITIVE.exec(sentence)![0]}”须同句转述传统说法并使用定性概率用语`);
    }
  }
  if (/你(会|将|必须|应该)|一定要|务必|必须(离婚|结婚|投资|手术|服药|辞职)/.test(text)) out.push('替读者下指令或直接断言个人未来');
  return out;
}

/** 规则内容哈希（不含审核状态，审核不改变解释内容）。 */
export const rulesContentHash = (rs: RuleSet): string =>
  hashOf([...rs.byId.values()].map((r) => ({ id: r.id, when: r.when, title: r.title, plain: r.plain, evidenceType: r.evidenceType, basis: r.basis, sources: r.sources, classical: r.classical, data: r.data ?? null })));

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
    for (const m of lintText(r.title + r.plain)) errs.push(`${at}: 语言准则：${m}`);
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
    if (r.review.status === 'approved' && r.evidenceType !== 'structural' && !r.classical.length) errs.push(`${at}: “已确认”需要古籍原文引用（或为算法结构类）；无原文的解释最高只能到“已审核”`);
    if (!['algorithmic', 'template', 'quoted', 'chapter-pointer', 'textbook'].includes(r.basis)) errs.push(`${at}: basis 非法`);
  }
  for (const [k, c] of Object.entries(rs.corpus)) {
    if (!c.url || !c.license || !c.sha256 || !c.retrievedAt) errs.push(`语料 ${k}: 缺少来源 URL、许可、获取日期或校验和`);
  }
  return errs;
}

/** 占位符替换；未提供的变量原样保留以便测试发现。 */
export const fill = (t: string, v: Record<string, string | number>): string => t.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m));
