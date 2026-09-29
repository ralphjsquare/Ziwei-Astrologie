// 引擎纯度检查：引擎与解读层禁止环境依赖（时间、随机、本地时区、DOM、Node 专有 API）。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const PURE_DIRS = ['src/core', 'src/calendar', 'src/ziwei', 'src/bazi', 'src/interpret', 'src/crossref', 'src/review', 'src/rules'];
const ALL_SRC_FORBIDDEN = [/Date\.now\s*\(/, /new\s+Date\s*\(/, /Math\.random\s*\(/, /performance\.now/, /toLocale\w*String/];
const PURE_FORBIDDEN = [/\bIntl\./, /\bprocess\./, /\bwindow\b/, /\bdocument\b/, /localStorage/, /sessionStorage/, /indexedDB/, /\brequire\s*\(/, /from\s+['"]node:/, /from\s+['"]fs['"]/];

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(n)) out.push(p);
  }
  return out;
}
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const errors: string[] = [];
for (const f of walk(join(ROOT, 'src'))) {
  const rel = f.slice(ROOT.length + 1);
  const src = strip(readFileSync(f, 'utf8'));
  const pure = PURE_DIRS.some((d) => rel.startsWith(d + '/') || rel === d);
  for (const re of ALL_SRC_FORBIDDEN) if (re.test(src)) errors.push(`${rel}: 禁止使用 ${re}`);
  if (pure) for (const re of PURE_FORBIDDEN) if (re.test(src)) errors.push(`${rel}: 纯计算目录禁止使用 ${re}`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`check-purity OK（扫描 ${walk(join(ROOT, 'src')).length} 个文件）`);
