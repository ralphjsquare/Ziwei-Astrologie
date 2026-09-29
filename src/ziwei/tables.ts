// 紫微斗数（三合派，《紫微斗数全书》安星诀）数据表。所有取值集中在此，便于逐条与古籍核对。
// 来源标注见 docs/adr/ADR-010-ziwei-tables.md；古籍语料尚未入库，出处为书名/篇目级引用，状态 unverified。

export const RULES_VERSION = 'ziwei-sanhe-quanshu/1';

/** 紫微星系（自紫微起逆行）：星名 → 相对紫微的逆行宫数 */
export const ZIWEI_GROUP: [string, number][] = [['紫微', 0], ['天机', 1], ['太阳', 3], ['武曲', 4], ['天同', 5], ['廉贞', 8]];
/** 天府星系（自天府起顺行）：星名 → 相对天府的顺行宫数 */
export const TIANFU_GROUP: [string, number][] = [
  ['天府', 0], ['太阴', 1], ['贪狼', 2], ['巨门', 3], ['天相', 4], ['天梁', 5], ['七杀', 6], ['破军', 10],
];

export const MAJOR_ORDER = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];

/** 五行局：纳音五行 → 局数 */
export const BUREAU_BY_ELEMENT = { 水: 2, 木: 3, 金: 4, 土: 5, 火: 6 } as const;
export const BUREAU_NAME = { 2: '水二局', 3: '木三局', 4: '金四局', 5: '土五局', 6: '火六局' } as const;

/** 天魁、天钺（按年干）：[魁, 钺] 地支序号 */
export const KUI_YUE: [number, number][] = [
  [1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [1, 7], [6, 2], [3, 5], [3, 5],
]; // 甲乙丙丁戊己庚辛壬癸

/** 禄存（按年干）地支序号 */
export const LU_CUN = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0];

/** 年支三合分组：0=申子辰 1=寅午戌 2=巳酉丑 3=亥卯未 */
export const sanheGroup = (branch: number): 0 | 1 | 2 | 3 => {
  if ([8, 0, 4].includes(branch)) return 0;
  if ([2, 6, 10].includes(branch)) return 1;
  if ([5, 9, 1].includes(branch)) return 2;
  return 3;
};
/** 火星起点（子时所在宫，顺数至生时）；铃星起点 */
export const HUO_START = [2, 1, 3, 9]; // 申子辰寅 / 寅午戌丑 / 巳酉丑卯 / 亥卯未酉 → 索引按 sanheGroup: 0:寅 1:丑 2:卯 3:酉(序号 9)
export const LING_START = [10, 3, 10, 10]; // 寅午戌卯，其余戌
/** 天马（按年支三合） */
export const TIAN_MA = [2, 8, 11, 5]; // 申子辰→寅 寅午戌→申 巳酉丑→亥 亥卯未→巳

/** 四化（按年干），《全书》通行版本：[禄, 权, 科, 忌] */
export const SIHUA: [string, string, string, string][] = [
  ['廉贞', '破军', '武曲', '太阳'], // 甲
  ['天机', '天梁', '紫微', '太阴'], // 乙
  ['天同', '天机', '文昌', '廉贞'], // 丙
  ['太阴', '天同', '天机', '巨门'], // 丁
  ['贪狼', '太阴', '右弼', '天机'], // 戊
  ['武曲', '贪狼', '天梁', '文曲'], // 己
  ['太阳', '武曲', '太阴', '天同'], // 庚
  ['巨门', '太阳', '文曲', '文昌'], // 辛
  ['天梁', '紫微', '左辅', '武曲'], // 壬
  ['破军', '巨门', '太阴', '贪狼'], // 癸
];

/** 四化的其他版本（版本序号 2 起）。来源：通行软件的并存说法，均待古籍核对（ADR-010）。 */
export const SIHUA_VARIANTS: Record<'戊' | '庚' | '壬' | '癸', [string, string, string, string][]> = {
  戊: [['贪狼', '太阴', '右弼', '天机'], ['贪狼', '太阴', '太阳', '天机']],
  庚: [['太阳', '武曲', '太阴', '天同'], ['太阳', '武曲', '天同', '太阴'], ['太阳', '武曲', '天府', '天同'], ['太阳', '武曲', '天同', '天相']],
  壬: [['天梁', '紫微', '左辅', '武曲'], ['天梁', '紫微', '天府', '武曲']],
  癸: [['破军', '巨门', '太阴', '贪狼'], ['破军', '巨门', '太阳', '贪狼']],
};
export const SIHUA_STEM_NAME: Record<number, '戊' | '庚' | '壬' | '癸'> = { 4: '戊', 6: '庚', 8: '壬', 9: '癸' };

/** 按年干与所选版本取四化 [禄, 权, 科, 忌]；版本序号非法时抛错。 */
export function sihuaFor(stem: number, variants: Partial<Record<string, number>> = {}): [string, string, string, string] {
  const name = SIHUA_STEM_NAME[stem];
  if (!name) return SIHUA[stem];
  const v = variants[name] ?? 1;
  const list = SIHUA_VARIANTS[name];
  if (!Number.isInteger(v) || v < 1 || v > list.length) throw new RangeError(`sihua variant ${name}=${v} not in 1..${list.length}`);
  return list[v - 1];
}
