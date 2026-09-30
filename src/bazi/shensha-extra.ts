// 神煞第四批（ADR-019）：《三命通会》卷三“总论诸神煞”等处有明确表格的（bz.shensha.*），以及语料没有表、只有现代通行说法的（modern_shensha.*）。
// 只列出现位置，不打分。地支以子=0 计；天干以甲=0 计。
import { BRANCHES, STEMS, jiaziIndex, nayinElement } from '../core/ganzhi';

type PK = 'year' | 'month' | 'day' | 'hour';
interface P { stem: number; branch: number }
export type AddFn = (name: ExtraName, pillar: PK, basis: string, qualified?: boolean) => void;
export interface ExtraOptions { hongyanMode: 'sanming' | 'common' }

export const EXTRA_TEXT_NAMES = ['天赦日', '八专日', '九丑日', '孤鸾煞', '阴阳差错', '红艳煞', '六厄', '暗金煞', '破煞', '拱禄', '拱贵', '天福贵人', '自缢煞', '挂剑煞', '天火煞', '宅墓煞', '天屠煞', '阴阳煞', '戟锋煞', '水溺煞'] as const;
export const EXTRA_MODERN_NAMES = ['飞刃', '福星贵人', '国印贵人', '天厨贵人', '天医', '血刃', '流霞', '披麻', '金神', '童子', '十灵日', '六秀日', '四废日', '地转', '天转', '日干学堂', '日干词馆'] as const;
export type ExtraName = (typeof EXTRA_TEXT_NAMES)[number] | (typeof EXTRA_MODERN_NAMES)[number];
export const EXTRA_NAMES: ExtraName[] = [...EXTRA_TEXT_NAMES, ...EXTRA_MODERN_NAMES];

/** 三合局分组：0 申子辰，1 寅午戌，2 巳酉丑，3 亥卯未 */
const GROUP = [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3];
const SN = (c: string) => STEMS.indexOf(c as (typeof STEMS)[number]);
const B = (c: string) => BRANCHES.indexOf(c as (typeof BRANCHES)[number]);
const gz = (s: string) => jiaziIndex(SN(s[0]), B(s[1]));
const idxs = (names: string[]) => names.map(gz);
const seasonOf = (monthBranch: number) => Math.floor(((monthBranch + 10) % 12) / 3); // 0 春（寅卯辰）1 夏 2 秋 3 冬
const mod12 = (n: number) => ((n % 12) + 12) % 12;

// ——— 文本有表的 ———
const TIAN_SHE = idxs(['戊寅', '甲午', '戊申', '甲子']); // 春夏秋冬
const BA_ZHUAN = idxs(['甲寅', '乙卯', '己未', '丁未', '庚申', '辛酉', '戊戌', '癸丑']);
const JIU_CHOU = idxs(['壬子', '壬午', '戊子', '戊午', '己酉', '己卯', '乙卯', '乙酉', '辛酉', '辛卯']); // 四库本作十日（含乙酉）；维基文库转录本漏写乙酉，bazi-lite 误作丁酉
const GU_LUAN = idxs(['乙巳', '丁巳', '辛亥', '戊申', '甲寅', '丙午', '戊午', '壬子']);
const YIN_YANG_CHA_CUO = idxs(['丙子', '丁丑', '戊寅', '辛卯', '壬辰', '癸巳', '丙午', '丁未', '戊申', '辛酉', '壬戌', '癸亥']);
const HONG_YAN_SANMING = [6, 6, 2, 7, 0, 4, 10, 9, 5, 8]; // 甲乙午 丙寅 丁未 戊子 己辰 庚戌 辛酉 壬巳 癸申（原文；与通行表的戊辰、壬子不同）
const HONG_YAN_COMMON = [6, 6, 2, 7, 4, 4, 10, 9, 0, 8];
const LIU_E = [B('卯'), B('酉'), B('子'), B('午')]; // 按三合局：申子辰水死卯、寅午戌火死酉、巳酉丑金死子、亥卯未木死午
const AN_JIN: Record<number, number> = (() => {
  const t: Record<number, number> = {};
  for (const c of '子午卯酉') t[B(c)] = B('巳'); // 四仲
  for (const c of '寅申巳亥') t[B(c)] = B('酉'); // 四孟
  for (const c of '辰戌丑未') t[B(c)] = B('丑'); // 四季
  return t;
})();
const PO_PAIRS: [number, number][] = [[B('卯'), B('午')], [B('丑'), B('辰')], [B('子'), B('酉')], [B('未'), B('戌')]];
const GONG_LU: [number, number, number, string][] = [ // [日时同干, 支甲, 支乙, 所拱]
  [SN('癸'), B('亥'), B('丑'), '子'], [SN('丁'), B('巳'), B('未'), '午'], [SN('己'), B('未'), B('巳'), '午'], [SN('戊'), B('辰'), B('午'), '巳']];
const GONG_GUI: [number, number, number, string][] = [
  [SN('甲'), B('申'), B('戌'), '酉'], [SN('乙'), B('未'), B('酉'), '申'], [SN('甲'), B('寅'), B('子'), '丑'], [SN('戊'), B('申'), B('午'), '未'], [SN('辛'), B('丑'), B('卯'), '寅']];
/** 天福贵人：官星坐禄（甲人见酉、乙人见申，其余据“之例”反推）：甲酉 乙申 丙子 丁亥 戊卯 己寅 庚午 辛巳 壬午 癸巳 */
const TIAN_FU = [9, 8, 0, 11, 3, 2, 6, 5, 6, 5];
const ZI_YI_MAP: Record<number, number> = { 10: 5, 5: 10, 4: 11, 11: 4, 2: 7, 7: 2, 3: 8, 8: 3, 6: 1, 1: 6, 0: 9, 9: 0 };
const TIAN_TU: Record<number, number> = { 1: 11, 11: 1, 2: 10, 10: 2, 3: 9, 9: 3, 4: 8, 8: 4, 5: 7, 7: 5 };
const JI_FENG: number[] = [0, 1, 4, 2, 3, 5, 6, 7, 4, 8, 9, 5]; // 按月序（寅=正月…）→ 天干：正甲 二乙 三戊 四丙 五丁 六己 七庚 八辛 九戊 十壬 十一癸 十二己；数组下标为“月序-1”

// ——— 现代通行（bazi-lite 等实现）———
const FEI_REN = [9, 8, 0, 11, 0, 11, 3, 2, 6, 5];
const FU_XING: number[][] = [[2, 0], [3, 1], [2, 0], [11], [8], [7], [6], [5], [4], [3, 1]];
const GUO_YIN = [10, 11, 1, 2, 1, 2, 4, 5, 7, 8];
const TIAN_CHU = [5, 6, 5, 6, 8, 9, 11, 0, 2, 3];
const XUE_REN = [6, 0, 1, 7, 2, 8, 3, 9, 4, 10, 5, 11];
const LIU_XIA = [9, 10, 7, 8, 5, 6, 4, 3, 11, 2];
const SHI_LING = [40, 11, 52, 33, 54, 46, 26, 47, 38, 19];
const LIU_XIU = [42, 43, 24, 54, 25, 55];
const SI_FEI = [[56, 57], [48, 59], [50, 51], [42, 53]];
const DI_ZHUAN = [27, 54, 9, 12];
const TIAN_ZHUAN = [51, 42, 57, 48];
const RI_GAN_XUE_TANG = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3];
const LU = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0];

export function addExtra(p: Record<PK, P>, gender: 'M' | 'F', opt: ExtraOptions, add: AddFn): void {
  const keys: PK[] = ['year', 'month', 'day', 'hour'];
  const jz = (k: PK) => jiaziIndex(p[k].stem, p[k].branch);
  const dayIdx = jz('day');
  const season = seasonOf(p.month.branch);
  const dm = p.day.stem;
  // 天赦日、八专日、九丑日、孤鸾煞、阴阳差错：只看日柱
  if (dayIdx === TIAN_SHE[season]) add('天赦日', 'day', `${['春', '夏', '秋', '冬'][season]}季`);
  if (BA_ZHUAN.includes(dayIdx)) add('八专日', 'day', '日柱');
  if (JIU_CHOU.includes(dayIdx)) add('九丑日', 'day', '日柱');
  if (GU_LUAN.includes(dayIdx)) add('孤鸾煞', 'day', '日柱');
  if (YIN_YANG_CHA_CUO.includes(dayIdx)) add('阴阳差错', 'day', '日柱');
  // 红艳煞（日干）
  const hy = opt.hongyanMode === 'common' ? HONG_YAN_COMMON : HONG_YAN_SANMING;
  for (const k of keys) if (p[k].branch === hy[dm]) add('红艳煞', k, `日干${STEMS[dm]}（${opt.hongyanMode === 'common' ? '通行表' : '《三命通会》原文表'}）`);
  // 六厄、暗金煞（年支、日支）
  for (const [base, bk] of [['年支', 'year'], ['日支', 'day']] as const) {
    const b = p[bk].branch;
    for (const k of keys) {
      if (p[k].branch === LIU_E[GROUP[b]]) add('六厄', k, `${base}${BRANCHES[b]}`);
      if (p[k].branch === AN_JIN[b]) add('暗金煞', k, `${base}${BRANCHES[b]}`);
    }
  }
  // 破煞：任意两柱地支相破（卯午、丑辰、子酉、未戌）
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const a = p[keys[i]].branch, c = p[keys[j]].branch;
    if (PO_PAIRS.some(([x, y]) => (a === x && c === y) || (a === y && c === x))) { add('破煞', keys[i], `与${['年', '月', '日', '时'][j]}柱${BRANCHES[c]}相破`); add('破煞', keys[j], `与${['年', '月', '日', '时'][i]}柱${BRANCHES[a]}相破`); }
  }
  // 拱禄、拱贵：日时同干，日时地支夹住所拱之支
  if (p.day.stem === p.hour.stem && p.day.branch !== p.hour.branch) {
    for (const [st, x, y, target] of GONG_LU) if (p.day.stem === st && ((p.day.branch === x && p.hour.branch === y) || (p.day.branch === y && p.hour.branch === x))) { add('拱禄', 'day', `日时同干${STEMS[st]}，拱${target}禄`); add('拱禄', 'hour', `日时同干${STEMS[st]}，拱${target}禄`); }
    for (const [st, x, y, target] of GONG_GUI) if (p.day.stem === st && ((p.day.branch === x && p.hour.branch === y) || (p.day.branch === y && p.hour.branch === x))) { add('拱贵', 'day', `日时同干${STEMS[st]}，拱${target}贵`); add('拱贵', 'hour', `日时同干${STEMS[st]}，拱${target}贵`); }
  }
  // 天福贵人（官星坐禄，据例子反推）：日干、年干
  for (const [base, bk] of [['日干', 'day'], ['年干', 'year']] as const) for (const k of keys) if (p[k].branch === TIAN_FU[p[bk].stem]) add('天福贵人', k, `${base}${STEMS[p[bk].stem]}（官星之禄在${BRANCHES[TIAN_FU[p[bk].stem]]}）`);
  // 自缢煞（年支）
  for (const k of keys) if (p[k].branch === ZI_YI_MAP[p.year.branch]) add('自缢煞', k, `年支${BRANCHES[p.year.branch]}`);
  // 挂剑煞：四柱地支都在巳酉丑申
  if (keys.every((k) => [B('巳'), B('酉'), B('丑'), B('申')].includes(p[k].branch))) for (const k of keys) add('挂剑煞', k, '四柱地支全在巳酉丑申');
  // 天火煞：寅午戌三支俱全，天干有丙丁而不见壬癸
  {
    const brs = keys.map((k) => p[k].branch), sts = keys.map((k) => p[k].stem);
    if ([B('寅'), B('午'), B('戌')].every((x) => brs.includes(x)) && (sts.includes(SN('丙')) || sts.includes(SN('丁'))) && !sts.includes(SN('壬')) && !sts.includes(SN('癸'))) for (const k of keys) if ([B('寅'), B('午'), B('戌')].includes(p[k].branch)) add('天火煞', k, '寅午戌全，天干见丙丁而不见壬癸');
  }
  // 宅墓煞（年支）：前五辰为灾（宅），后五辰为墓
  for (const k of keys) {
    if (p[k].branch === mod12(p.year.branch + 5)) add('宅墓煞', k, `年支${BRANCHES[p.year.branch]}之前五辰（宅）`);
    if (p[k].branch === mod12(p.year.branch - 5)) add('宅墓煞', k, `年支${BRANCHES[p.year.branch]}之后五辰（墓）`);
  }
  // 天屠煞：日支与时支成对
  if (TIAN_TU[p.day.branch] === p.hour.branch) { add('天屠煞', 'day', `日支${BRANCHES[p.day.branch]}配时支${BRANCHES[p.hour.branch]}`); add('天屠煞', 'hour', `日支${BRANCHES[p.day.branch]}配时支${BRANCHES[p.hour.branch]}`); }
  // 阴阳煞：男得丙子（正阴）、女得戊午（正阳）为和畅；反之为“男得戊午、女得丙子”
  {
    const d = STEMS[p.day.stem] + BRANCHES[p.day.branch];
    if (gender === 'M' && d === '丙子') add('阴阳煞', 'day', '男得丙子（正阴）');
    if (gender === 'F' && d === '戊午') add('阴阳煞', 'day', '女得戊午（正阳）');
    if (gender === 'M' && d === '戊午') add('阴阳煞', 'day', '男得戊午（与所喜相反）');
    if (gender === 'F' && d === '丙子') add('阴阳煞', 'day', '女得丙子（与所喜相反）');
  }
  // 戟锋煞：月令旺干，日、时两重者成立
  {
    const mo = mod12(p.month.branch - 2); // 寅=0 → 正月
    const st = JI_FENG[mo];
    const d = p.day.stem === st, h = p.hour.stem === st;
    if (d || h) for (const [k, hit] of [['day', d], ['hour', h]] as const) if (hit) add('戟锋煞', k, `${STEMS[st]}为本月旺干；日时${d && h ? '两重' : '仅一重'}`, d && h);
  }
  // 水溺煞：丙子、癸未、癸丑上带咸池或羊刃
  {
    const YR: Record<number, number> = { 0: 3, 2: 6, 4: 6, 6: 9, 8: 0 };
    const XC = [9, 3, 6, 0];
    for (const k of keys) {
      const g = STEMS[p[k].stem] + BRANCHES[p[k].branch];
      if (!['丙子', '癸未', '癸丑'].includes(g)) continue;
      const xian = [p.year.branch, p.day.branch].some((b) => XC[GROUP[b]] === p[k].branch);
      const ren = YR[p.day.stem] === p[k].branch;
      if (xian || ren) add('水溺煞', k, `${g}带${xian ? '咸池' : ''}${xian && ren ? '、' : ''}${ren ? '羊刃' : ''}`);
    }
  }

  // ——— 现代通行整理 ———
  for (const k of keys) {
    if (p[k].branch === FEI_REN[dm]) add('飞刃', k, `日干${STEMS[dm]}`);
    if (p[k].branch === mod12(p.month.branch - 1)) add('天医', k, `月支${BRANCHES[p.month.branch]}`);
    if (p[k].branch === XUE_REN[p.month.branch]) add('血刃', k, `月支${BRANCHES[p.month.branch]}`);
    if (p[k].branch === LIU_XIA[dm]) add('流霞', k, `日干${STEMS[dm]}`);
    if (p[k].branch === mod12(p.year.branch + 9)) add('披麻', k, `年支${BRANCHES[p.year.branch]}`);
    if (p[k].branch === RI_GAN_XUE_TANG[dm]) add('日干学堂', k, `日干${STEMS[dm]}`);
    if (p[k].branch === LU[dm]) add('日干词馆', k, `日干${STEMS[dm]}`);
  }
  for (const [base, bk] of [['年干', 'year'], ['日干', 'day']] as const) for (const k of keys) {
    const s = p[bk].stem;
    if (FU_XING[s].includes(p[k].branch)) add('福星贵人', k, `${base}${STEMS[s]}`);
    if (GUO_YIN[s] === p[k].branch) add('国印贵人', k, `${base}${STEMS[s]}`);
    if (TIAN_CHU[s] === p[k].branch) add('天厨贵人', k, `${base}${STEMS[s]}`);
  }
  if ((dm === 0 || dm === 5) && ['乙丑', '己巳', '癸酉'].includes(STEMS[p.hour.stem] + BRANCHES[p.hour.branch])) add('金神', 'hour', `日干${STEMS[dm]}见时柱${STEMS[p.hour.stem]}${BRANCHES[p.hour.branch]}`);
  if (SHI_LING.includes(dayIdx)) add('十灵日', 'day', '日柱');
  if (LIU_XIU.includes(dayIdx)) add('六秀日', 'day', '日柱');
  if (SI_FEI[season].includes(dayIdx)) add('四废日', 'day', `${['春', '夏', '秋', '冬'][season]}季`);
  for (const k of keys) {
    if (jz(k) === DI_ZHUAN[season]) add('地转', k, `${['春', '夏', '秋', '冬'][season]}季`);
    if (jz(k) === TIAN_ZHUAN[season]) add('天转', k, `${['春', '夏', '秋', '冬'][season]}季`);
  }
  // 童子：日柱、时柱地支，按季节或年柱纳音
  {
    const ye = nayinElement(jz('year'));
    for (const k of ['day', 'hour'] as PK[]) {
      const b = p[k].branch;
      const bySeason = ((season === 0 || season === 2) && (b === B('寅') || b === B('子'))) || ((season === 1 || season === 3) && (b === B('卯') || b === B('未') || b === B('辰')));
      const byNayin = ((ye === '金' || ye === '木') && (b === B('午') || b === B('卯'))) || ((ye === '水' || ye === '火') && (b === B('酉') || b === B('戌'))) || (ye === '土' && (b === B('辰') || b === B('巳')));
      if (bySeason || byNayin) add('童子', k, `${bySeason ? '按季节' : ''}${bySeason && byNayin ? '、' : ''}${byNayin ? `按年柱纳音${ye}` : ''}`);
    }
  }
}
