// 出处校验：无出处、语料引用不存在、classical 无原文的规则会使构建失败。
import { RULES, validateRules } from '../src/rules';

const errs = validateRules(RULES);
if (errs.length) {
  console.error(errs.join('\n'));
  process.exit(1);
}
const all = [...RULES.ziwei, ...RULES.bazi, ...RULES.cross];
const by = (k: string) => all.filter((r) => r.evidenceType === k).length;
const quoted = all.filter((r) => r.classical.length > 0).length;
console.log(`check-sources OK：${all.length} 条规则（其中 ${quoted} 条附古籍原文引文；依据等级 古籍原文 ${by('classical')}／流派观点 ${by('school')}／现代整理 ${by('modern')}／算法结构 ${by('structural')}），` +
  `语料条目 ${Object.keys(RULES.corpus).length}，未审核 ${all.filter((r) => r.review.status === 'draft').length}`);
