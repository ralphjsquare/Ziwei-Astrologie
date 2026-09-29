// 用法：npm run review:import -- <file.csv|file.json> --reviewer 姓名 [--date 2026-10-01]
// JSON 格式：[{ "id": "...", "status": "reviewed", "reviewer": "...", "note": "..." }]
import { readFileSync, writeFileSync } from 'node:fs';
import { RULES, validateRules, type Rule } from '../src/rules';
import { applyPatches, patchesFromCsv, type ReviewPatch } from '../src/review';

const file = process.argv[2];
const arg = (k: string, d: string) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
if (!file) throw new Error('缺少输入文件');
const reviewer = arg('reviewer', '');
const date = arg('date', new Date().toISOString().slice(0, 10));
const text = readFileSync(file, 'utf8');
const patches: ReviewPatch[] = file.endsWith('.json')
  ? (JSON.parse(text) as Partial<ReviewPatch>[]).map((p) => ({ id: p.id!, status: p.status!, reviewer: p.reviewer ?? reviewer, date: p.date ?? date, note: p.note ?? '' }))
  : patchesFromCsv(text, reviewer, date);
const files: [string, Rule[]][] = [['src/rules/ziwei.json', RULES.ziwei], ['src/rules/bazi.json', RULES.bazi], ['src/rules/cross.json', RULES.cross]];
const res = applyPatches([...RULES.ziwei, ...RULES.bazi, ...RULES.cross], patches);
const errs = validateRules(RULES);
if (res.errors.length || errs.length) { console.error([...res.errors, ...errs].join('\n')); process.exit(1); }
for (const [p, rules] of files) writeFileSync(p, JSON.stringify(rules, null, 1) + '\n', 'utf8');
console.log(`已更新 ${res.updated} 条规则的审核状态`);
