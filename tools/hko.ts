// 香港天文台数据：
//   npm run hko:fetch     下载各年公历农历对照表（文字版）到 docs/sources/raw/hko/（URL 模板见清单；未经验证，失败会提示）
//   npm run hko:import    解析 raw 文件，生成 test/fixtures/hko/lunar.json；之后 `npm test` 会自动与本项目历法逐日核对
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseHkoLunarText, resolveHkoDays, type HkoRow } from './hko-parse';
import { httpGet } from './http';
import { libSolarToLunar } from '../src/calendar/lunar';

const MANIFEST = 'docs/sources/manifest.json';
const RAW = 'docs/sources/raw/hko';
const cfg = JSON.parse(readFileSync(MANIFEST, 'utf8')).hko as { lunarTextUrl: string; yearFrom: number; yearTo: number };

async function fetchAll() {
  mkdirSync(RAW, { recursive: true });
  let ok = 0;
  const years = Array.from({ length: cfg.yearTo - cfg.yearFrom + 1 }, (_, i) => cfg.yearFrom + i).filter((y) => !existsSync(join(RAW, `${y}.txt`)));
  const worker = async () => {
    for (let y = years.shift(); y !== undefined; y = years.shift()) {
      const url = cfg.lunarTextUrl.replace('{year}', String(y));
      try { writeFileSync(join(RAW, `${y}.txt`), await httpGet(url), 'utf8'); ok++; } catch (e) { console.warn(`${y}: ${(e as Error).message}`); }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  console.log(`本次下载 ${ok} 个年份（已存在的跳过）。`);
}

function importAll() {
  const rows: HkoRow[] = [];
  let skipped = 0, years = 0;
  for (let y = cfg.yearFrom; y <= cfg.yearTo; y++) {
    const p = join(RAW, `${y}.txt`);
    if (!existsSync(p)) continue;
    years++;
    const r = parseHkoLunarText(readFileSync(p, 'utf8'));
    skipped += r.skipped;
    rows.push(...r.rows);
  }
  const days = resolveHkoDays(rows);
  const data: Record<string, [number, boolean, number]> = {};
  const terms: Record<string, string> = {};
  for (const d of days) { data[d.key] = [d.lunarMonth, d.leap, d.lunarDay]; if (d.term) terms[d.key] = d.term; }
  mkdirSync('test/fixtures/hko', { recursive: true });
  writeFileSync('test/fixtures/hko/lunar.json', JSON.stringify({ source: '香港天文台 公历与农历日期对照表（文字版）', retrievedAt: new Date().toISOString().slice(0, 10), years, days: days.length, skippedLines: skipped, data, terms }) + '\n', 'utf8');
  // 官方与历法库不一致的日子 → 校正表（以官方为准；农历年份沿用历法库）
  const entries: [[number, number, number], [number, number, boolean, number]][] = [];
  const hkoLunar = new Set<string>();
  const libLunarOfMismatch: string[] = [];
  for (const d of days) {
    const [y, m, dd] = d.key.split('-').map(Number);
    const l = libSolarToLunar(y, m, dd);
    if (l.month !== d.lunarMonth || l.leap !== d.leap || l.day !== d.lunarDay) {
      entries.push([[y, m, dd], [l.year, d.lunarMonth, d.leap, d.lunarDay]]);
      hkoLunar.add([l.year, d.lunarMonth, d.leap, d.lunarDay].join('-'));
      libLunarOfMismatch.push([l.year, l.month, l.leap, l.day].join('-'));
    }
  }
  const invalidLunar = [...new Set(libLunarOfMismatch)].filter((k) => !hkoLunar.has(k)).map((k) => { const [a, b, c, d] = k.split('-'); return [Number(a), Number(b), c === 'true', Number(d)]; });
  writeFileSync('src/calendar/hko-corrections.json', JSON.stringify({ source: '香港天文台公历与农历日期对照表', retrievedAt: new Date().toISOString().slice(0, 10), entries, invalidLunar }, null, 1) + '\n', 'utf8');
  console.log(`校正表：${entries.length} 天与历法库不一致（以官方为准），失效农历日 ${invalidLunar.length} 个。`);
  console.log(`解析 ${years} 年，${days.length} 天（含 ${Object.keys(terms).length} 个节气日），跳过 ${skipped} 行。`);
}

const cmd = process.argv[2];
if (cmd === 'fetch') await fetchAll(); else if (cmd === 'import') importAll(); else console.log('用法：fetch | import');
