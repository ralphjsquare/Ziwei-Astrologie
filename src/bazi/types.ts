import type { TenGod } from './tables';

export interface HiddenStem { stem: number; role: '本气' | '中气' | '余气'; tenGod: TenGod }
export interface Pillar {
  stem: number; branch: number; jiazi: number; nayin: string;
  stemTenGod: TenGod | null; // 日柱天干为日主，记 null
  hidden: HiddenStem[];
  longSheng: string; // 日主在该地支的十二长生
}
export interface Relation { type: string; members: { pos: string; char: string }[]; element?: string }

export interface LuckCycle {
  index: number; stem: number; branch: number; jiazi: number; nayin: string;
  startAge: number; endAge: number; startYear: number; stemTenGod: TenGod;
}

export interface StrengthEvidence {
  method: 'ziping-basic/1';
  deLing: boolean; // 得令：月令本气与日主同五行或生日主
  support: number; drain: number; ratio: number;
  candidate: '偏强' | '中和' | '偏弱';
  counts: Record<string, number>; // 十神类别得分
}
export interface PatternCandidate { key: string; name: string; basis: string; hiddenStem?: number; revealed?: boolean }
export interface YongshenCandidate { method: string; elements: string[]; note: string }

export interface BaziChart {
  schema: 'bazi-chart/1';
  school: 'ziping';
  gender: 'M' | 'F';
  pillars: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar };
  dayMaster: { stem: number; element: string; yang: boolean };
  kongWang: number[]; // 日柱旬空地支
  boundaries: { yearStartName: '立春'; yearStartEpochSec: number; monthJie: string; monthStartEpochSec: number; nextJieEpochSec: number; prevJieEpochSec: number };
  luck: {
    direction: 1 | -1;
    start: { years: number; months: number; days: number; hours: number };
    startDate: { y: number; m: number; d: number };
    referenceJie: string; diffMinutes: number;
    cycles: LuckCycle[];
  };
  relations: Relation[];
  strength: StrengthEvidence;
  patterns: PatternCandidate[];
  yongshen: YongshenCandidate[];
  steps: { id: string; text: string }[];
  rulesVersion: string;
}
