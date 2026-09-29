// 用法：npm run review:export -- --scope all --status draft --format md [--out file] [--chart 1990-06-15T10:30,M]
import { writeFileSync } from 'node:fs';
import { RULES } from '../src/rules';
import { computeCharts } from '../src/index';
import { interpretNatal, interpretYear } from '../src/interpret';
import { exportChartReview, exportRules, selectRules, type ReviewFormat, type ReviewScope } from '../src/review';
import type { ReviewStatus } from '../src/rules';

const arg = (k: string, d: string) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const generatedAt = arg('at', new Date().toISOString().slice(0, 10)); // CLI 层可读时钟；引擎层不可
const out = arg('out', '');
const chart = arg('chart', '');
let text: string;
if (chart) {
  const m = /^(\d+)-(\d+)-(\d+)T(\d+):(\d+),([MF])$/.exec(chart);
  if (!m) throw new Error('--chart 格式：YYYY-MM-DDTHH:MM,M|F');
  const [y, mo, d, h, mi] = m.slice(1, 6).map(Number);
  const b = computeCharts({ calendar: 'solar', year: y, month: mo, day: d, hour: h, minute: mi, gender: m[6] as 'M' | 'F', place: { utcOffsetMinutes: 480, dstMinutes: 0 } });
  const secs = [...interpretNatal(b, RULES), ...interpretYear(b, Number(arg('year', String(y + 30))), RULES)];
  text = exportChartReview(chart, secs, b.calculationHash, generatedAt);
} else {
  const rules = selectRules(RULES, arg('scope', 'all') as ReviewScope, arg('status', 'all') as ReviewStatus | 'all');
  text = exportRules(RULES, rules, arg('format', 'md') as ReviewFormat, generatedAt);
}
if (out) writeFileSync(out, text, 'utf8'); else process.stdout.write(text + '\n');
