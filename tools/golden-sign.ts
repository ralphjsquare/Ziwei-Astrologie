// 用法：npm run golden:sign -- G03 G07 --by 张老师 [--date 2026-10-01]
// 在 test/fixtures/golden.json 中记录人工核对签字（核对方法见 docs/golden/REVIEW_PROTOCOL.md）。
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const by = args[args.indexOf('--by') + 1];
const date = args.includes('--date') ? args[args.indexOf('--date') + 1] : new Date().toISOString().slice(0, 10);
const ids = args.filter((a, i) => /^G\d+$/.test(a) && args[i - 1] !== '--by');
if (!by || by.startsWith('--') || !ids.length) throw new Error('用法：golden:sign -- G03 G07 --by 姓名');
const p = 'test/fixtures/golden.json';
const f = JSON.parse(readFileSync(p, 'utf8'));
for (const id of ids) {
  const c = f.cases.find((x: { id: string }) => x.id === id);
  if (!c) throw new Error(`没有用例 ${id}`);
  c.oracle.humanVerifiedBy = { name: by, date };
}
writeFileSync(p, JSON.stringify(f, null, 1) + '\n', 'utf8');
console.log(`已签字 ${ids.length} 个用例；累计已签字 ${f.cases.filter((c: { oracle: { humanVerifiedBy: unknown } }) => c.oracle.humanVerifiedBy).length}/60`);
