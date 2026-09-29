// 生成“可勾选”的黄金盘核对表 docs/golden/INTERACTIVE_REVIEW.md，并可把勾选结果导回签字。
//   npm run golden:sheet                          生成核对表（20 个代表盘）
//   npm run golden:sheet -- import <文件> [--date 2026-10-01]   读取你勾选并填写“核对人”的表，把两项都勾选的盘签字
// 表中“独立来源期望值”来自 iztro / tyme4ts / sxtwl，不来自本引擎；本工具不会替你勾选或签字。
import { readFileSync, writeFileSync } from 'node:fs';
import { computeCharts, BRANCHES, STEMS } from '../src/index';
import type { BirthInput } from '../src/core/types';

const GOLD = 'test/fixtures/golden.json';
const OUT = 'docs/golden/INTERACTIVE_REVIEW.md';
type GCase = { id: string; category: string; input: BirthInput; expected: { ziwei: { bureau: string; mingBranch: string; bodyBranch: string; majorStars: Record<string, string>; transforms: Record<string, string> }; bazi: { pillars: string; luckStart: number[] } }; oracle: { humanVerifiedBy: unknown } };
const gold = JSON.parse(readFileSync(GOLD, 'utf8')) as { cases: GCase[] };
const sx = JSON.parse(readFileSync('test/fixtures/sxtwl-pillars.json', 'utf8')).cases as Record<string, { pillars: string }>;
const IDS = ['G01', 'G02', 'G03', 'G04', 'G05', 'G06', 'G07', 'G08', 'G09', 'G19', 'G20', 'G21', 'G27', 'G28', 'G29', 'G31', 'G32', 'G33', 'G42', 'G43'];

function generate() {
  const L: string[] = [
    '# 黄金盘核对表（可勾选版，20 个代表盘）', '',
    '> 核对人：`__________`　　日期：`__________`　　（必须填写，导入时才会签字）', '',
    '## 怎么用（不需要老师，约 1–2 小时）', '',
    '1. 每个盘下面有一张表：左列是**本软件**的结果，右列是**独立来源**（iztro / tyme4ts / 寿星天文历 sxtwl）给出的标准答案，两列已由测试证明一致。你要做的是第三件事：**再用一个你信得过的外部工具核对一遍**。',
    '2. 外部工具建议：八字/农历——香港天文台“公历与农历日期对照表”或任一权威万年历；紫微——任选一个主流排盘网站或 App，输入表中的出生信息，选择“三合派、闰月前后半月法、命宫起限”（辛年魁钺与壬年四化的流派差异见下方提示）。',
    '3. 与表中结果一致，就在对应方框里把 `[ ]` 改成 `[x]`；不一致，不要勾选，写在备注里（不一定是软件错误，可能是流派差异）。',
    '4. 全部做完后运行 `npm run golden:sheet -- import docs/golden/INTERACTIVE_REVIEW.md`，两项都勾选的盘会被记为“本人核对”。', '',
    '**已知的合理差异**：辛年天魁天钺（本软件默认《全书》“虎马”，很多网站取“马虎”）；壬年四化（本软件默认“天梁/紫微/天府/武曲”，很多网站取“辅”）；紫微部分我们没有找到能机械核对的第三方，所以这一项主要靠你的外部工具。',
    '**说明**：你不是专业命理审核人，本表记录的角色是“本人（非专业）”，不等于老师审核；规则文本的审核状态不受影响。', '', '---', '',
  ];
  for (const id of IDS) {
    const c = gold.cases.find((x) => x.id === id)!;
    const i = c.input;
    const b = computeCharts(i);
    const pill = (['year', 'month', 'day', 'hour'] as const).map((k) => STEMS[b.bazi.pillars[k].stem] + BRANCHES[b.bazi.pillars[k].branch]).join(' ');
    const e = c.expected;
    const z = b.ziwei;
    const stars = (m: Record<string, string>) => BRANCHES.map((br) => `${br}:${(m[br] ?? '').match(/../g)?.sort().join('') || '—'}`).join('　');
    const mine = Object.fromEntries(z.palaces.map((p) => [BRANCHES[p.branch], p.stars.filter((s) => s.kind === 'major').map((s) => s.name).join('')]));
    const trans = Object.entries(e.ziwei.transforms).map(([s, t]) => `${s}化${t}`).join('、');
    const luck = b.bazi.luck.start;
    const cl = b.resolved.clockLunar;
    L.push(`## ${id}｜${c.category}`, '',
      `**出生**：公历 ${i.year}-${i.month}-${i.day} ${String(i.hour).padStart(2, '0')}:${String(i.minute).padStart(2, '0')}，${i.gender === 'M' ? '男' : '女'}，UTC${i.place.utcOffsetMinutes >= 0 ? '+' : ''}${i.place.utcOffsetMinutes / 60}${i.place.dstMinutes ? '（含夏令时，钟表时间）' : ''}　农历：${cl.year}年${cl.leap ? '闰' : ''}${cl.month}月${cl.day}日`, '',
      '| 项目 | 本软件 | 独立来源期望值 |', '|---|---|---|',
      `| 八字四柱 | ${pill} | ${e.bazi.pillars}（tyme4ts）／${sx[id].pillars}（sxtwl） |`,
      `| 起运 | ${luck.years}岁${luck.months}个月${luck.days}天 | ${e.bazi.luckStart[0]}岁${e.bazi.luckStart[1]}个月${e.bazi.luckStart[2]}天 |`,
      `| 命宫／身宫 | ${BRANCHES[z.mingBranch]}／${BRANCHES[z.bodyBranch]} | ${e.ziwei.mingBranch}／${e.ziwei.bodyBranch}（iztro） |`,
      `| 五行局 | ${z.fiveElementBureau.name} | ${e.ziwei.bureau} |`,
      `| 十二宫主星 | ${stars(mine)} | ${stars(e.ziwei.majorStars)} |`,
      `| 年干四化 | ${Object.entries({ [z.fourTransforms.lu]: '禄', [z.fourTransforms.quan]: '权', [z.fourTransforms.ke]: '科', [z.fourTransforms.ji]: '忌' }).map(([s, t]) => `${s}化${t}`).join('、')} | ${trans} |`, '',
      `- [ ] 八字：四柱与起运，我用外部工具查过，与上表一致（${id}-bazi）`,
      `- [ ] 紫微：命宫、身宫、五行局、主星与四化，我用外部工具查过，与上表一致（${id}-ziwei）`,
      '- 我用的工具：`__________`',
      '- 备注：', '', '---', '');
  }
  writeFileSync(OUT, L.join('\n'), 'utf8');
  console.log(`已生成 ${OUT}（${IDS.length} 盘）`);
}

function importSheet(file: string) {
  const md = readFileSync(file, 'utf8');
  const name = md.match(/核对人：`([^`]*)`/)?.[1]?.replace(/_/g, '').trim();
  const dateIn = md.match(/日期：`([^`]*)`/)?.[1]?.replace(/_/g, '').trim();
  if (!name) throw new Error('请先在表头填写“核对人”');
  const args = process.argv.slice(2);
  const date = args.includes('--date') ? args[args.indexOf('--date') + 1] : dateIn || new Date().toISOString().slice(0, 10);
  const signed: string[] = [];
  for (const id of IDS) {
    const bz = new RegExp(`- \\[x\\] 八字：[^\\n]*（${id}-bazi）`, 'i').test(md);
    const zw = new RegExp(`- \\[x\\] 紫微：[^\\n]*（${id}-ziwei）`, 'i').test(md);
    if (!(bz && zw)) continue;
    gold.cases.find((c) => c.id === id)!.oracle.humanVerifiedBy = { name, date, role: '本人（非专业）', sheet: 'INTERACTIVE_REVIEW.md' };
    signed.push(id);
  }
  writeFileSync(GOLD, JSON.stringify(gold, null, 1) + '\n', 'utf8');
  console.log(`已记录 ${signed.length}/${IDS.length} 个盘的本人核对：${signed.join(' ') || '（无）'}`);
}

const a = process.argv.slice(2);
if (a[0] === 'import') importSheet(a[1]); else generate();
