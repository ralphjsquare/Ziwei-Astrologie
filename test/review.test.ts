import { describe, expect, it } from 'vitest';
import { RULES, type Rule } from '../src/rules';
import { computeCharts } from '../src/index';
import { interpretNatal } from '../src/interpret';
import { applyPatches, exportChartReview, exportRules, parseCsv, patchesFromCsv, selectRules } from '../src/review';
import { solarInput } from './helpers';

describe('审核导出与导入', () => {
  it('Markdown/JSON/CSV 三种格式都包含全部规则 ID、出处、审核状态与留白栏', () => {
    const rules = selectRules(RULES, 'ziwei', 'all');
    const md = exportRules(RULES, rules, 'md', '2026-10-01');
    const json = JSON.parse(exportRules(RULES, rules, 'json', '2026-10-01'));
    const csv = exportRules(RULES, rules, 'csv', '2026-10-01');
    expect(json.count).toBe(rules.length);
    for (const r of rules) { expect(md).toContain(r.id); expect(csv).toContain(r.id); }
    expect(md).toContain('审核意见');
    expect(md).toContain('底本未核对');
    expect(json.rules[0].sources[0].verified).toBe(false);
    expect(parseCsv(csv).length).toBe(rules.length + 1);
  });
  it('范围与状态筛选', () => {
    expect(selectRules(RULES, 'cross', 'all').length).toBe(RULES.cross.length);
    expect(selectRules(RULES, 'all', 'approved')).toEqual([]);
    expect(selectRules(RULES, 'all', 'draft').length).toBe(RULES.ziwei.length + RULES.bazi.length + RULES.cross.length);
  });
  it('样例盘 + 全部解读文档', () => {
    const b = computeCharts(solarInput(1990, 6, 15, 10, 30));
    const md = exportChartReview('样例', interpretNatal(b, RULES), b.calculationHash, '2026-10-01');
    expect(md).toContain(b.calculationHash);
    expect(md).toContain('审核意见');
  });
  it('CSV 往返：填写“新状态”后生成补丁，应用后追加历史而不覆盖', () => {
    const rules = JSON.parse(JSON.stringify(selectRules(RULES, 'bazi', 'all'))) as Rule[];
    const csv = exportRules(RULES, rules.slice(0, 3), 'csv', 'x').split('\n');
    const rows = parseCsv(csv.join('\n'));
    rows[1][rows[1].length - 1] = 'reviewed';
    rows[1][rows[1].length - 2] = '同意，措辞需更谨慎，含逗号,和"引号"';
    const back = rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c)).join(',')).join('\n');
    const patches = patchesFromCsv(back, '张老师', '2026-10-02');
    expect(patches).toHaveLength(1);
    expect(patches[0].note).toContain('含逗号,和"引号"');
    const res = applyPatches(rules, patches);
    expect(res).toEqual({ updated: 1, errors: [] });
    const r = rules.find((x) => x.id === patches[0].id)!;
    expect(r.review).toMatchObject({ status: 'reviewed', reviewer: '张老师', date: '2026-10-02' });
    expect(r.review.history).toHaveLength(1);
    expect(r.review.history[0].status).toBe('draft');
  });
  it('补丁校验：无审核人、非法状态、未知 ID 均被拒绝', () => {
    const rules = JSON.parse(JSON.stringify(RULES.bazi)) as Rule[];
    const r = applyPatches(rules, [
      { id: rules[0].id, status: 'approved', reviewer: '', date: 'd', note: '' },
      { id: rules[0].id, status: 'ok' as never, reviewer: 'x', date: 'd', note: '' },
      { id: 'nope', status: 'draft', reviewer: 'x', date: 'd', note: '' },
    ]);
    expect(r.updated).toBe(0);
    expect(r.errors).toHaveLength(3);
  });
});
