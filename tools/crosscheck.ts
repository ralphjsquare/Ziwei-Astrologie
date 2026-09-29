// 第二来源核对：把 grounding.json 里《三命通会》的引文，与 Kanripo 的文渊阁四库全书本（KR3g0042，版本 WYG）逐条比对。
// 与 Wikisource 版本互相独立；比对前两边都转简体、去标点与标记。只做核对，结果写入 docs/sources/crosscheck.json。
// 用法：npx tsx tools/crosscheck.ts [--fetch]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as OpenCC from 'opencc-js';
import { httpGet, sleep } from './http';

const DIR = 'docs/sources/raw/kanripo-smtht';
const BASE = 'https://raw.githubusercontent.com/kanripo/KR3g0042/master/';
const t2s = OpenCC.Converter({ from: 'tw', to: 'cn' });

// 异体字折叠（四库本多用异体；己巳已在写本里常混，折叠后只做"字形无关"的比对，并在结果里注明）
const FOLD: Record<string, string> = { 隂: '阴', 夀: '寿', 䕃: '荫', 㤀: '忘', 刼: '劫', 逄: '逢', 髙: '高', 寛: '宽', 恵: '惠', 惟: '唯', 徳: '德', 巳: '己', 已: '己', 戍: '戌', 冝: '宜', 麤: '粗', 槩: '概', 竒: '奇', 㓙: '凶', 㡬: '几', 㸔: '看', 乗: '乘', 㑹: '会', 葢: '盖', 毋: '母' };
const fold = (s: string) => s.replace(/./gu, (c) => FOLD[c] ?? c);
function norm(s: string): string {
  const plain = s.replace(/<pb:[^>]*>/g, '').replace(/｛[^｝]*｝/g, '').replace(/[¶\s]/g, '').replace(/[^㐀-鿿]/g, '');
  return fold(t2s(plain).replace(/煞/g, "杀"));
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  if (process.argv.includes('--fetch')) {
    for (let i = 1; i <= 12; i++) {
      const f = `KR3g0042_${String(i).padStart(3, '0')}.txt`;
      if (existsSync(`${DIR}/${f}`)) continue;
      writeFileSync(`${DIR}/${f}`, await httpGet(BASE + f));
      await sleep(500);
    }
  }
  const vols: string[] = [];
  for (let i = 1; i <= 12; i++) vols.push(norm(readFileSync(`${DIR}/KR3g0042_${String(i).padStart(3, '0')}.txt`, 'utf8')));
  const all = vols.join('|');
  const grounding = JSON.parse(readFileSync('docs/sources/grounding.json', 'utf8')) as { ruleId: string; book: string; quotes: string[] }[];
  const rows: { ruleId: string; quote: string; found: boolean; volume?: number }[] = [];
  for (const g of grounding.filter((x) => x.book === 'smtht')) {
    for (const q of g.quotes) {
      const nq = norm(q);
      const idx = vols.findIndex((v) => v.includes(nq));
      rows.push({ ruleId: g.ruleId, quote: q, found: idx >= 0 && all.includes(nq), volume: idx >= 0 ? idx + 1 : undefined });
    }
  }
  const ok = rows.filter((r) => r.found).length;
  writeFileSync('docs/sources/crosscheck.json', JSON.stringify({ book: '三命通会', secondSource: 'Kanripo KR3g0042（文渊阁四库全书本 WYG）', total: rows.length, found: ok, rows }, null, 1) + '\n');
  console.log(`三命通会引文 ${rows.length} 条，第二来源命中 ${ok} 条`);
  for (const r of rows.filter((x) => !x.found)) console.log(`  未命中 ${r.ruleId}: ${r.quote}`);
}
main();
