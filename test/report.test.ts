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
      expect(rep.sections.map((s) => s.id)).toEqual(['how', 'overview', 'keys', 'glance', 'character', 'bazideep', 'career', 'love', 'mind', 'sihua', 'life', 'now', 'ask', 'ext', 'limits']);
      for (const s of rep.sections) for (const p of s.paras) {
        expect(lintText(p.text), `${s.id}: ${p.text}`).toEqual([]);
        expect(p.text, `${s.id}: ${p.text}`).not.toMatch(/undefined|NaN|\{\w+\}/);
        expect(p.text).not.toMatch(/评分|总分|综合运势|运势指数/);
        expect(p.text, p.text).not.toContain('宫宫');
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
  it('用户盘的深入内容：三方四正、同宫组合、化忌对宫、配偶宫、十年一页、大限四化', () => {
    const b = computeCharts(cases[0]);
    const all = (id: string) => buildReport(b, RULES, 2026).sections.find((x) => x.id === id)!.paras.map((p) => p.text).join('\n');
    expect(all('character')).toContain('三方四正');
    expect(all('character')).toContain('命宫（亥，天相）');
    expect(all('career')).toContain('紫微、贪狼同宫的组合');
    expect(all('sihua')).toContain('化忌的对宫：天机化忌在子女宫，它的对宫是田宅宫');
    expect(all('sihua')).toContain('子女宫里同时有天机化忌、太阴化权');
    expect(all('love')).toContain('日支亥是配偶宫，本气是正官');
    expect(all('bazideep')).toContain('没有金');
    expect(all('life').split('\n').filter((l) => /^\d+–\d+ 岁/.test(l)).length).toBe(9);
    expect(all('now')).toContain('这十年的大限天干是甲，大限四化');
  });
  it('“怎么用”紧跟在解读后面：用户盘各处都有，且不下指令、不涉及具体投资医疗婚姻决定', () => {
    const b = computeCharts(cases[0]);
    const rep = buildReport(b, RULES, 2026);
    const get = (id: string) => rep.sections.find((x) => x.id === id)!.paras;
    // 每个有解读的小节里都有“怎么用”，并且紧跟在对应解读之后
    for (const id of ['character', 'bazideep', 'career', 'love', 'mind', 'sihua', 'now']) expect(get(id).some((p) => p.tag === 'apply'), id).toBe(true);
    const ch = get('character');
    expect(ch[0].text).toContain('紫微命宫在亥宫');
    expect(ch[1].tag).toBe('apply');
    expect(ch[1].text).toContain('天相的长处可以这样用');
    const career = get('career');
    expect(career[0].text).toContain('事业上');
    expect(career[1].tag).toBe('apply');
    expect(get('love').some((p) => p.tag === 'apply' && p.text.includes('言而有信'))).toBe(true);
    expect(get('sihua').some((p) => p.tag === 'apply' && p.text.includes('疾厄') === false)).toBe(true);
    expect(get('life').some((p) => p.text.includes('较适合'))).toBe(true);
    const all = rep.sections.flatMap((s) => s.paras).filter((p) => p.tag === 'apply').map((p) => p.text).join('\n');
    expect(all).not.toMatch(/应该|必须|一定要|务必|买入|卖出|结婚|离婚|服药|手术|辞职/);
    expect(all).toContain('身体有不适时请咨询专业医生');
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
