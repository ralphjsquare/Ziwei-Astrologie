// 审核导出与导入（纯函数）。CLI 与网页共用。
import { BASIS_LABEL, EVIDENCE_LABEL, REVIEW_LABEL, type ReviewStatus, type Rule, type RuleSet } from '../rules';
import type { InterpSection } from '../interpret';

export type ReviewScope = 'ziwei' | 'bazi' | 'cross' | 'all';
export type ReviewFormat = 'md' | 'json' | 'csv';

export function selectRules(rs: RuleSet, scope: ReviewScope, status: ReviewStatus | 'all'): Rule[] {
  const pool = scope === 'ziwei' ? rs.ziwei : scope === 'bazi' ? rs.bazi : scope === 'cross' ? rs.cross : [...rs.ziwei, ...rs.bazi, ...rs.cross];
  return pool.filter((r) => status === 'all' || r.review.status === status);
}

const srcText = (rs: RuleSet, r: Rule) =>
  r.sources.map((s) => `${rs.sources[s.ref].book}${s.section ? '·' + s.section : ''}${rs.sources[s.ref].verified ? '' : '（底本未核对）'}`).join('；');
export const SOURCE_CLASS_LABEL: Record<string, string> = { PRIMARY_TEXT: '原文明确', TEXTUAL_VARIANT: '转录异文（经其他传本校读）', CLASSICAL_SECONDARY: '古籍二手引述', MODERN_COMMON: '现代通行整理', IMPLEMENTATION_ONLY: '仅软件实现支持', DERIVED_FROM_TEXT: '原文只给例子、判据反推' };
const cond = (r: Rule) => Object.entries(r.when).map(([k, v]) => `${k}=${v}`).join(' ');

const csvCell = (v: string) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);

export function exportRules(rs: RuleSet, rules: Rule[], format: ReviewFormat, generatedAt: string): string {
  if (format === 'json') {
    return JSON.stringify({ generatedAt, rulesVersion: rs.version, count: rules.length, rules: rules.map((r) => ({
      id: r.id, condition: r.when, title: r.title, plain: r.plain, evidenceType: r.evidenceType, basis: r.basis, sources: r.sources.map((s) => ({ ...s, book: rs.sources[s.ref].book, verified: rs.sources[s.ref].verified })),
      ...(r.sourceClass ? { sourceClass: r.sourceClass } : {}), classical: r.classical, review: r.review,
    })) }, null, 1);
  }
  if (format === 'csv') {
    const head = ['id', '触发条件', '标题', '白话解释', '依据等级', '来源分级', '出处', '古籍原文', '审核状态', '审核人', '审核意见(请填写)', '新状态(draft/reviewed/approved/rejected)'];
    const rows = rules.map((r) => [r.id, cond(r), r.title, r.plain, EVIDENCE_LABEL[r.evidenceType] + '／' + BASIS_LABEL[r.basis], r.sourceClass ? SOURCE_CLASS_LABEL[r.sourceClass] : '', srcText(rs, r), r.classical.map((q) => q.quote + (q.variant ? `〔异文：${q.variant}〕` : '')).join(' | ') || '（尚未入库）', REVIEW_LABEL[r.review.status], r.review.reviewer ?? '', '', '']);
    return '﻿' + [head, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  }
  const L: string[] = [`# 解读规则审核文档`, '', `- 生成时间：${generatedAt}`, `- 规则集版本：${rs.version}`, `- 规则数量：${rules.length}`, '',
    '> 说明：「古籍原文」栏为语料中逐字摘录的引文（维基文库转录本，底本未标明，须对照影印本核对）；无引文的规则为通行说法或算法结构。请在“审核意见”与“新状态”处填写，可用 `npm run review:import` 导回。', ''];
  for (const r of rules) {
    L.push(`## ${r.id}｜${r.title}`, '',
      `- 触发条件：\`${cond(r)}\``, `- 依据等级：${EVIDENCE_LABEL[r.evidenceType]}；依据类型：${BASIS_LABEL[r.basis]}${r.sourceClass ? '；来源分级：' + SOURCE_CLASS_LABEL[r.sourceClass] : ''}`, `- 出处：${srcText(rs, r)}`,
      `- 当前审核状态：${REVIEW_LABEL[r.review.status]}${r.review.reviewer ? '（' + r.review.reviewer + '）' : ''}`, '',
      `**白话解释**：${r.plain}`, '',
      `**古籍原文**：${r.classical.length ? r.classical.map((q) => '「' + q.quote + '」' + (q.variant ? `（版本异文：${q.variant}）` : '')).join('；') : '（尚未入库）'}`, '',
      `**审核意见**：`, '', `**新状态**（draft / reviewed / approved / rejected）：`, '', '---', '');
  }
  return L.join('\n');
}

/** 样例盘 + 全部解读，用于老师针对具体命盘评审 */
export function exportChartReview(title: string, sections: InterpSection[], calcHash: string, generatedAt: string): string {
  const L = [`# 命盘解读审核：${title}`, '', `- 生成时间：${generatedAt}`, `- 计算哈希：\`${calcHash}\``, ''];
  for (const s of sections) {
    L.push(`## ${s.heading}`, '');
    for (const it of s.items) {
      L.push(`### ${it.title}（${it.ruleId}）`, `- 位置：${it.context}`, `- 依据等级：${it.evidenceLabel}；审核状态：${it.reviewLabel}${it.composed ? '；模板组合' : ''}`,
        `- 出处：${it.sources.map((x) => x.book + (x.section ? '·' + x.section : '') + (x.verified ? '' : '（底本未核对）')).join('；')}`, '', it.text, '', '审核意见：', '');
    }
  }
  return L.join('\n');
}

export interface ReviewPatch { id: string; status: ReviewStatus; reviewer: string; date: string; note: string }

/** 应用审核补丁：追加历史，不覆盖旧记录。返回被更新的规则数与错误。 */
export function applyPatches(rules: Rule[], patches: ReviewPatch[]): { updated: number; errors: string[] } {
  const errors: string[] = [];
  let updated = 0;
  const statuses = ['draft', 'reviewed', 'approved', 'rejected'];
  for (const p of patches) {
    const r = rules.find((x) => x.id === p.id);
    if (!r) { errors.push(`找不到规则 ${p.id}`); continue; }
    if (!statuses.includes(p.status)) { errors.push(`${p.id}: 状态 ${p.status} 非法`); continue; }
    if ((p.status === 'reviewed' || p.status === 'approved') && !p.reviewer) { errors.push(`${p.id}: 缺少审核人`); continue; }
    r.review.history.push({ status: r.review.status, reviewer: r.review.reviewer, date: r.review.date, note: r.review.note });
    r.review.status = p.status; r.review.reviewer = p.reviewer || null; r.review.date = p.date; r.review.note = p.note || null;
    updated++;
  }
  return { updated, errors };
}

/** 解析简单 CSV（支持引号），返回二维数组 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function patchesFromCsv(text: string, reviewer: string, date: string): ReviewPatch[] {
  const rows = parseCsv(text);
  const head = rows[0] ?? [];
  const iId = head.indexOf('id'), iNote = head.findIndex((h) => h.startsWith('审核意见')), iSt = head.findIndex((h) => h.startsWith('新状态'));
  const out: ReviewPatch[] = [];
  for (const r of rows.slice(1)) {
    const st = (r[iSt] ?? '').trim();
    if (!st) continue;
    out.push({ id: r[iId], status: st as ReviewStatus, reviewer, date, note: (r[iNote] ?? '').trim() });
  }
  return out;
}
