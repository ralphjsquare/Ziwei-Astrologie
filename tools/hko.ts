// 香港天文台数据：
//   npm run hko:fetch     下载各年公历农历对照表（文字版）到 docs/sources/raw/hko/（URL 模板见清单；未经验证，失败会提示）
//   npm run hko:import    解析 raw 文件，生成 test/fixtures/hko/lunar.json；之后 `npm test` 会自动与本项目历法逐日核对
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseHkoLunarText } from './hko-parse';

const MANIFEST = 'docs/sources/manifest.json';
const RAW = 'docs/sources/raw/hko';
const cfg = JSON.parse(readFileSync(MANIFEST, 'utf8')).hko as { lunarTextUrl: string; yearFrom: number; yearTo: number };

async function fetchAll() {
  mkdirSync(RAW, { recursive: true });
  let ok = 0;
  for (let y = cfg.yearFrom; y <= cfg.yearTo; y++) {
    const url = cfg.lunarTextUrl.replace('{year}', String(y));
    const res = await fetch(url);
    if (!res.ok) { console.warn(`${y}: HTTP ${res.status} ${url}`); continue; }
    writeFileSync(join(RAW, `${y}.txt`), await res.text(), 'utf8');
    ok++;
  }
  console.log(`下载 ${ok} 个年份。若为 0，请打开香港天文台“公历农历日期对照表”页面确认真实的文字版链接，改清单中的 lunarTextUrl。`);
}

function importAll() {
  const out: Record<string, [number, boolean, number]> = {}; // 日期 → [农历月, 是否闰月, 农历日]
  let skipped = 0, years = 0;
  for (let y = cfg.yearFrom; y <= cfg.yearTo; y++) {
    const p = join(RAW, `${y}.txt`);
    if (!existsSync(p)) continue;
    years++;
    const r = parseHkoLunarText(readFileSync(p, 'utf8'));
    skipped += r.skipped;
    for (const d of r.days) if (d.lunarMonth && d.lunarDay) out[`${d.y}-${d.m}-${d.d}`] = [d.lunarMonth, d.leap, d.lunarDay];
  }
  mkdirSync('test/fixtures/hko', { recursive: true });
  writeFileSync('test/fixtures/hko/lunar.json', JSON.stringify({ source: '香港天文台 公历农历日期对照表（文字版）', years, days: Object.keys(out).length, skippedLines: skipped, data: out }) + '\n', 'utf8');
  console.log(`解析 ${years} 年，${Object.keys(out).length} 天，跳过 ${skipped} 行。`);
}

const cmd = process.argv[2];
if (cmd === 'fetch') await fetchAll(); else if (cmd === 'import') importAll(); else console.log('用法：fetch | import');
