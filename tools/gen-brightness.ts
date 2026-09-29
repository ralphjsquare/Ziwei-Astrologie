// 从《紫微斗数全书》卷二“诸星庙旺利陷表”（维基文库转录本，docs/sources/raw/zwqs）解析出星曜亮度表，
// 生成 src/ziwei/brightness.generated.ts。表中星名为单字简称，每个字一颗星；引擎不能读文件，所以生成为常量。
// 用法：npx tsx tools/gen-brightness.ts
import { readFileSync, writeFileSync } from 'node:fs';

const raw = readFileSync('docs/sources/raw/zwqs/003-紫微斗數全書_卷二.wikitext', 'utf8').split('\n');
const start = raw.findIndex((l) => l.includes('|庙') && l.includes('|落陷'));
if (start < 0) throw new Error('找不到庙旺利陷表');
const GRADES = ['庙', '旺', '得地', '利益', '平和', '不得地', '落陷'];
const FULL: Record<string, string> = { 紫: '紫微', 机: '天机', 日: '太阳', 武: '武曲', 同: '天同', 廉: '廉贞', 府: '天府', 月: '太阴', 贪: '贪狼', 巨: '巨门', 相: '天相', 梁: '天梁', 杀: '七杀', 破: '破军', 昌: '文昌', 曲: '文曲', 禄: '禄存', 羊: '擎羊', 陀: '陀罗', 火: '火星', 铃: '铃星' };
const BR = '子丑寅卯辰巳午未申酉戌亥';
const table: Record<string, Record<string, string>> = {};
let i = start + 2;
while (i + 2 < raw.length && !raw[i].includes('</nowiki>')) {
  if (raw[i].trim().startsWith('---')) { i++; continue; }
  const rows = [raw[i], raw[i + 1], raw[i + 2]].map((l) => l.split('|'));
  const br = rows[1][1].trim();
  if (!BR.includes(br)) throw new Error(`地支解析失败：${raw[i + 1]}`);
  for (let c = 0; c < 7; c++) {
    const cell = rows.map((r) => (r[c + 2] ?? '').trim()).join('');
    for (const ch of cell) {
      const star = FULL[ch];
      if (!star) throw new Error(`未知简称 ${ch}（${br} ${GRADES[c]}）`);
      (table[star] ??= {})[br] = GRADES[c];
    }
  }
  i += 3;
}
const MAJOR = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];
const missing = Object.entries(table).filter(([k, v]) => MAJOR.includes(k) && Object.keys(v).length !== 12).map(([k, v]) => `${k}:${Object.keys(v).length}`);
if (missing.length) throw new Error(`主星未覆盖十二宫：${missing.join(' ')}`);
writeFileSync('src/ziwei/brightness.generated.ts', `// 由 tools/gen-brightness.ts 从《紫微斗数全书》卷二“诸星庙旺利陷表”生成，请勿手改。\nexport type Brightness = '庙' | '旺' | '得地' | '利益' | '平和' | '不得地' | '落陷';\nexport const BRIGHTNESS: Record<string, Record<string, Brightness>> = ${JSON.stringify(table, null, 1)};\n`);
console.log(`已生成 ${Object.keys(table).length} 颗星的亮度表`);
