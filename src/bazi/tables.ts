// 八字（子平法）数据表。出处为书名/篇目级引用，状态 unverified（见 docs/adr/ADR-011-bazi-tables.md）。
export const RULES_VERSION = 'bazi-ziping/1';

/** 地支藏干（本气、中气、余气），子=0 */
export const HIDDEN_STEMS: number[][] = [
  [9], [5, 9, 7], [0, 2, 4], [1], [4, 1, 9], [2, 6, 4], [3, 5], [5, 3, 1], [6, 8, 4], [7], [4, 7, 3], [8, 0],
];
export const HIDDEN_ROLE = ['本气', '中气', '余气'] as const;

export const TEN_GODS = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'] as const;
export type TenGod = (typeof TEN_GODS)[number];

export const LONG_SHENG = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'] as const;
/** 各天干"长生"所在地支（火土同宫的通行版本；戊寅、己酉） */
export const LONG_SHENG_START = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3];

/** 节令 → 月支已在历法层；天干五合 [干a, 干b, 化气] */
export const STEM_COMBINE: [number, number, string][] = [[0, 5, '土'], [1, 6, '金'], [2, 7, '水'], [3, 8, '木'], [4, 9, '火']];
export const STEM_CLASH: [number, number][] = [[0, 6], [1, 7], [2, 8], [3, 9]];

export const BRANCH_SIX_COMBINE: [number, number, string | null][] = [
  [0, 1, '土'], [2, 11, '木'], [3, 10, '火'], [4, 9, '金'], [5, 8, '水'], [6, 7, null],
];
export const BRANCH_CLASH: [number, number][] = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];
export const BRANCH_HARM: [number, number][] = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]];
export const PUNISH_GROUPS: { name: string; branches: number[] }[] = [
  { name: '无恩之刑', branches: [2, 5, 8] },
  { name: '恃势之刑', branches: [1, 10, 7] },
];
export const PUNISH_PAIR: [number, number, string][] = [[0, 3, '无礼之刑']];
export const SELF_PUNISH = [4, 6, 9, 11];
export const THREE_COMBINE: { branches: number[]; element: string }[] = [
  { branches: [8, 0, 4], element: '水' }, { branches: [2, 6, 10], element: '火' },
  { branches: [5, 9, 1], element: '金' }, { branches: [11, 3, 7], element: '木' },
];
export const HALF_COMBINE: { pair: [number, number]; element: string }[] = [
  { pair: [8, 0], element: '水' }, { pair: [0, 4], element: '水' }, { pair: [2, 6], element: '火' }, { pair: [6, 10], element: '火' },
  { pair: [5, 9], element: '金' }, { pair: [9, 1], element: '金' }, { pair: [11, 3], element: '木' }, { pair: [3, 7], element: '木' },
];
export const THREE_MEET: { branches: number[]; element: string }[] = [
  { branches: [2, 3, 4], element: '木' }, { branches: [5, 6, 7], element: '火' },
  { branches: [8, 9, 10], element: '金' }, { branches: [11, 0, 1], element: '水' },
];
