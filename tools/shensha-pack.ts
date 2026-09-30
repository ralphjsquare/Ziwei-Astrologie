// 生成“神煞规则审阅包”到 docs/packages/神煞规则包/，并压缩成 zip。内容：总表、规则明细（含引文与异文）、可填写的审核表 csv、json、待确认与异文说明、相关 ADR。
// 用法：npm run pack:shensha
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { RULES, type Rule } from '../src/rules';
import { exportRules, SOURCE_CLASS_LABEL } from '../src/review';
import { SHENSHA_NAMES } from '../src/bazi/shensha';

const OUT = 'docs/packages/神煞规则包';
const at = process.argv.includes('--at') ? process.argv[process.argv.indexOf('--at') + 1] : new Date().toISOString().slice(0, 10);

/** 每种神煞的检测判据（与 src/bazi/shensha.ts 一致；地支以四柱的年、月、日、时地支计） */
const SPEC: Record<string, { rule: string; base: string; note?: string }> = {
  天乙贵人: { rule: '甲戊庚见丑未；乙己见子申；丙丁见亥酉；壬癸见卯巳；辛见午寅', base: '日干、年干各自作基准', note: '落在四柱地支' },
  驿马: { rule: '申子辰见寅；寅午戌见申；巳酉丑见亥；亥卯未见巳', base: '年支、日支各自作基准' },
  咸池: { rule: '申子辰见酉；寅午戌见卯；巳酉丑见午；亥卯未见子（即“桃花”）', base: '年支、日支' },
  劫煞: { rule: '申子辰见巳；寅午戌见亥；巳酉丑见寅；亥卯未见申', base: '年支、日支' },
  亡神: { rule: '申子辰见亥；寅午戌见巳；巳酉丑见申；亥卯未见寅', base: '年支、日支' },
  将星: { rule: '三合局的中位：申子辰见子；寅午戌见午；巳酉丑见酉；亥卯未见卯', base: '年支、日支' },
  华盖: { rule: '三合局的库位：申子辰见辰；寅午戌见戌；巳酉丑见丑；亥卯未见未', base: '年支、日支' },
  羊刃: { rule: '禄前一位，只阳干有：甲卯、丙戊午、庚酉、壬子', base: '日干', note: '选项 yinStemYangRen 开启后，阴干取禄后一位：乙寅、丁己巳、辛申、癸亥（另一流派）' },
  金舆: { rule: '禄前二辰：甲辰、乙巳、丙戊未、丁己申、庚戌、辛亥、壬丑、癸寅', base: '日干' },
  孤辰: { rule: '亥子丑年见寅；寅卯辰年见巳；巳午未年见申；申酉戌年见亥', base: '年支' },
  寡宿: { rule: '亥子丑年见戌；寅卯辰年见丑；巳午未年见辰；申酉戌年见未', base: '年支' },
  月德贵人: { rule: '寅午戌月见丙；申子辰月见壬；亥卯未月见甲；巳酉丑月见庚（看天干）', base: '月支所在三合局' },
  月德合: { rule: '月德天干的五合之干（丙辛、壬丁、甲己、庚乙）', base: '月支' },
  德秀贵人: { rule: '寅午戌月：德丙丁、秀戊癸；申子辰月：德壬癸戊己、秀丙辛甲己；巳酉丑月：德庚辛、秀乙庚；亥卯未月：德甲乙、秀丁壬（看天干）', base: '月支', note: '单见即列出；qualified 仅表示德、秀同见（qualifiedMeaning=德秀同见），不含“无破冲克压”条件' },
  元辰: { rule: '年支之冲的前一位（阳男阴女）或后一位（阴男阳女）', base: '年支、年干阴阳与性别' },
  灾煞: { rule: '将星之冲：申子辰见午；寅午戌见子；巳酉丑见卯；亥卯未见酉', base: '年支、日支' },
  勾煞: { rule: '阳男阴女：年支之前三位；阴男阳女：之后三位', base: '年支与性别' },
  绞煞: { rule: '阳男阴女：年支之后三位；阴男阳女：之前三位', base: '年支与性别', note: '原文“命后一三辰”疑为“命后三辰”，按其举例取后三位' },
  十恶大败: { rule: '日柱为甲辰、乙巳、丙申、丁亥、戊戌、己丑、庚辰、辛巳、壬申、癸亥', base: '日柱', note: '原文名单写“乙丑”，按原文自身判据应为己丑' },
  天罗: { rule: '火命男，命局戌、亥同见', base: '年柱纳音五行' },
  地网: { rule: '水或土命女，命局辰、巳同见', base: '年柱纳音五行' },
  三奇贵人: { rule: '四柱天干含乙丙丁（天上）或甲戊庚（地下）或辛壬癸（人中）', base: '四柱天干', note: '检测层：三干均出现即列出；成立层 qualified=年月日或月日时连续依序' },
  禄神: { rule: '日干之禄：甲寅、乙卯、丙戊巳、丁己午、庚申、辛酉、壬亥、癸子', base: '日干' },
  魁罡: { rule: '日柱为庚辰、壬辰、戊戌、庚戌', base: '日柱' },
  日德: { rule: '日柱为甲寅、丙辰、戊辰、庚辰、壬戌', base: '日柱' },
  日贵: { rule: '日柱为丁酉、丁亥、癸巳、癸卯', base: '日柱' },
  丧门: { rule: '年支后第二位（年支+2）', base: '年支' },
  吊客: { rule: '年支前第二位（年支−2）', base: '年支' },
  天德贵人: { rule: '寅丁、卯申、辰壬、巳辛、午亥、未甲、申癸、酉寅、戌丙、亥乙、子巳、丑庚（月支→天干或地支）', base: '月支', note: '前四个月原文逐项列出，其余据“余照此”' },
  天德合: { rule: '天德的合：丁壬、申巳、壬丁、辛丙、亥寅、甲己、癸戊、寅亥、丙辛、乙庚、巳申、庚乙', base: '月支' },
  文昌贵人: { rule: '默认《三命通会》歌诀表：甲巳乙亥丙戌丁辰戊申己午庚寅辛未壬卯癸丑；选项 common：甲巳乙午丙申丁酉戊申己酉庚亥辛子壬寅癸卯', base: '日干、年干' },
  太极贵人: { rule: '甲乙见子午；丙丁见卯酉；戊己见辰戌丑未；庚辛见寅亥；壬癸见申巳', base: '日干、年干' },
  红鸾: { rule: '年支：子卯、丑寅、寅丑、卯子、辰亥、巳戌、午酉、未申、申未、酉午、戌巳、亥辰', base: '年支', note: '现代通行整理，语料无对应表' },
  天喜: { rule: '红鸾的对冲位', base: '年支', note: '现代通行整理；不同于原文按季节的“天喜神”' },
  正学堂: { rule: '年柱纳音五行的长生位（金巳木亥水土申火寅），且该柱纳音同五行', base: '年柱纳音' },
  正词馆: { rule: '年柱纳音五行的临官位（金申木寅水土亥火巳），且该柱纳音同五行', base: '年柱纳音' },
  官贵学堂: { rule: '日干（年干）五行的官星五行之长生位', base: '日干、年干', note: '又称学堂会禄' },
  官贵词馆: { rule: '日干（年干）五行的官星五行之临官位', base: '日干、年干' },
  官星学堂: { rule: '辛亥（甲乙）、壬寅（丙丁）、甲申（戊己）、丁巳（庚辛）；壬癸→戊申（反推）', base: '日干、年干' },
  食神学堂: { rule: '日干的食神干配其五行长生位，阴阳不配取临官位：甲丙寅乙丁巳丙戊申（原文），丁己亥戊庚申己辛巳庚壬申辛癸亥壬甲寅癸乙亥（反推）', base: '日干' },
  学堂会贵: { rule: '年柱纳音的帝旺位，且是年干（本命干）的天乙贵人；不用日干的天乙；查日柱、时柱', base: '年柱纳音、年干' },
  天赦日: { rule: '春（寅卯辰月）戊寅日；夏（巳午未月）甲午日；秋（申酉戌月）戊申日；冬（亥子丑月）甲子日', base: '月令季节、日柱' },
  八专日: { rule: '日柱为甲寅、乙卯、己未、丁未、庚申、辛酉、戊戌、癸丑', base: '日柱' },
  九丑日: { rule: '日柱为壬子、壬午、戊子、戊午、己酉、己卯、乙卯、乙酉、辛酉、辛卯', base: '日柱', note: '四库本十日；维基文库转录漏乙酉；bazi-lite 误作丁酉' },
  孤鸾煞: { rule: '日柱为乙巳、丁巳、辛亥、戊申、甲寅、丙午、戊午、壬子', base: '日柱' },
  阴阳差错: { rule: '日柱为丙子、丁丑、戊寅、辛卯、壬辰、癸巳、丙午、丁未、戊申、辛酉、壬戌、癸亥', base: '日柱' },
  红艳煞: { rule: '默认原文表：甲乙午、丙寅、丁未、戊子、己辰、庚戌、辛酉、壬巳、癸申；选项 common：戊辰、壬子', base: '日干' },
  六厄: { rule: '申子辰见卯；寅午戌见酉；亥卯未见午；巳酉丑见子', base: '年支、日支所在三合局' },
  暗金煞: { rule: '子午卯酉见巳；寅申巳亥见酉；辰戌丑未见丑', base: '年支、日支' },
  破煞: { rule: '任意两柱地支为卯午、丑辰、子酉、未戌', base: '柱间' },
  拱禄: { rule: '日时同干：癸（亥丑）拱子；丁（巳未）、己（未巳）拱午；戊（辰午）拱巳', base: '日柱、时柱' },
  拱贵: { rule: '日时同干：甲（申戌）拱酉；乙（未酉）拱申；甲（寅子）拱丑；戊（申午）拱未；辛（丑卯）拱寅', base: '日柱、时柱' },
  天福贵人: { rule: '官星坐禄：甲酉、乙申（原文），丙子、丁亥、戊卯、己寅、庚午、辛巳、壬午、癸巳（反推）', base: '日干、年干' },
  自缢煞: { rule: '年支戌见巳、巳见戌、辰见亥、亥见辰、寅见未、未见寅、卯见申、申见卯、午见丑、丑见午、子见酉、酉见子', base: '年支' },
  挂剑煞: { rule: '四柱地支全在巳、酉、丑、申之内', base: '四柱地支', note: '“纯全”的字面解读' },
  天火煞: { rule: '寅午戌三支俱全，天干见丙或丁且不见壬癸', base: '四柱', note: '“五位中全不见水”按字面解为天干不见壬癸，不含藏干' },
  宅墓煞: { rule: '年支之前五辰（宅）、之后五辰（墓）', base: '年支', note: '四库本作“为宅”，维基转录作“为灾”' },
  天屠煞: { rule: '日支与时支：丑亥、寅戌、卯酉、辰申、巳未（互换亦可）', base: '日支、时支' },
  阴阳煞: { rule: '男得丙子（正阴）、女得戊午（正阳）；反之男戊午、女丙子为相反', base: '日柱、性别' },
  戟锋煞: { rule: '月令旺干（正甲二乙三戊四丙五丁六己七庚八辛九戊十壬十一癸十二己）；日、时两重成立', base: '月支、日干、时干', note: '原文十二月写作“巳”，取己' },
  水溺煞: { rule: '丙子、癸未、癸丑之柱，其地支为咸池（年支、日支）或羊刃（日干）', base: '各柱', note: '原文“金刃”未说明，不含' },
  飞刃: { rule: '日干羊刃之冲：甲酉乙申丙戊子丁己亥庚卯辛寅壬午癸巳', base: '日干' },
  福星贵人: { rule: '甲寅子、乙卯丑、丙寅子、丁亥、戊申、己未、庚午、辛巳、壬辰、癸卯丑', base: '年干、日干', note: '原文举例乙人见丁亥丁丑，与通行表不同' },
  国印贵人: { rule: '甲戌、乙亥、丙丑、丁寅、戊丑、己寅、庚辰、辛巳、壬未、癸申', base: '年干、日干' },
  天厨贵人: { rule: '甲巳、乙午、丙巳、丁午、戊申、己酉、庚亥、辛子、壬寅、癸卯', base: '年干、日干' },
  天医: { rule: '月支的前一位地支', base: '月支' },
  血刃: { rule: '子月午、丑月子、寅月丑、卯月未、辰月寅、巳月申、午月卯、未月酉、申月辰、酉月戌、戌月巳、亥月亥', base: '月支' },
  流霞: { rule: '甲酉、乙戌、丙未、丁申、戊巳、己午、庚辰、辛卯、壬亥、癸寅', base: '日干' },
  披麻: { rule: '年支＋9（年支之后三位）', base: '年支' },
  金神: { rule: '日干甲或己，时柱为乙丑、己巳、癸酉', base: '日干、时柱' },
  童子: { rule: '日、时支：春秋见寅子，冬夏见卯未辰；或年柱纳音金木见午卯、水火见酉戌、土见辰巳', base: '季节或年柱纳音' },
  十灵日: { rule: '日柱为甲辰、乙亥、丙辰、丁酉、戊午、庚寅、庚戌、辛亥、壬寅、癸未', base: '日柱' },
  六秀日: { rule: '日柱为丙子、丁丑、戊寅、戊午、己卯、己未', base: '日柱' },
  四废日: { rule: '春庚申辛酉；夏壬子癸亥；秋甲寅乙卯；冬丙午丁巳', base: '季节、日柱' },
  地转: { rule: '春辛卯；夏戊午；秋癸酉；冬丙子', base: '季节、各柱' },
  天转: { rule: '春乙卯；夏丙午；秋辛酉；冬壬子', base: '季节、各柱' },
  日干学堂: { rule: '日干长生位：甲亥乙午丙戊寅丁己酉庚巳辛子壬申癸卯', base: '日干' },
  日干词馆: { rule: '日干禄位：甲寅乙卯丙戊巳丁己午庚申辛酉壬亥癸子', base: '日干' },
};
const key = (n: string) => n.replace(/（.*）/, '');
const ruleOf = (n: string): Rule => (RULES.byId.get(`bz.shensha.${key(n)}`) ?? RULES.byId.get(`modern_shensha.${key(n)}`))!;
const rules = SHENSHA_NAMES.map(ruleOf);
const missing = SHENSHA_NAMES.filter((n) => !SPEC[key(n)] && !SPEC[n]);
if (missing.length) throw new Error(`缺判据说明：${missing.join('、')}`);
const spec = (n: string) => SPEC[key(n)] ?? SPEC[n];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/相关决策记录`, { recursive: true });
const count: Record<string, number> = {};
for (const r of rules) count[r.sourceClass!] = (count[r.sourceClass!] ?? 0) + 1;

writeFileSync(`${OUT}/00_说明.md`, [
  '# 神煞规则审阅包', '', `- 生成日期：${at}`, `- 规则集版本：${RULES.version}`, `- 神煞规则：${rules.length} 条（引擎代码 \`src/bazi/shensha.ts\`；全部状态为“未审核”）`, '',
  '## 这个包里有什么', '',
  '| 文件 | 用途 |', '|---|---|',
  '| 01_神煞总表.md | 一页看完：每种神煞的判据、基准、来源分级、有无异文 |',
  '| 02_规则明细.md | 逐条规则：判据、白话解释、古籍引文（逐字）、版本异文、审核意见空栏 |',
  '| 03_规则审核表.csv | 给审核人填写的表（“审核意见”“新状态”两列），可用 `npm run review:import` 导回 |',
  '| 04_规则.json | 机器可读的同一份数据 |',
  '| 05_待确认与异文.md | 已确认的取舍、转录异文、与四库本的核对结果 |',
  '| 相关决策记录/ | ADR-016～019（第二批、取舍定稿、学堂词馆、第四批） |', '',
  '## 来源分级（sourceClass）', '',
  ...Object.entries(SOURCE_CLASS_LABEL).map(([k, v]) => `- \`${k}\`：${v}${count[k] ? `（${count[k]} 条）` : ''}`), '',
  '## 审阅时请注意', '',
  '1. 引文来自维基文库转录本（《三命通会》卷一至九、卷十至十二的四库本页面），版本未核实，且与 Kanripo 文渊阁四库本做过机械核对，异文已标注；**仍须对照影印本**。',
  '2. “反推”类规则（DERIVED_FROM_TEXT）是原文只给例子、判据由例子推出，需要重点审核。',
  '3. “现代整理”类（红鸾、天喜）没有古籍引文，是通行说法。',
  '4. 所有解释文字遵循“传统说法 + 概率性措辞”，不做绝对化断言；如有不当请在审核意见中指出。',
  '5. 本包只反映本项目的取舍，不是对各神煞灵验与否的判断。', '',
].join('\n'));

const hdr = ['| 神煞 | 规则 ID | 来源分级 | 判据 | 基准 | 引文数 | 异文 | 备注 |', '|---|---|---|---|---|---|---|---|'];
writeFileSync(`${OUT}/01_神煞总表.md`, ['# 神煞总表', '', ...hdr, ...rules.map((r, i) => { const n = SHENSHA_NAMES[i]; const s = spec(n); return `| ${key(n)} | \`${r.id}\` | ${SOURCE_CLASS_LABEL[r.sourceClass!]} | ${s.rule} | ${s.base} | ${r.classical.length} | ${r.classical.some((q) => q.variant) ? '有' : '—'} | ${s.note ?? ''} |`; }), ''].join('\n'));

const L = ['# 神煞规则明细', ''];
rules.forEach((r, i) => {
  const n = SHENSHA_NAMES[i]; const s = spec(n);
  L.push(`## ${key(n)}｜${r.id}`, '', `- 来源分级：${SOURCE_CLASS_LABEL[r.sourceClass!]}`, `- 判据：${s.rule}`, `- 基准：${s.base}`, ...(s.note ? [`- 备注：${s.note}`] : []),
    `- 出处：${r.sources.map((x) => `${RULES.sources[x.ref].book}${x.section ? '·' + x.section : ''}（${RULES.sources[x.ref].edition}）`).join('；')}`, '',
    `**白话解释**：${r.plain}`, '');
  if (r.classical.length) for (const q of r.classical) L.push(`> 引文（${RULES.corpus[q.corpusRef].section}）：「${q.quote}」`, ...(q.variant ? [`> 版本异文：${q.variant}`] : []), '');
  else L.push('> （无古籍引文）', '');
  L.push('**审核意见**：', '', '**新状态**（draft / reviewed / approved / rejected）：', '', '---', '');
});
writeFileSync(`${OUT}/02_规则明细.md`, L.join('\n'));
writeFileSync(`${OUT}/03_规则审核表.csv`, exportRules(RULES, rules, 'csv', at));
writeFileSync(`${OUT}/04_规则.json`, exportRules(RULES, rules, 'json', at));

const variants = JSON.parse(readFileSync('docs/sources/textual-variants.json', 'utf8')) as Record<string, string>[];
const cc = JSON.parse(readFileSync('docs/sources/crosscheck.json', 'utf8')) as { rows: { ruleId: string; quote: string; found: boolean }[] };
const shRows = cc.rows.filter((x) => /shensha/.test(x.ruleId));
writeFileSync(`${OUT}/05_待确认与异文.md`, [
  '# 待确认事项、异文与核对', '',
  '## 已确认的取舍（S1–S9）', '', '见 `相关决策记录/ADR-017`；原始讨论稿见仓库 `docs/sources/SHENSHA_DISCUSSION.md`。', '',
  '## 转录异文（已用 Kanripo 文渊阁四库本核对）', '',
  ...variants.map((v) => `- **${v.id}**（${v.where}）：语料作“${v.corpus}”；其他传本作“${v.other}”。${v.effect}`), '',
  `## 神煞引文与四库本的机械核对`, '', `神煞相关引文 ${shRows.length} 条，与四库本一致 ${shRows.filter((x) => x.found).length} 条，其余为一字异文或转录之误：`, '',
  ...shRows.filter((x) => !x.found).map((x) => `- \`${x.ruleId}\`：${x.quote}`), '',
  '## 仍未处理', '', '- 学堂词馆中“纳音不要见克”“要乘旺”的成色判据不明，未实现。', '- 因原文判据不完整或自相矛盾而暂缓的：官符煞、病符煞、死符煞（原文“太岁前五辰”与“病符对冲”得出同一支）、日刑煞、流血煞、剑锋煞（基准不明）、天刑煞、雷霆煞、吞陷煞、浮沉煞、返本煞、短寿煞，见 ADR-019。', '- 引文均须对照影印本核对。', '',
].join('\n'));
for (const f of ['ADR-016-shensha-batch2.md', 'ADR-017-shensha-decisions.md', 'ADR-018-xuetang-cihuan.md', 'ADR-019-shensha-batch4.md']) cpSync(`docs/adr/${f}`, `${OUT}/相关决策记录/${f}`);
execFileSync('python3', ['-c', "import shutil;shutil.make_archive('docs/packages/神煞规则包','zip',root_dir='docs/packages',base_dir='神煞规则包')"]);
console.log(`已生成 ${OUT} 与 ${OUT}.zip（${rules.length} 条规则）`);
