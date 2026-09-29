import { BRANCHES, STEMS, jiaziIndex, mod, nayinElement, nayinName, stemIsYang, yinMonthStem } from '../core/ganzhi';
import type { BirthInput, Options } from '../core/types';
import type { ResolvedBirth } from '../calendar/resolve';
import {
  BUREAU_BY_ELEMENT, BUREAU_NAME, HUO_START, KUI_YUE, LING_START, LU_CUN, MAJOR_ORDER, RULES_VERSION, SIHUA,
  TIANFU_GROUP, TIAN_MA, ZIWEI_GROUP, sanheGroup,
} from './tables';
import { PALACE_NAMES, type Palace, type StarPlacement, type Transform, type ZiweiChart, type ZiweiStep } from './types';

const YIN = 2;

/** 紫微星位置（商余法）：局数 n，农历日 d */
export function ziweiPosition(bureau: number, day: number): number {
  let x = 0;
  while ((day + x) % bureau !== 0) x++;
  const q = (day + x) / bureau;
  const p = YIN + q - 1;
  return mod(x % 2 === 0 ? p + x : p - x, 12);
}
export const tianfuPosition = (ziwei: number): number => mod(4 - ziwei, 12);

export function effectiveLunarMonth(month: number, leap: boolean, day: number, rule: Options['leapMonthRule']): number {
  if (!leap) return month;
  if (rule === 'currentMonth') return month;
  if (rule === 'nextMonth') return mod(month, 12) + 1;
  return day <= 15 ? month : mod(month, 12) + 1; // midMonth：十五日前算本月，十六日起算下月
}

const KIND: Record<string, StarPlacement['kind']> = {};
for (const s of MAJOR_ORDER) KIND[s] = 'major';
for (const s of ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺']) KIND[s] = 'aux';
for (const s of ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫']) KIND[s] = 'sha';
for (const s of ['禄存', '天马', '红鸾', '天喜']) KIND[s] = 'other';
export const STAR_ORDER = [...MAJOR_ORDER, '左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存', '擎羊', '陀罗', '火星', '铃星', '地空', '地劫', '天马', '红鸾', '天喜'];

export function buildZiwei(_input: BirthInput, r: ResolvedBirth, opt: Options, gender: 'M' | 'F'): ZiweiChart {
  const L = r.ziweiLunar;
  const steps: ZiweiStep[] = [];
  const yearIdx = mod(L.year - 4, 60);
  const yearStem = yearIdx % 10, yearBranch = yearIdx % 12;
  steps.push({ id: 'year', text: `农历${L.year}年（以农历正月初一换年）= ${STEMS[yearStem]}${BRANCHES[yearBranch]}年` });

  const em = effectiveLunarMonth(L.month, L.leap, L.day, opt.leapMonthRule);
  if (L.leap) steps.push({ id: 'leap', text: `闰${L.month}月，规则=${opt.leapMonthRule}，起命宫月份取${em}月` });
  const h = r.shichen;

  const ming = mod(YIN + (em - 1) - h, 12);
  const body = mod(YIN + (em - 1) + h, 12);
  steps.push({ id: 'ming', text: `命宫：寅宫起正月顺数至${em}月，再由此起子时逆数至${BRANCHES[h]}时，落${BRANCHES[ming]}宫` });
  steps.push({ id: 'body', text: `身宫：同月位起子时顺数至${BRANCHES[h]}时，落${BRANCHES[body]}宫` });

  const stemOf = (b: number) => (yinMonthStem(yearStem) + mod(b - YIN, 12)) % 10;
  steps.push({ id: 'palace-stem', text: `五虎遁：${STEMS[yearStem]}年寅宫起${STEMS[yinMonthStem(yearStem)]}` });

  const mingJz = jiaziIndex(stemOf(ming), ming);
  const el = nayinElement(mingJz);
  const bureau = BUREAU_BY_ELEMENT[el];
  steps.push({ id: 'bureau', text: `命宫干支${STEMS[stemOf(ming)]}${BRANCHES[ming]}纳音${nayinName(mingJz)}，为${BUREAU_NAME[bureau]}` });

  const zw = ziweiPosition(bureau, L.day);
  const tf = tianfuPosition(zw);
  steps.push({ id: 'ziwei', text: `紫微星：${BUREAU_NAME[bureau]}农历${L.day}日，落${BRANCHES[zw]}宫；天府与紫微对称于寅申轴，落${BRANCHES[tf]}宫` });

  const at: Record<string, number> = {};
  for (const [n, o] of ZIWEI_GROUP) at[n] = mod(zw - o, 12);
  for (const [n, o] of TIANFU_GROUP) at[n] = mod(tf + o, 12);

  at['左辅'] = mod(4 + (em - 1), 12);
  at['右弼'] = mod(10 - (em - 1), 12);
  at['文昌'] = mod(10 - h, 12);
  at['文曲'] = mod(4 + h, 12);
  at['天魁'] = KUI_YUE[yearStem][0];
  at['天钺'] = KUI_YUE[yearStem][1];
  at['禄存'] = LU_CUN[yearStem];
  at['擎羊'] = mod(LU_CUN[yearStem] + 1, 12);
  at['陀罗'] = mod(LU_CUN[yearStem] - 1, 12);
  const g = sanheGroup(yearBranch);
  at['火星'] = mod(HUO_START[g] + h, 12);
  at['铃星'] = mod(LING_START[g] + h, 12);
  at['地劫'] = mod(11 + h, 12);
  at['地空'] = mod(11 - h, 12);
  at['天马'] = TIAN_MA[g];
  at['红鸾'] = mod(3 - yearBranch, 12);
  at['天喜'] = mod(at['红鸾'] + 6, 12);
  steps.push({ id: 'aux', text: '辅佐煞曜按《全书》安星诀依月、时、年干支排布' });

  const [lu, quan, ke, ji] = SIHUA[yearStem];
  const tmap: Record<string, Transform> = { [lu]: '禄', [quan]: '权', [ke]: '科', [ji]: '忌' };
  steps.push({ id: 'sihua', text: `${STEMS[yearStem]}年四化：${lu}化禄、${quan}化权、${ke}化科、${ji}化忌` });

  const yang = stemIsYang(yearStem);
  const dir: 1 | -1 = (yang && gender === 'M') || (!yang && gender === 'F') ? 1 : -1;
  steps.push({ id: 'decade', text: `${yang ? '阳' : '阴'}${gender === 'M' ? '男' : '女'}，大限${dir === 1 ? '顺' : '逆'}行，${BUREAU_NAME[bureau]}${bureau}岁起限` });

  const palaces: Palace[] = [];
  for (let b = 0; b < 12; b++) {
    const k = mod(ming - b, 12); // 该地支宫是第 k 个宫（命宫=0），宫序逆地支排列
    const stars: StarPlacement[] = [];
    for (const name of STAR_ORDER) if (at[name] === b) stars.push({ name, kind: KIND[name], ...(tmap[name] ? { transform: tmap[name] } : {}) });
    const j = mod((b - ming) * dir, 12); // 大限序号
    palaces.push({
      branch: b, stem: stemOf(b), name: PALACE_NAMES[k], stars, isBody: b === body,
      decade: { startAge: bureau + 10 * j, endAge: bureau + 10 * j + 9 },
    });
  }

  return {
    schema: 'ziwei-chart/1', school: 'sanhe',
    input: { lunarYear: L.year, lunarMonth: L.month, lunarLeap: L.leap, lunarDay: L.day, effectiveMonth: em, hourBranch: h, gender },
    yearStem, yearBranch,
    fiveElementBureau: { name: BUREAU_NAME[bureau], number: bureau as 2 | 3 | 4 | 5 | 6, nayin: nayinName(mingJz) },
    mingBranch: ming, bodyBranch: body, ziweiBranch: zw, tianfuBranch: tf,
    palaces, fourTransforms: { stem: yearStem, lu, quan, ke, ji }, decadeDirection: dir, steps, rulesVersion: RULES_VERSION,
  };
}
