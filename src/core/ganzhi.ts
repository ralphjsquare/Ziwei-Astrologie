// 干支、五行、纳音等基础常量与纯函数。引擎内禁止环境依赖（见 tools/check-purity.ts）。
export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
export type Element = '木' | '火' | '土' | '金' | '水';

export const mod = (a: number, n: number): number => ((a % n) + n) % n;

export const STEM_ELEMENT: Element[] = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
export const BRANCH_ELEMENT: Element[] = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水'];
/** 天干阴阳：甲丙戊庚壬为阳 */
export const stemIsYang = (s: number): boolean => s % 2 === 0;
export const branchIsYang = (b: number): boolean => b % 2 === 0;

/** 六十甲子序号(0..59) → [干, 支] 序号 */
export const jiaziParts = (i: number): [number, number] => [mod(i, 10), mod(i, 12)];
/** [干, 支] → 六十甲子序号；干支阴阳不同则无对应，返回 -1 */
export const jiaziIndex = (stem: number, branch: number): number => {
  for (let k = 0; k < 6; k++) {
    const i = stem + 10 * k;
    if (i % 12 === branch) return i;
  }
  return -1;
};
export const jiaziName = (i: number): string => STEMS[mod(i, 10)] + BRANCHES[mod(i, 12)];

/** 纳音五行：六十甲子每两位一组，共 30 组（海中金、炉中火……） */
export const NAYIN_NAMES = [
  '海中金', '炉中火', '大林木', '路旁土', '剑锋金', '山头火', '涧下水', '城头土', '白蜡金', '杨柳木',
  '泉中水', '屋上土', '霹雳火', '松柏木', '长流水', '沙中金', '山下火', '平地木', '壁上土', '金箔金',
  '覆灯火', '天河水', '大驿土', '钗钏金', '桑柘木', '大溪水', '沙中土', '天上火', '石榴木', '大海水',
] as const;
export const nayinName = (jiazi: number): string => NAYIN_NAMES[Math.floor(mod(jiazi, 60) / 2)];
export const nayinElement = (jiazi: number): Element => nayinName(jiazi).slice(-1) as Element;

/** 五行生克 */
export const GENERATES: Record<Element, Element> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
export const CONTROLS: Record<Element, Element> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

/** 五虎遁：某年干对应的寅月(正月)天干序号 */
export const yinMonthStem = (yearStem: number): number => ((yearStem % 5) * 2 + 2) % 10;
/** 五鼠遁：某日干对应的子时天干序号 */
export const ziHourStem = (dayStem: number): number => ((dayStem % 5) * 2) % 10;
