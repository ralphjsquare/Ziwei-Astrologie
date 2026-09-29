// 神煞（v1.1 选取十一种，表格均来自《三命通会》卷二、卷三、卷六的文字；只列出“出现在哪一柱”，不打分）。
// 三合局分组：申子辰、寅午戌、巳酉丑、亥卯未。地支以子=0 计。
import { BRANCHES, STEMS } from '../core/ganzhi';

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

export type ShenShaName = '天乙贵人' | '驿马' | '咸池（桃花）' | '劫煞' | '亡神' | '将星' | '华盖' | '羊刃' | '金舆' | '孤辰' | '寡宿';
export const SHENSHA_NAMES: ShenShaName[] = ['天乙贵人', '驿马', '咸池（桃花）', '劫煞', '亡神', '将星', '华盖', '羊刃', '金舆', '孤辰', '寡宿'];
export type PillarKey = 'year' | 'month' | 'day' | 'hour';
export interface ShenShaHit { name: ShenShaName; pillar: PillarKey; basis: string }

interface P { stem: number; branch: number }
/** 计算命中的神煞。三合类（驿马等）分别以年支、日支为基准；天乙贵人以日干、年干为基准；羊刃、金舆以日干为基准；孤辰寡宿以年支为基准；基准柱自身也算（如日支即为华盖）。 */
export function computeShenSha(p: Record<PillarKey, P>): ShenShaHit[] {
  const out: ShenShaHit[] = [];
  const keys: PillarKey[] = ['year', 'month', 'day', 'hour'];
  const add = (name: ShenShaName, pillar: PillarKey, basis: string) => { if (!out.some((h) => h.name === name && h.pillar === pillar && h.basis === basis)) out.push({ name, pillar, basis }); };
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
  return out;
}
