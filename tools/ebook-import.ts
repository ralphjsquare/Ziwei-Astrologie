// 把 docs/sources/ebook-excerpts.json（用户提供的第三方电子书里被引用到的章节）并入 src/rules/corpus.json。
// 这些电子书来自第三方电子书站，整理者与底本不明；用户已明确接受其作为“版本未核实”的来源，因此每条语料都带醒目的版本说明。
// 用法：npx tsx tools/ebook-import.ts
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import type { CorpusEntry } from '../src/rules';

const BOOKS: Record<string, { book: string; edition: string }> = {
  zpzq: { book: '子平真诠', edition: '【版本未核实】第三方电子书转录本（“子平真诠原本”epub，整理者与底本不明，含/不含评注未核实）；用户于 2026-09-29 提供并接受为未核实来源；须对照影印本核对' },
  yhzp: { book: '渊海子平', edition: '【版本未核实】第三方电子书转录本（“渊海子平”epub，整理者与底本不明，疑为节本，夹带广告页，已剔除）；用户于 2026-09-29 提供并接受为未核实来源；须对照影印本核对' },
};
const LICENSE = '原典为清代/宋元著作，属公有领域；电子转录本的整理者与授权不明，仅摘录被引用的章节，不再分发全书';
const excerpts = JSON.parse(readFileSync('docs/sources/ebook-excerpts.json', 'utf8')) as Record<string, Record<string, string>>;
const corpus = JSON.parse(readFileSync('src/rules/corpus.json', 'utf8')) as Record<string, CorpusEntry>;
for (const [id, chapters] of Object.entries(excerpts)) {
  for (const [section, text] of Object.entries(chapters)) {
    const plain = text.replace(/\s+/g, '');
    corpus[`${id}/${section}#1`] = { book: BOOKS[id].book, section, text: plain, url: 'user-provided-ebook', license: LICENSE, retrievedAt: '2026-09-29', sha256: createHash('sha256').update(plain).digest('hex'), edition: BOOKS[id].edition };
  }
}
// 穷通宝鉴：日主×月份条目（tools/gen-tiaohou.ts 生成）
const QT_EDITION = '【版本未核实】第三方电子书站的“穷通宝鉴”txt（整理者与底本不明）；用户于 2026-09-29 提供并接受为未核实来源；须对照影印本核对';
const qt = JSON.parse(readFileSync('docs/sources/qtbj-excerpts.json', 'utf8')) as Record<string, { lead: string; shared?: boolean }>;
for (const [key, v] of Object.entries(qt)) {
  corpus[`qtbj/${key}#1`] = { book: '穷通宝鉴', section: `日主${key[0]}·${key[1]}月${v.shared ? '（原书按季节或相邻月份合写）' : ''}`, text: v.lead, url: 'user-provided-ebook', license: LICENSE, retrievedAt: '2026-09-29', sha256: createHash('sha256').update(v.lead).digest('hex'), edition: QT_EDITION };
}
writeFileSync('src/rules/corpus.json', JSON.stringify(corpus, null, 1) + '\n', 'utf8');
console.log(`语料条目：${Object.keys(corpus).length}`);
