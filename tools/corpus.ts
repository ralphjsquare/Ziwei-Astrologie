// 古籍语料工作流（需要网络的步骤在你的电脑或放行网络的环境中运行）：
//   npm run corpus:find -- 紫微斗数            检索维基文库页面标题（先确认真实标题，再填 docs/sources/manifest.json）
//   npm run corpus:fetch                       按清单下载页面（含子页面）到 docs/sources/raw/，并记录修订号、时间、站点许可文字
//   npm run corpus:import                      清洗、分节、生成 src/rules/corpus.json（licenseVerified=false 的来源拒绝入库）
//   npm run corpus:suggest                     为每条规则检索引文候选，写入 docs/sources/quote-candidates.md 供人工挑选
//   npm run corpus:apply -- docs/sources/quotes.json   应用人工确认的引文（必须是语料原文子串）并校验
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Converter } from 'opencc-js';
import { httpGet, sleep } from './http';
import { applyGrounding, applyQuotes, buildCorpusEntries, findCandidates, wikitextToPlain, type CorpusSourceMeta, type QuotePatch } from '../src/corpus';
import { RULES, validateRules, type CorpusEntry, type Rule } from '../src/rules';

const MANIFEST = 'docs/sources/manifest.json';
const RAW = 'docs/sources/raw';
interface ManifestItem { joinLines?: boolean; id: string; book: string; site: string; title: string; includeSubpages: boolean; license: string; licenseVerified: boolean; edition: string }
interface RawMeta { id: string; page: string; url: string; revid: number; timestamp: string; retrievedAt: string; siteRights: string; file: string }

const today = () => new Date().toISOString().slice(0, 10);
const api = async (site: string, params: Record<string, string>) => {
  const u = `https://${site}/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  await sleep(2500); // 维基媒体 API 礼貌限速
  return JSON.parse(await httpGet(u)) as any;
};
const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const safe = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, '_');

async function find(kw: string) {
  const d = await api('zh.wikisource.org', { action: 'query', list: 'search', srsearch: kw, srlimit: '20' });
  for (const r of d.query.search) console.log(`${r.title}\t${String(r.snippet).replace(/<[^>]+>/g, '').slice(0, 60)}`);
}

async function fetchAll() {
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
  const items = readJson<{ corpus: ManifestItem[] }>(MANIFEST).corpus.filter((x) => x.title && (!only || only.includes(x.id)));
  if (!items.length) throw new Error('清单里没有填写 title 的条目：请先用 corpus:find 确认页面标题');
  for (const it of items) {
    const rights = (await api(it.site, { action: 'query', meta: 'siteinfo', siprop: 'rightsinfo' })).query.rightsinfo;
    let titles = [it.title];
    if (it.includeSubpages) {
      const sub = await api(it.site, { action: 'query', list: 'allpages', apprefix: it.title + '/', aplimit: '500' });
      titles = titles.concat(sub.query.allpages.map((p: { title: string }) => p.title).filter((t: string) => !/\/全覽\d*$/.test(t)));
    }
    const dir = join(RAW, it.id);
    mkdirSync(dir, { recursive: true });
    const metas: RawMeta[] = [];
    const prev: RawMeta[] = existsSync(join(dir, 'meta.json')) ? readJson<RawMeta[]>(join(dir, 'meta.json')) : [];
    for (const [i, t] of titles.entries()) {
      const done = prev.find((m) => m.page === t);
      if (done && existsSync(join(dir, done.file))) { metas.push(done); continue; } // 断点续传
      let d: any;
      try { d = await api(it.site, { action: 'query', prop: 'revisions', rvprop: 'content|ids|timestamp', rvslots: 'main', titles: t }); } catch (e) { console.warn('失败（可重跑续传）：', t, (e as Error).message.slice(0, 60)); continue; }
      const page = d.query.pages[0];
      if (page.missing || !page.revisions) { console.warn('缺失页面：', t); continue; }
      const rev = page.revisions[0];
      const file = `${String(i).padStart(3, '0')}-${safe(t)}.wikitext`;
      writeFileSync(join(dir, file), rev.slots.main.content, 'utf8');
      metas.push({ id: it.id, page: t, url: `https://${it.site}/wiki/${encodeURIComponent(t)}?oldid=${rev.revid}`, revid: rev.revid, timestamp: rev.timestamp, retrievedAt: today(), siteRights: `${rights.text} ${rights.url}`, file });
      console.log('已下载', t);
      writeFileSync(join(dir, 'meta.json'), JSON.stringify(metas, null, 1) + '\n', 'utf8'); // 边下边存
    }
    writeFileSync(join(dir, 'meta.json'), JSON.stringify(metas, null, 1) + '\n', 'utf8');
  }
  console.log('完成。请阅读各站点与页面的许可条款，再修改清单中的 license 与 licenseVerified，然后运行 corpus:import。');
}

function importCorpus() {
  const items = readJson<{ corpus: ManifestItem[] }>(MANIFEST).corpus;
  const corpus: Record<string, CorpusEntry> = existsSync('src/rules/corpus.json') ? readJson('src/rules/corpus.json') : {};
  for (const it of items) {
    const dir = join(RAW, it.id);
    if (!existsSync(join(dir, 'meta.json'))) continue;
    if (!it.licenseVerified) { console.warn(`跳过 ${it.id}：许可尚未核对（licenseVerified=false）`); continue; }
    for (const m of readJson<RawMeta[]>(join(dir, 'meta.json'))) {
      const meta: CorpusSourceMeta = { id: it.id, book: it.book, url: m.url, license: it.license, retrievedAt: m.retrievedAt, licenseVerified: it.licenseVerified, edition: it.edition || undefined, joinLines: it.joinLines, page: m.page.includes('/') ? m.page.slice(m.page.indexOf('/') + 1) : undefined };
      Object.assign(corpus, buildCorpusEntries(meta, wikitextToPlain(readFileSync(join(dir, m.file), 'utf8'))));
    }
  }
  writeFileSync('src/rules/corpus.json', JSON.stringify(corpus, null, 1) + '\n', 'utf8');
  console.log(`语料条目：${Object.keys(corpus).length}`);
}

function suggest() {
  const corpus = readJson<Record<string, CorpusEntry>>('src/rules/corpus.json');
  if (!Object.keys(corpus).length) throw new Error('语料为空：先运行 corpus:import');
  const toTw = Converter({ from: 'cn', to: 'tw' });
  const out = ['# 引文候选（自动检索，仅供人工挑选；不得直接当作依据）', '', '把确认的引文写入 `docs/sources/quotes.json`：`[{"ruleId":"…","quotes":[{"corpusRef":"…","quote":"逐字摘自候选"}],"claimSupported":true}]`，其中 `claimSupported` 表示审核人确认该引文确实支持这条解释。', ''];
  for (const r of [...RULES.ziwei, ...RULES.bazi] as Rule[]) {
    if (r.evidenceType === 'structural' || r.evidenceType === 'modern') continue;
    const term = r.title.split('（')[0].replace(/^(日主|流年|坐命宫|.*入宫)$/, '');
    if (!term || term.length > 6) continue;
    const kw = toTw(term);
    const c = findCandidates(corpus, [kw], 3)[kw];
    out.push(`## ${r.id}｜${r.title}`, '', `检索词：${kw}`, '', ...(c.length ? c.map((x) => `- \`${x.corpusRef}\`（${x.section}）：…${x.excerpt}…`) : ['- （无命中）']), '');
  }
  writeFileSync('docs/sources/quote-candidates.md', out.join('\n'), 'utf8');
  console.log('已写入 docs/sources/quote-candidates.md');
}

function apply(file: string) {
  const corpus = readJson<Record<string, CorpusEntry>>('src/rules/corpus.json');
  const patches = readJson<QuotePatch[]>(file);
  const files: [string, Rule[]][] = [['src/rules/ziwei.json', RULES.ziwei], ['src/rules/bazi.json', RULES.bazi], ['src/rules/cross.json', RULES.cross]];
  const res = applyQuotes([...RULES.ziwei, ...RULES.bazi, ...RULES.cross], corpus, patches);
  const errs = validateRules({ ...RULES, corpus });
  if (res.errors.length || errs.length) { console.error([...res.errors, ...errs].join('\n')); process.exit(1); }
  for (const [p, rules] of files) writeFileSync(p, JSON.stringify(rules, null, 1) + '\n', 'utf8');
  console.log(`已回写 ${res.updated} 条规则的引文`);
}

function ground() {
  const corpus = readJson<Record<string, CorpusEntry>>('src/rules/corpus.json');
  const items = readJson<import('../src/corpus').GroundingItem[]>('docs/sources/grounding.json');
  const files: [string, Rule[]][] = [['src/rules/ziwei.json', RULES.ziwei], ['src/rules/bazi.json', RULES.bazi], ['src/rules/cross.json', RULES.cross]];
  const res = applyGrounding([...RULES.ziwei, ...RULES.bazi, ...RULES.cross], corpus, items, { zwqs: 'zwqs', smtht: 'smtht' });
  const errs = validateRules({ ...RULES, corpus });
  if (res.errors.length || errs.length) { console.error([...res.errors, ...errs].join('\n')); process.exit(1); }
  for (const [p, rules] of files) writeFileSync(p, JSON.stringify(rules, null, 1) + '\n', 'utf8');
  console.log(`已落地 ${res.updated} 条规则（引文均在语料中唯一定位）`);
}

const [cmd, arg] = process.argv.slice(2);
void readdirSync;
switch (cmd) {
  case 'find': await find(arg ?? ''); break;
  case 'fetch': await fetchAll(); break;
  case 'import': importCorpus(); break;
  case 'suggest': suggest(); break;
  case 'apply': apply(arg); break;
  case 'ground': ground(); break;
  default: console.log('用法：find <关键词> | fetch | import | suggest | apply <quotes.json>');
}
