export type PalaceName = '命宫' | '兄弟' | '夫妻' | '子女' | '财帛' | '疾厄' | '迁移' | '交友' | '官禄' | '田宅' | '福德' | '父母';
export const PALACE_NAMES: PalaceName[] = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '交友', '官禄', '田宅', '福德', '父母'];

export type Transform = '禄' | '权' | '科' | '忌';

import type { Brightness } from './brightness.generated';
export type { Brightness };
export interface StarPlacement { name: string; kind: 'major' | 'aux' | 'sha' | 'other'; transform?: Transform; /** 《全书》卷二诸星庙旺利陷表；表中没有该星在该宫的记载则缺省 */ brightness?: Brightness }

export interface Palace {
  branch: number; // 地支序号，子=0
  stem: number;
  name: PalaceName;
  stars: StarPlacement[];
  isBody: boolean; // 身宫所在
  decade: { startAge: number; endAge: number }; // 大限（虚岁）
}

export interface ZiweiStep { id: string; text: string }

export interface ZiweiChart {
  schema: 'ziwei-chart/1';
  school: 'sanhe';
  input: {
    lunarYear: number; lunarMonth: number; lunarLeap: boolean; lunarDay: number;
    effectiveMonth: number; // 闰月规则处理后用于起命宫的月份
    hourBranch: number; gender: 'M' | 'F';
  };
  yearStem: number; yearBranch: number;
  fiveElementBureau: { name: string; number: 2 | 3 | 4 | 5 | 6; nayin: string };
  mingBranch: number; bodyBranch: number;
  /** 命主（按命宫地支）、身主（按出生年支），据《全书》安命主、安身主诀 */
  mingZhu: string; shenZhu: string;
  ziweiBranch: number; tianfuBranch: number;
  palaces: Palace[]; // 按地支 0..11 排列
  fourTransforms: { stem: number; lu: string; quan: string; ke: string; ji: string };
  decadeDirection: 1 | -1;
  /** 本盘采用的版本选项（流年四化等后续计算沿用） */
  variants: { kuiYueXin: 'hu-ma' | 'ma-hu'; sihua: Partial<Record<string, number>>; leapMonthRule: 'midMonth' | 'currentMonth' | 'nextMonth' };
  steps: ZiweiStep[];
  rulesVersion: string;
}
