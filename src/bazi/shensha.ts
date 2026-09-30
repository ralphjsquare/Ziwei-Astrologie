// 神煞（v1.1 选取十一种，表格均来自《三命通会》卷二、卷三、卷六的文字；只列出“出现在哪一柱”，不打分）。
// 三合局分组：申子辰、寅午戌、巳酉丑、亥卯未。地支以子=0 计。
import { BRANCHES, STEMS, STEM_ELEMENT, jiaziIndex, nayinElement, type Element } from '../core/ganzhi';

/** 出生年支/日支所属三合局的下标：0 申子辰，1 寅午戌，2 巳酉丑，3 亥卯未 */
export const GROUP_OF: number[] = [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3];

// 三合局 → 目标地支（每项四个：申子辰、寅午戌、巳酉丑、亥卯未）
const YI_MA = [2, 8, 11, 5]; // 寅、申、亥、巳
const XIAN_CHI = [9, 3, 6, 0]; // 酉、卯、午、子
const JIE_SHA = [5, 11, 2, 8]; // 巳、亥、寅、申
const WANG_SHEN = [11, 5, 8, 2]; // 亥、巳、申、寅
const JIANG_XING = [0, 6, 9, 3]; // 子、午、酉、卯（三合中位）
const HUA_GAI = [4, 10, 1, 7]; // 辰、戌、丑、未（三合库）
/** 孤辰、寡宿：按年支所在三方（亥子丑、寅卯辰、巳午未、申酉戌） */
const GU_GUA: Record<number, [number, number]> = (() => {
  const r: Record<number, [number, number]> = {};
  const set = (bs: number[], gu: number, gua: number) => bs.forEach((b) => (r[b] = [gu, gua]));
  set([11, 0, 1], 2, 10); // 亥子丑：孤寅寡戌
  set([2, 3, 4], 5, 1); // 寅卯辰：孤巳寡丑
  set([5, 6, 7], 8, 4); // 巳午未：孤申寡辰
  set([8, 9, 10], 11, 7); // 申酉戌：孤亥寡未
  return r;
})();
/** 天乙贵人（甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，六辛逢马虎） */
const TIAN_YI: number[][] = [[1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [1, 7], [2, 6], [3, 5], [3, 5]];
/** 羊刃：禄前一辰，阳干才有（甲卯、丙戊午、庚酉、壬子） */
const YANG_REN: Record<number, number> = { 0: 3, 2: 6, 4: 6, 6: 9, 8: 0 };
/** 金舆：禄前二辰（禄：甲寅乙卯丙戊巳丁己午庚申辛酉壬亥癸子） */
const LU = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0];
const JIN_YU = LU.map((b) => (b + 2) % 12);

export type ShenShaName = '天乙贵人' | '驿马' | '咸池（桃花）' | '劫煞' | '亡神' | '将星' | '华盖' | '羊刃' | '金舆' | '孤辰' | '寡宿'
  | '月德贵人' | '月德合' | '德秀贵人' | '元辰' | '灾煞' | '勾煞' | '绞煞' | '十恶大败' | '天罗' | '地网' | '三奇贵人' | '禄神' | '魁罡' | '日德' | '日贵' | '丧门' | '吊客'
  | '天德贵人' | '天德合' | '文昌贵人' | '太极贵人' | '红鸾' | '天喜'
  | '正学堂' | '正词馆' | '官贵学堂' | '官贵词馆' | '官星学堂' | '食神学堂' | '学堂会贵';
export const SHENSHA_NAMES: ShenShaName[] = ['天乙贵人', '驿马', '咸池（桃花）', '劫煞', '亡神', '将星', '华盖', '羊刃', '金舆', '孤辰', '寡宿',
  '月德贵人', '月德合', '德秀贵人', '元辰', '灾煞', '勾煞', '绞煞', '十恶大败', '天罗', '地网', '三奇贵人', '禄神', '魁罡', '日德', '日贵', '丧门', '吊客',
  '天德贵人', '天德合', '文昌贵人', '太极贵人', '红鸾', '天喜',
  '正学堂', '正词馆', '官贵学堂', '官贵词馆', '官星学堂', '食神学堂', '学堂会贵'];
/** 月德：月支所在三合局的月德天干（申子辰壬、寅午戌丙、巳酉丑庚、亥卯未甲）；月德合为其五合之干 */
const YUE_DE = [8, 2, 6, 0];
/** 德秀：[德干, 秀干]，按月支所在三合局（申子辰、寅午戌、巳酉丑、亥卯未），据卷三“论德秀” */
const DE_XIU: [number[], number[]][] = [[[8, 9, 4, 5], [2, 7, 0, 5]], [[2, 3], [4, 9]], [[6, 7], [1, 6]], [[0, 1], [3, 8]]];
/** 灾煞：将星之冲（申子辰午、寅午戌子、巳酉丑卯、亥卯未酉） */
const ZAI_SHA = [6, 0, 3, 9];
// 注意：原文列表中写作“乙丑”，但按原文自己的判据（日干之禄落入旬空）应为己丑，且通行表也是己丑，故取己丑（ADR-016）
const SHI_E = ['甲辰', '乙巳', '壬申', '丙申', '丁亥', '庚辰', '戊戌', '癸亥', '辛巳', '己丑'];
const KUI_GANG = ['庚辰', '壬辰', '戊戌', '庚戌'];
const RI_DE = ['甲寅', '丙辰', '戊辰', '庚辰', '壬戌'];
const RI_GUI = ['丁酉', '丁亥', '癸巳', '癸卯'];

/** 天德：按月支，目标为天干或地支（寅丁、卯申、辰壬、巳辛、午亥、未甲、申癸、酉寅、戌丙、亥乙、子巳、丑庚）。前四个月原文有明文，其余据“余照此”与通行表 */
const TIAN_DE: { stem?: number; branch?: number }[] = (() => {
  const t: { stem?: number; branch?: number }[] = new Array(12);
  const S = (c: string) => STEMS.indexOf(c as (typeof STEMS)[number]);
  const B = (c: string) => BRANCHES.indexOf(c as (typeof BRANCHES)[number]);
  t[B('寅')] = { stem: S('丁') }; t[B('卯')] = { branch: B('申') }; t[B('辰')] = { stem: S('壬') }; t[B('巳')] = { stem: S('辛') };
  t[B('午')] = { branch: B('亥') }; t[B('未')] = { stem: S('甲') }; t[B('申')] = { stem: S('癸') }; t[B('酉')] = { branch: B('寅') };
  t[B('戌')] = { stem: S('丙') }; t[B('亥')] = { stem: S('乙') }; t[B('子')] = { branch: B('巳') }; t[B('丑')] = { stem: S('庚') };
  return t;
})();
/** 天德合的地支之合：坤（申）与巽（巳）合、乾（亥）与艮（寅）合 */
const TIAN_DE_HE_BRANCH: Record<number, number> = { 8: 5, 5: 8, 11: 2, 2: 11 };
const WEN_CHANG_SANMING = [5, 11, 10, 4, 8, 6, 2, 7, 3, 1]; // 甲巳 乙亥 丙戌 丁辰 戊申 己午 庚寅 辛未 壬卯 癸丑
const WEN_CHANG_COMMON = [5, 6, 8, 9, 8, 9, 11, 0, 2, 3]; // 甲巳 乙午 丙申 丁酉 戊申 己酉 庚亥 辛子 壬寅 癸卯
const TAI_JI: number[][] = [[0, 6], [0, 6], [3, 9], [3, 9], [4, 10, 1, 7], [4, 10, 1, 7], [2, 11], [2, 11], [5, 8], [5, 8]];
/** 红鸾：年支 → 地支（子卯 丑寅 寅丑 卯子 辰亥 巳戌 午酉 未申 申未 酉午 戌巳 亥辰）；天喜为其对冲 */
const HONG_LUAN = [3, 2, 1, 0, 11, 10, 9, 8, 7, 6, 5, 4];

// ————— 学堂词馆专题（ADR-018）：《三命通会》卷三“论学堂词馆”的五类 —————
const CHANG_SHENG: Record<Element, number> = { 金: 5, 木: 11, 水: 8, 土: 8, 火: 2 }; // 五行长生：金巳 木亥 水土申 火寅
const LIN_GUAN: Record<Element, number> = { 金: 8, 木: 2, 水: 11, 土: 11, 火: 5 }; // 临官：金申 木寅 水土亥 火巳
const DI_WANG: Record<Element, number> = { 金: 9, 木: 3, 水: 0, 土: 0, 火: 6 }; // 帝旺：金酉 木卯 水土子 火午
const GUAN_OF: Record<Element, Element> = { 木: '金', 火: '水', 土: '木', 金: '火', 水: '土' }; // 克我之五行
/** 官星学堂（“生处见克”）：日干（年干）五行的长生位加一个克它的干。原文列出前四组；壬癸（水）据同一规律反推为戊申（与 mingyu-core 一致） */
const GUAN_XING_XUE_TANG: Record<Element, [number, number, boolean]> = { 木: [7, 11, false], 火: [8, 2, false], 土: [0, 8, false], 金: [3, 5, false], 水: [4, 8, true] }; // [干, 支, 是否反推]
/** 食神学堂（学堂会食）：食神干配其五行长生位；阴阳不配成不了干支时取临官位（原文例：甲丙寅、乙丁巳、丙戊申；其余据此反推） */
const SHI_SHEN_XUE_TANG: [number, number, boolean][] = (() => {
  const t: [number, number, boolean][] = [];
  for (let d = 0; d < 10; d++) {
    const food = (d + 2) % 10; // 我生、同阴阳者为食神
    const el = STEM_ELEMENT[food];
    let br = CHANG_SHENG[el];
    if (br % 2 !== food % 2) br = LIN_GUAN[el];
    t.push([food, br, d > 2]); // 原文只举甲、乙、丙三例，其余为反推
  }
  return t;
})();
const TIAN_YI_BR: number[][] = [[1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [1, 7], [2, 6], [3, 5], [3, 5]];

type AddFn = (name: ShenShaName, pillar: PillarKey, basis: string, qualified?: boolean) => void;
function addXueTang(p: Record<PillarKey, P>, keys: PillarKey[], add: AddFn): void {
  const jz = (k: PillarKey) => jiaziIndex(p[k].stem, p[k].branch);
  // 成色：原文“切不要犯空亡及冲破”，并说“要有马”。落空亡、逢冲则 qualified=false；带驿马只作说明
  const dayIdx = jz('day');
  const first = (10 - Math.floor(dayIdx / 10) * 2 + 12) % 12;
  const kong = [first, (first + 1) % 12];
  const yiMaSet = new Set<number>([YI_MA[GROUP_OF[p.year.branch]], YI_MA[GROUP_OF[p.day.branch]]]);
  const hasMa = keys.some((x) => yiMaSet.has(p[x].branch));
  const quality = (k: PillarKey) => {
    const flags: string[] = [];
    if (kong.includes(p[k].branch)) flags.push('落空亡');
    if (keys.some((x) => x !== k && p[x].branch === (p[k].branch + 6) % 12)) flags.push('逢冲');
    if (hasMa) flags.push('命局带驿马');
    return { ok: !flags.includes('落空亡') && !flags.includes('逢冲'), text: flags.length ? `；${flags.join('、')}` : '' };
  };
  const yearEl = nayinElement(jz('year'));
  for (const k of keys) {
    const el = nayinElement(jz(k));
    const q = quality(k);
    if (el === yearEl && p[k].branch === CHANG_SHENG[yearEl]) add('正学堂', k, `年柱纳音${yearEl}，长生在${BRANCHES[p[k].branch]}${q.text}`, q.ok);
    if (el === yearEl && p[k].branch === LIN_GUAN[yearEl]) add('正词馆', k, `年柱纳音${yearEl}，临官在${BRANCHES[p[k].branch]}${q.text}`, q.ok);
  }
  for (const [base, bk] of [['日干', 'day'], ['年干', 'year']] as const) {
    const stem = p[bk].stem;
    const g = GUAN_OF[STEM_ELEMENT[stem]];
    for (const k of keys) {
      const q = quality(k);
      if (p[k].branch === CHANG_SHENG[g]) add('官贵学堂', k, `${base}${STEMS[stem]}（官为${g}），长生在${BRANCHES[p[k].branch]}${q.text}`, q.ok);
      if (p[k].branch === LIN_GUAN[g]) add('官贵词馆', k, `${base}${STEMS[stem]}（官为${g}），临官在${BRANCHES[p[k].branch]}${q.text}`, q.ok);
    }
    const [gs, gb, derived] = GUAN_XING_XUE_TANG[STEM_ELEMENT[stem]];
    for (const k of keys) if (p[k].stem === gs && p[k].branch === gb) { const q = quality(k); add('官星学堂', k, `${base}${STEMS[stem]}，${STEMS[gs]}${BRANCHES[gb]}${derived ? '（原文未列，据规律反推）' : ''}${q.text}`, q.ok); }
  }
  {
    const [fs, fb, derived] = SHI_SHEN_XUE_TANG[p.day.stem];
    for (const k of keys) if (p[k].stem === fs && p[k].branch === fb) { const q = quality(k); add('食神学堂', k, `日干${STEMS[p.day.stem]}食神${STEMS[fs]}，${STEMS[fs]}${BRANCHES[fb]}${derived ? '（原文未列，据例子反推）' : ''}${q.text}`, q.ok); }
  }
  // 学堂会贵：年柱纳音的帝旺位，且该位是年干（本命干）的天乙贵人——不得用日干的天乙（目标日、时柱的干不参与基准）；据原文例子只看日柱、时柱
  const dw = DI_WANG[yearEl];
  if (TIAN_YI_BR[p.year.stem].includes(dw)) {
    for (const k of ['day', 'hour'] as PillarKey[]) if (p[k].branch === dw) { const q = quality(k); add('学堂会贵', k, `年柱纳音${yearEl}，帝旺在${BRANCHES[dw]}且为年干${STEMS[p.year.stem]}的天乙贵人${q.text}`, q.ok); }
  }
}

export type PillarKey = 'year' | 'month' | 'day' | 'hour';
/** detected 层：出现即列出；qualified 层：满足更完整的成立条件（德秀＝德、秀同见；三奇＝依序顺布）。其余神煞不区分，qualified 缺省。 */
export interface ShenShaHit { name: ShenShaName; pillar: PillarKey; basis: string; qualified?: boolean; /** qualified 的含义（不同神煞不同，界面据此措辞，避免把“同见”“顺布”说成古籍意义上的完整成立） */ qualifiedMeaning?: string }
/** qualified 字段的语义：德秀＝德、秀两类干都出现（不含原文另有的“无破冲克压”条件）；三奇＝三干在年月日或月日时连续并依序；学堂类＝未落空亡、未逢冲 */
export const QUALIFIED_MEANING: Partial<Record<ShenShaName, string>> = { 德秀贵人: '德秀同见', 三奇贵人: '依序顺布' };

interface P { stem: number; branch: number }
/** 计算命中的神煞。三合类（驿马等）分别以年支、日支为基准；天乙贵人以日干、年干为基准；羊刃、金舆以日干为基准；孤辰寡宿以年支为基准；基准柱自身也算（如日支即为华盖）。 */
export interface ShenShaOptions { wenchangMode: 'sanming' | 'common'; yinStemYangRen: boolean }
export function computeShenSha(p: Record<PillarKey, P>, gender: 'M' | 'F' = 'M', opt: ShenShaOptions = { wenchangMode: 'sanming', yinStemYangRen: false }): ShenShaHit[] {
  const out: ShenShaHit[] = [];
  const keys: PillarKey[] = ['year', 'month', 'day', 'hour'];
  const add = (name: ShenShaName, pillar: PillarKey, basis: string, qualified?: boolean) => { if (!out.some((h) => h.name === name && h.pillar === pillar && h.basis === basis)) out.push({ name, pillar, basis, ...(qualified === undefined ? {} : { qualified, qualifiedMeaning: QUALIFIED_MEANING[name] ?? '未落空亡、未逢冲' }) }); };
  const groupTables: [ShenShaName, number[]][] = [['驿马', YI_MA], ['咸池（桃花）', XIAN_CHI], ['劫煞', JIE_SHA], ['亡神', WANG_SHEN], ['将星', JIANG_XING], ['华盖', HUA_GAI]];
  for (const [base, bk] of [['年支', 'year'], ['日支', 'day']] as const) {
    const g = GROUP_OF[p[bk].branch];
    for (const [name, tab] of groupTables) for (const k of keys) if (p[k].branch === tab[g]) add(name, k, `${base}${BRANCHES[p[bk].branch]}`);
  }
  for (const [base, bk] of [['日干', 'day'], ['年干', 'year']] as const) {
    for (const k of keys) if (TIAN_YI[p[bk].stem].includes(p[k].branch)) add('天乙贵人', k, `${base}${STEMS[p[bk].stem]}`);
  }
  const dm = p.day.stem;
  for (const k of keys) {
    if (YANG_REN[dm] === p[k].branch) add('羊刃', k, `日干${STEMS[dm]}`);
    if (JIN_YU[dm] === p[k].branch) add('金舆', k, `日干${STEMS[dm]}`);
  }
  const gg = GU_GUA[p.year.branch];
  for (const k of keys) {
    if (p[k].branch === gg[0]) add('孤辰', k, `年支${BRANCHES[p.year.branch]}`);
    if (p[k].branch === gg[1]) add('寡宿', k, `年支${BRANCHES[p.year.branch]}`);
  }

  // —— 第二批（《三命通会》卷三、卷六）——
  const mg = GROUP_OF[p.month.branch];
  const yueDe = YUE_DE[mg];
  for (const k of keys) {
    if (p[k].stem === yueDe) add('月德贵人', k, `月支${BRANCHES[p.month.branch]}`);
    if (p[k].stem === (yueDe + 5) % 10) add('月德合', k, `月支${BRANCHES[p.month.branch]}`);
  }
  {
    const [de, xiu] = DE_XIU[mg];
    const both = keys.some((k) => de.includes(p[k].stem)) && keys.some((k) => xiu.includes(p[k].stem));
    for (const k of keys) {
      const st = p[k].stem;
      const tag = de.includes(st) && xiu.includes(st) ? '德兼秀' : de.includes(st) ? '德' : xiu.includes(st) ? '秀' : '';
      if (tag) add('德秀贵人', k, `月支${BRANCHES[p.month.branch]}（${STEMS[st]}为${tag}）`, both);
    }
  }
  // 元辰、勾煞、绞煞：以年支为基准；阳男阴女与阴男阳女方向相反
  const yang = p.year.stem % 2 === 0;
  const forward = (yang && gender === 'M') || (!yang && gender === 'F'); // 阳男阴女
  const yb = p.year.branch;
  const yuanChen = (yb + 6 + (forward ? 1 : -1) + 12) % 12; // 阳男阴女在冲前一位，阴男阳女在冲后一位
  const gou = (yb + (forward ? 3 : -3) + 12) % 12, jiao = (yb + (forward ? -3 : 3) + 12) % 12;
  for (const k of keys) {
    if (p[k].branch === yuanChen) add('元辰', k, `年支${BRANCHES[yb]}（${forward ? '阳男阴女' : '阴男阳女'}）`);
    if (p[k].branch === gou) add('勾煞', k, `年支${BRANCHES[yb]}（${forward ? '阳男阴女' : '阴男阳女'}）`);
    if (p[k].branch === jiao) add('绞煞', k, `年支${BRANCHES[yb]}（${forward ? '阳男阴女' : '阴男阳女'}）`);
    if (p[k].branch === (yb + 2) % 12) add('丧门', k, `年支${BRANCHES[yb]}`);
    if (p[k].branch === (yb + 10) % 12) add('吊客', k, `年支${BRANCHES[yb]}`);
  }
  for (const [base, bk] of [['年支', 'year'], ['日支', 'day']] as const) {
    const g = GROUP_OF[p[bk].branch];
    for (const k of keys) if (p[k].branch === ZAI_SHA[g]) add('灾煞', k, `${base}${BRANCHES[p[bk].branch]}`);
  }
  // 日柱类：十恶大败、魁罡、日德、日贵
  const dayName = STEMS[p.day.stem] + BRANCHES[p.day.branch];
  if (SHI_E.includes(dayName)) add('十恶大败', 'day', '日柱');
  if (KUI_GANG.includes(dayName)) add('魁罡', 'day', '日柱');
  if (RI_DE.includes(dayName)) add('日德', 'day', '日柱');
  if (RI_GUI.includes(dayName)) add('日贵', 'day', '日柱');
  // 天罗（戌亥）、地网（辰巳）：《三命通会》“男怕天罗，女怕地网”，“火命人有天罗，水、土命人有地网”；命以年柱纳音五行计。
  const brs = keys.map((k) => p[k].branch);
  const yearEl = nayinElement(jiaziIndex(p.year.stem, p.year.branch));
  if (gender === 'M' && yearEl === '火' && brs.includes(10) && brs.includes(11)) for (const k of keys) if (p[k].branch === 10 || p[k].branch === 11) add('天罗', k, '火命男，戌亥同见');
  if (gender === 'F' && (yearEl === '水' || yearEl === '土') && brs.includes(4) && brs.includes(5)) for (const k of keys) if (p[k].branch === 4 || p[k].branch === 5) add('地网', k, `${yearEl}命女，辰巳同见`);
  // 三奇：天上三奇乙丙丁、地下三奇甲戊庚、人中三奇辛壬癸；三个天干都在四柱天干中即算，依序在相邻柱上标“顺布”
  const stems = keys.map((k) => p[k].stem);
  for (const [tri, nm] of [[[1, 2, 3], '天上'], [[0, 4, 6], '地下'], [[7, 8, 9], '人中']] as [number[], string][]) {
    if (!tri.every((x) => stems.includes(x))) continue;
    const ordered = (['year', 'month', 'day', 'hour'] as PillarKey[]).some((_, i, a) => i + 2 < 4 && tri.every((x, j) => p[a[i + j]].stem === x));
    for (const k of keys) if (tri.includes(p[k].stem)) add('三奇贵人', k, `${nm}三奇（${tri.map((x) => STEMS[x]).join('')}）${ordered ? '，顺布' : '，未顺布'}`, ordered);
  }
  // —— 第三批（ADR-017）——
  // 天德、天德合：按月支；天德目标可能是天干或地支（原文十二位宫含乾坤艮巽）
  const td = TIAN_DE[p.month.branch];
  for (const k of keys) {
    if ((td.stem !== undefined && p[k].stem === td.stem) || (td.branch !== undefined && p[k].branch === td.branch)) add('天德贵人', k, `月支${BRANCHES[p.month.branch]}`);
    if ((td.stem !== undefined && p[k].stem === (td.stem + 5) % 10) || (td.branch !== undefined && p[k].branch === TIAN_DE_HE_BRANCH[td.branch])) add('天德合', k, `月支${BRANCHES[p.month.branch]}`);
  }
  // 文昌贵人、太极贵人：以年干、日干为基准，落在四柱地支
  const wc = opt.wenchangMode === 'common' ? WEN_CHANG_COMMON : WEN_CHANG_SANMING;
  for (const [base, bk] of [['日干', 'day'], ['年干', 'year']] as const) {
    for (const k of keys) {
      if (wc[p[bk].stem] === p[k].branch) add('文昌贵人', k, `${base}${STEMS[p[bk].stem]}（${opt.wenchangMode === 'common' ? '通行表' : '《三命通会》表'}）`);
      if (TAI_JI[p[bk].stem].includes(p[k].branch)) add('太极贵人', k, `${base}${STEMS[p[bk].stem]}`);
    }
  }
  // 红鸾、天喜（年支系，现代通行）：不同于《三命通会》按季节的“天喜神”
  for (const k of keys) {
    if (p[k].branch === HONG_LUAN[p.year.branch]) add('红鸾', k, `年支${BRANCHES[p.year.branch]}`);
    if (p[k].branch === (HONG_LUAN[p.year.branch] + 6) % 12) add('天喜', k, `年支${BRANCHES[p.year.branch]}`);
  }
  // 阴干羊刃（其他流派选项）：取禄后一位（乙寅、丁巳、己巳、辛申、癸亥）
  if (opt.yinStemYangRen) for (const [base, bk] of [['日干', 'day']] as const) {
    const ds = p[bk].stem;
    if (ds % 2 === 1) for (const k of keys) if ((LU[ds] + 11) % 12 === p[k].branch) add('羊刃', k, `${base}${STEMS[ds]}（阴干，另一流派）`);
  }
  addXueTang(p, keys, add);
  for (const k of keys) if (LU[p.day.stem] === p[k].branch) add('禄神', k, `日干${STEMS[p.day.stem]}`);
  return out;
}
