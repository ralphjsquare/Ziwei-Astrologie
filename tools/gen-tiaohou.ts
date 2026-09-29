// 从用户提供的《穷通宝鉴》电子文本（版本未核实）逐条摘出“日主 × 月份”条目的开头一至三句原文，
// 写入 docs/sources/qtbj-excerpts.json（并入语料时用作引文）。不从原文里自动提取“用神”：试过机械提取，与参照实现只有约一半一致，
// 说明首句里的天干并不总是取用之神，因此只展示原文，由读者/审核人判断。shared=true 表示原书按季节或相邻月份合写。
// 用法：npx tsx tools/gen-tiaohou.ts <穷通宝鉴.txt 路径>
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) throw new Error('用法：gen-tiaohou <txt 路径>');
const text = new TextDecoder('gbk').decode(readFileSync(file)).replace(/\r/g, '');
const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
const STEMS = '甲乙丙丁戊己庚辛壬癸';
const EL: Record<string, string> = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const NUM = ['', '正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
const ALIAS: Record<number, string[]> = { 11: ['十一', '冬'], 12: ['十二', '腊'] };
const monthNames = (m: number) => [NUM[m], ...(ALIAS[m] ?? [])].filter((x, i, a) => a.indexOf(x) === i);
const BR = ['', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑']; // 月序 1..12 = 寅..丑，即正月..腊月

const out: Record<string, { lead: string; stems: string[]; shared?: boolean }> = {};
const problems: string[] = [];
const TOKEN = /^((?:十二|十一|十|[正二三四五六七八九]|冬|腊)+)月([甲乙丙丁戊己庚辛壬癸])[木火土金水]/;
const monthsOf = (tok: string): number[] => {
  const r: number[] = [];
  for (const m of tok.matchAll(/十二|十一|十|[正二三四五六七八九]|冬|腊/g)) {
    const v = m[0];
    r.push(v === '冬' ? 11 : v === '腊' ? 12 : NUM.indexOf(v));
  }
  return r;
};
// 取首句；若首句没出现天干（如“三月甲木，木气相竭。先取庚金，次用壬水。”），继续取后面的句子，最多三句
const sentence = (t: string) => {
  const parts = t.match(/[^。]*。|[^。]+$/g) ?? [t];
  let acc = '';
  for (const part of parts.slice(0, 3)) {
    acc += part;
    if ([...part.replace(/^[^，。：]*?[月季春夏秋冬][甲乙丙丁戊己庚辛壬癸][木火土金水]/, '')].some((c) => STEMS.includes(c))) break;
  }
  return acc;
};
const SEASON: Record<string, number[]> = { 春: [1, 2, 3], 夏: [4, 5, 6], 秋: [7, 8, 9], 冬: [10, 11, 12] };
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(TOKEN);
  if (!m) continue;
  const stem = m[2];
  const months = monthsOf(m[1]);
  let body = lines[i];
  if (/[：:]$/.test(body)) body = lines[i + 1] ?? ''; // “正月丙火：”后一行才是正文
  for (const mo of months) {
    const key = `${stem}${BR[mo]}`;
    const single = months.length === 1;
    let lead = sentence(body), shared = false;
    if (!single) {
      const own = monthNames(mo).map((n) => body.match(new RegExp(`${n}月[^。]*。`))).find(Boolean);
      if (own) lead = own[0]; else shared = true;
    }
    if (out[key] && (!out[key].shared || shared)) continue; // 已有更精确（单月或专属句）的记录
    const after = lead.replace(/^[^，。：]*?[月季春夏秋冬][甲乙丙丁戊己庚辛壬癸][木火土金水]/, '');
    const stems: string[] = [];
    for (const ch of after) if (STEMS.includes(ch) && !stems.includes(ch)) stems.push(ch);
    out[key] = { lead, stems, shared };
  }
}
// 第二遍：原书对部分日主只写“三夏己土”这样的季节条目，用它补空缺（记为共用）
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^三([春夏秋冬])([甲乙丙丁戊己庚辛壬癸])[木火土金水]/);
  if (!m || !/[，：]/.test(lines[i])) continue;
  let body = lines[i];
  if (/[：:]$/.test(body)) body = lines[i + 1] ?? '';
  for (const mo of SEASON[m[1]]) {
    const key = `${m[2]}${BR[mo]}`;
    if (out[key]) continue;
    const lead = sentence(body);
    const after = lead.replace(/^[^，。：]*?[月季春夏秋冬][甲乙丙丁戊己庚辛壬癸][木火土金水]/, '');
    out[key] = { lead, stems: [...new Set([...after].filter((c) => STEMS.includes(c)))], shared: true };
  }
}
for (const s of STEMS) for (let mo = 1; mo <= 12; mo++) {
  const e = out[`${s}${BR[mo]}`];
  if (!e) problems.push(`${s}${BR[mo]}月：没找到条目`);
  else if (!e.stems.length) problems.push(`${s}${BR[mo]}月：首句未出现天干（${e.lead.slice(0, 40)}）`);
  else if (e.shared) problems.push(`${s}${BR[mo]}月：与相邻月份共用一句（${e.lead.slice(0, 30)}）`);
}
writeFileSync('docs/sources/qtbj-excerpts.json', JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { lead: v.lead, ...(v.shared ? { shared: true } : {}) }])), null, 1) + '\n');
console.log(`提取 ${Object.keys(out).length}/120 条`);
for (const p of problems) console.log('  ', p);
