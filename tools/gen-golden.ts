// 生成黄金测试固件与人工核对表。期望值来自独立实现（iztro、tyme4ts），而不是本项目引擎的输出；
// 生成时若与引擎不一致，记为 divergence，须在 ADR 中裁决后才可通过测试。
// 用法：npx tsx tools/gen-golden.ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { astro } from 'iztro';
import { ChildLimit, Gender, SolarTime } from 'tyme4ts';
import { computeCharts, BRANCHES, STEMS, canonicalJson } from '../src/index';
import { addDays, civilFromDays, civilFromEpoch, daysFromCivil } from '../src/calendar/civil';
import { jieInstantsAround, solarToLunar } from '../src/calendar/lunar';
import type { BirthInput, Place } from '../src/core/types';

interface Case { id: string; category: string; input: BirthInput; libClock: { y: number; m: number; d: number; hh: number; mm: number } }
const CN: Place = { utcOffsetMinutes: 480, dstMinutes: 0 };
const cases: Case[] = [];
const add = (category: string, y: number, m: number, d: number, hh: number, mm: number, g: 'M' | 'F', place: Place = CN) => {
  const std = civilFromEpoch(Date.UTC(y, m - 1, d, hh, mm) / 1000 - place.dstMinutes * 60, 0);
  cases.push({ id: `G${String(cases.length + 1).padStart(2, '0')}`, category,
    input: { calendar: 'solar', year: y, month: m, day: d, hour: hh, minute: mm, gender: g, place },
    libClock: { y: std.y, m: std.m, d: std.d, hh: std.hh, mm: std.mm } });
};

// 1 闰月（十五日前后各一）
const leapDays: { y: number; m: number; d: number; ld: number }[] = [];
for (let d = daysFromCivil(1902, 1, 1); d <= daysFromCivil(2098, 12, 31) && leapDays.length < 400; d++) {
  const c = civilFromDays(d);
  const l = solarToLunar(c.y, c.m, c.d);
  if (l.leap && (l.day === 8 || l.day === 22)) leapDays.push({ ...c, ld: l.day });
}
for (const pick of [0, 3, 10, 13, 22, 29]) { const x = leapDays[Math.min(pick, leapDays.length - 1)]; add(`闰月（闰月${x.ld}日）`, x.y, x.m, x.d, 10 + (pick % 5), 15, pick % 2 ? 'F' : 'M'); }
// 2 子时边界（早子时 / 晚子时；避开农历月末跨月的晚子时，见 ADR-004）
const ziDays = [[1985, 3, 9], [2001, 8, 20], [1972, 11, 5], [2015, 5, 17]];
let zi = 0;
for (const [y, m, d] of ziDays) for (const [hh, mm] of [[23, 0], [23, 59], [0, 0], [0, 59]]) {
  const nx = addDays({ y, m, d }, 1), l0 = solarToLunar(y, m, d), l1 = solarToLunar(nx.y, nx.m, nx.d);
  if (hh === 23 && (l0.month !== l1.month || l0.leap || l1.leap)) continue;
  add('子时边界', y, m, d, hh, mm, zi++ % 2 ? 'F' : 'M');
}
// 3 立春前后 ±1 分钟；4 春节与立春的先后
for (const y of [1984, 2000, 2024, 2050]) {
  const t = jieInstantsAround(y).find((j) => j.name === '立春' && civilFromEpoch(j.epochSec, 480).y === y)!;
  for (const dm of [-2, 2]) { const c = civilFromEpoch(t.epochSec + dm * 60, 480); add('立春前后', c.y, c.m, c.d, c.hh, c.mm, dm < 0 ? 'M' : 'F'); }
}
for (const [y, m, d] of [[2024, 2, 6], [2019, 2, 5], [2023, 1, 25], [2010, 2, 13]]) add('立春与春节之间/之前', y, m, d, 12, 0, 'M');
// 5 十二节令交接前后
for (const [y, name] of [[1965, '惊蛰'], [1978, '清明'], [1993, '立夏'], [2002, '芒种'], [2011, '小暑'], [2020, '立秋'], [1955, '白露'], [1998, '寒露'], [2033, '立冬'], [2066, '大雪'], [2087, '小寒']] as const) {
  const t = jieInstantsAround(y).find((j) => j.name === name && civilFromEpoch(j.epochSec, 480).y === y)!;
  const c = civilFromEpoch(t.epochSec + (y % 2 ? 90 : -90), 480);
  add('节令交接前后', c.y, c.m, c.d, c.hh, c.mm, y % 2 ? 'M' : 'F');
}
// 6 范围两端与农历月末
for (const [y, m, d] of [[1901, 1, 1], [1901, 2, 19], [2100, 12, 31], [2100, 1, 1]]) add('范围两端', y, m, d, 9, 30, 'M');
let eom = 0;
for (let d = daysFromCivil(1930, 1, 1); d < daysFromCivil(2090, 1, 1) && eom < 4; d += 977) {
  for (let k = 0; k < 60; k++) { const c = civilFromDays(d + k); const l = solarToLunar(c.y, c.m, c.d); if (l.day === 30) { add('农历三十', c.y, c.m, c.d, 14, 20, eom % 2 ? 'F' : 'M'); eom++; break; } }
}
// 7 夏令时（库输入扣除夏令时后的标准时间）
for (const [y, m, d, hh] of [[1986, 7, 1, 13], [1988, 6, 15, 8], [1990, 8, 2, 20], [1991, 5, 20, 0]]) add('夏令时', y, m, d, hh, 30, 'M', { utcOffsetMinutes: 540, dstMinutes: 60 });
// 8 随机补足，覆盖五行局与阴阳男女
let s = 424242;
const rnd = (a: number, b: number) => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return a + Math.floor((s / 4294967296) * (b - a + 1)); };
while (cases.length < 60) add('覆盖矩阵', rnd(1902, 2099), rnd(1, 12), rnd(1, 28), rnd(1, 22), rnd(0, 59), cases.length % 2 ? 'F' : 'M');

const iztroVersion = JSON.parse(readFileSync('node_modules/iztro/package.json', 'utf8')).version;
const tymeVersion = JSON.parse(readFileSync('node_modules/tyme4ts/package.json', 'utf8')).version;
const out: unknown[] = [];
const divergences: string[] = [];
for (const c of cases) {
  const b = computeCharts(c.input);
  const L = c.libClock;
  // iztro：按标准钟表时间（已扣除夏令时）取时辰索引；晚子时用索引 12
  const ti = L.hh === 23 ? 12 : Math.floor(((L.hh + 1) % 24) / 2);
  const a = astro.bySolar(`${L.y}-${L.m}-${L.d}`, ti, c.input.gender === 'M' ? '男' : '女', true, 'zh-CN');
  const zwMajor: Record<string, string> = {};
  const zwTrans: Record<string, string> = {};
  for (const p of a.palaces) {
    zwMajor[p.earthlyBranch] = p.majorStars.map((x) => x.name).join('');
    for (const st of [...p.majorStars, ...p.minorStars]) if (st.mutagen) zwTrans[st.name] = st.mutagen;
  }
  const soul = a.palaces.find((p) => p.name === '命宫')!;
  const body = a.palaces.find((p) => p.isBodyPalace)!;
  const st = SolarTime.fromYmdHms(L.y, L.m, L.d, L.hh, L.mm, 0);
  const cl = ChildLimit.fromSolarTime(st, c.input.gender === 'M' ? Gender.MAN : Gender.WOMAN);
  const expected = {
    ziwei: { bureau: a.fiveElementsClass, mingBranch: soul.earthlyBranch, bodyBranch: body.earthlyBranch, majorStars: zwMajor, transforms: zwTrans },
    bazi: { pillars: String(st.getLunarHour().getEightChar()), luckStart: [cl.getYearCount(), cl.getMonthCount(), cl.getDayCount()] },
  };
  const mine = {
    ziwei: {
      bureau: b.ziwei.fiveElementBureau.name, mingBranch: BRANCHES[b.ziwei.mingBranch], bodyBranch: BRANCHES[b.ziwei.bodyBranch],
      majorStars: Object.fromEntries(b.ziwei.palaces.map((p) => [BRANCHES[p.branch], p.stars.filter((x) => x.kind === 'major').map((x) => x.name).join('')])),
    },
    bazi: { pillars: (['year', 'month', 'day', 'hour'] as const).map((k) => STEMS[b.bazi.pillars[k].stem] + BRANCHES[b.bazi.pillars[k].branch]).join(' '), luckStart: [b.bazi.luck.start.years, b.bazi.luck.start.months, b.bazi.luck.start.days] },
  };
  // 库输出的主星串顺序与我们不同，比较时按星名排序
  const norm = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.match(/../g)?.sort().join('') ?? '']));
  const same = canonicalJson(norm(expected.ziwei.majorStars)) === canonicalJson(norm(mine.ziwei.majorStars)) && expected.ziwei.bureau === mine.ziwei.bureau &&
    expected.ziwei.mingBranch === mine.ziwei.mingBranch && expected.ziwei.bodyBranch === mine.ziwei.bodyBranch &&
    expected.bazi.pillars === mine.bazi.pillars && JSON.stringify(expected.bazi.luckStart) === JSON.stringify(mine.bazi.luckStart);
  if (!same) divergences.push(c.id);
  out.push({ id: c.id, category: c.category, input: c.input, expected,
    oracle: { ziwei: { type: 'independent-implementation', source: `iztro@${iztroVersion}` }, bazi: { type: 'independent-implementation', source: `tyme4ts@${tymeVersion}` }, note: c.input.place.dstMinutes ? '库输入为扣除夏令时后的标准时间' : '', humanVerifiedBy: null } });
}
mkdirSync('test/fixtures', { recursive: true });
writeFileSync('test/fixtures/golden.json', JSON.stringify({ generatedBy: 'tools/gen-golden.ts', note: '期望值来自独立实现，非本引擎输出；humanVerifiedBy 为 null 表示尚未人工签字（见 docs/golden/HUMAN_REVIEW_SHEET.md）', divergences, cases: out }, null, 1) + '\n', 'utf8');

// 人工核对表：每类取代表，共 20 盘，含逐步推演，供确认人对照《全书》安星诀与万年历手工核对签字
mkdirSync('docs/golden', { recursive: true });
const pick: Case[] = [];
const seenCat = new Map<string, number>();
for (const c of cases) { const n = seenCat.get(c.category) ?? 0; if (n < 3 && pick.length < 20) { pick.push(c); seenCat.set(c.category, n + 1); } }
const sheet = ['# 黄金盘人工核对表（紫微 20 + 八字 20 = 同 20 个出生输入）', '',
  '请确认人（本人或老师）依据《紫微斗数全书》安星诀与权威万年历，对下列每个命盘逐步核对，在“核对结果”处签字。期望值**不得**来自本软件的输出。', '',
  '每盘列出：出生输入、本软件的逐步推演（供你逐条对照）、核对勾选栏。', ''];
for (const c of pick) {
  const b = computeCharts(c.input);
  const i = c.input;
  sheet.push(`## ${c.id}｜${c.category}`, '',
    `- 输入：公历 ${i.year}-${i.month}-${i.day} ${String(i.hour).padStart(2, '0')}:${String(i.minute).padStart(2, '0')}，${i.gender === 'M' ? '男' : '女'}，UTC${i.place.utcOffsetMinutes >= 0 ? '+' : ''}${i.place.utcOffsetMinutes / 60}${i.place.dstMinutes ? '（含夏令时）' : ''}`,
    `- 农历：${b.resolved.clockLunar.year}年${b.resolved.clockLunar.leap ? '闰' : ''}${b.resolved.clockLunar.month}月${b.resolved.clockLunar.day}日；计算哈希 \`${b.calculationHash.slice(0, 16)}\``, '',
    '**紫微推演**', '', ...b.ziwei.steps.map((x) => `1. ${x.text}`), '',
    '**八字推演**', '', ...b.bazi.steps.map((x) => `1. ${x.text}`), '',
    '- [ ] 紫微：命宫、身宫、五行局、紫微天府位置、四化、大限方向与起限 已核对无误',
    '- [ ] 八字：四柱、大运方向与起运 已核对无误',
    '- 核对人签字 / 日期：', '- 备注：', '', '---', '');
}
writeFileSync('docs/golden/HUMAN_REVIEW_SHEET.md', sheet.join('\n'), 'utf8');
console.log(`生成 ${out.length} 个黄金用例；与独立实现不一致：${divergences.length ? divergences.join(',') : '无'}`);
