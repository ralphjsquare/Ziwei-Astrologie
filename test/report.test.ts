import { describe, expect, it } from 'vitest';
import { computeCharts } from '../src/index';
import { RULES, lintText } from '../src/rules';
import { buildReport, reportToMarkdown } from '../src/interpret/report';
import { rng, solarInput } from './helpers';

describe('白话解读报告', () => {
  const cases = [solarInput(1988, 4, 2, 7, 55, 'M'), solarInput(1993, 11, 21, 16, 15, 'F'), ...Array.from({ length: 80 }, (_, i) => { const r = rng(4000 + i); return solarInput(r.int(1950, 2019), r.int(1, 12), r.int(1, 28), r.int(0, 23), r.int(0, 59), r.int(0, 1) ? 'M' : 'F'); })];
  it('任意盘都能生成；段落符合语言准则；没有评分、指令类用语；带规则的段落规则存在', () => {
    for (const inp of cases) {
      const b = computeCharts(inp);
      const rep = buildReport(b, RULES, b.ziwei.input.lunarYear + 25);
      expect(rep.sections.map((s) => s.id)).toEqual(['how', 'overview', 'glance', 'character', 'career', 'love', 'mind', 'sihua', 'now', 'ext', 'limits']);
      for (const s of rep.sections) for (const p of s.paras) {
        expect(lintText(p.text), `${s.id}: ${p.text}`).toEqual([]);
        expect(p.text, `${s.id}: ${p.text}`).not.toMatch(/undefined|NaN|\{\w+\}/);
        expect(p.text).not.toMatch(/评分|总分|综合运势|运势指数/);
        if (p.ruleId) expect(RULES.byId.has(p.ruleId), p.ruleId).toBe(true);
      }
    }
  });
  it('用户盘：一眼看懂里的事实与外部软件一致；同输入两次生成逐字相同', () => {
    const b = computeCharts(cases[0]);
    const r1 = buildReport(b, RULES, 2026, '示例'), r2 = buildReport(b, RULES, 2026, '示例');
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    const glance = r1.sections.find((s) => s.id === 'glance')!.paras.map((p) => p.text).join('\n');
    for (const t of ['水二局', '命宫在亥宫，主星天相', '身宫在未宫（财帛）', '命主巨门，身主文昌', '戊辰 乙卯 丁亥 甲辰', '日主丁（阴火）']) expect(glance).toContain(t);
    const now = r1.sections.find((s) => s.id === 'now')!.paras.map((p) => p.text).join('\n');
    expect(now).toContain('2026 年');
    expect(now).toContain('廉贞化忌落在福德宫');
  });
  it('Markdown 导出包含标题、各节标题与来源标记', () => {
    const b = computeCharts(cases[1]);
    const md = reportToMarkdown(buildReport(b, RULES, 2026, '示例'), '2026-10-25');
    expect(md).toContain('# 示例的白话解读');
    expect(md).toContain('## 你是什么样的人');
    expect(md).toMatch(/〔传统说法〕/);
    expect(md).toMatch(/〔排盘事实〕/);
  });
});
