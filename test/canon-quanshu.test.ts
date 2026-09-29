// 以《紫微斗数全书》原文（维基文库转录本，docs/sources/raw/zwqs/）为独立预言，核对本项目的安星表。
// 这是“预言不来自本引擎”的一手依据（ADR-006 L2）。转录本底本未标明，个别字疑为转录错误，已逐条标注。
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BRANCHES, STEMS, jiaziIndex, nayinName, yinMonthStem } from '../src/core/ganzhi';
import { HUO_START, KUI_YUE, LING_START, LU_CUN, SIHUA, SIHUA_VARIANTS, TIAN_MA, sanheGroup } from '../src/ziwei/tables';
import { ziweiPosition } from '../src/ziwei/engine';
import { computeCharts } from '../src/index';
import { solarInput } from './helpers';

const RAW = readFileSync('docs/sources/raw/zwqs/003-紫微斗數全書_卷二.wikitext', 'utf8');
const B = (c: string) => BRANCHES.indexOf(c as (typeof BRANCHES)[number]);
const S = (c: string) => STEMS.indexOf(c as (typeof STEMS)[number]);
const line = (re: RegExp) => { const m = re.exec(RAW); if (!m) throw new Error('原文未找到：' + re); return m[0]; };

describe('《紫微斗数全书》卷二原文 × 本项目安星表', () => {
  it('起五行寅例（五虎遁）', () => {
    const t = line(/甲己之岁起丙寅[^\n]+/);
    for (const [pair, stem] of [['甲己', '丙'], ['乙庚', '戊'], ['丙辛', '庚'], ['丁壬', '壬'], ['戊癸', '甲']]) {
      expect(t).toContain(`${pair[0]}${pair[1]}之岁起${stem}寅`);
      for (const y of pair) expect(yinMonthStem(S(y))).toBe(S(stem));
    }
  });

  it('六十花甲子纳音歌：30 个纳音名与本项目一致（转录本异体字“剑峰”“桑拓”已归一）', () => {
    const block = /六十花甲子纳音歌[\s\S]*?<\/poem>/.exec(RAW)![0].replace('剑峰', '剑锋').replace('桑拓', '桑柘');
    for (let k = 0; k < 30; k++) expect(block, nayinName(k * 2)).toContain(nayinName(k * 2));
    // 同时核对干支与纳音的对应（每名前的两个干支字之一为该组第一个干支）
    expect(nayinName(jiaziIndex(S('甲'), B('子')))).toBe('海中金');
    expect(nayinName(jiaziIndex(S('戊'), B('子')))).toBe('霹雳火');
    expect(nayinName(jiaziIndex(S('壬'), B('戌')))).toBe('大海水');
  });

  it('安南北斗诸星诀：紫微系“逆行，隔一，隔二，空三”，天府系“顺数，七杀空三破军”', () => {
    line(/紫微天机逆行旁，隔一阳武天同当，又隔二位廉贞地，空三复见紫微郎/);
    line(/天府太阴与贪狼，巨门天相及天梁，七杀空三破军位，八星顺数细推详/);
    const c = computeCharts(solarInput(1990, 6, 15, 10, 30)).ziwei;
    const at = (n: string) => c.palaces.find((p) => p.stars.some((s) => s.name === n))!.branch;
    const z = at('紫微');
    // 逆行：天机 -1；隔一 → 太阳 -3；武曲 -4；天同 -5；隔二 → 廉贞 -8；空三 → 回到紫微（-12）
    expect([at('天机'), at('太阳'), at('武曲'), at('天同'), at('廉贞')]).toEqual([1, 3, 4, 5, 8].map((k) => (z - k + 12) % 12));
    const f = at('天府');
    // 顺数：太阴 +1，贪狼 +2，巨门 +3，天相 +4，天梁 +5，七杀 +6，空三 → 破军 +10
    expect([at('太阴'), at('贪狼'), at('巨门'), at('天相'), at('天梁'), at('七杀'), at('破军')]).toEqual([1, 2, 3, 4, 5, 6, 10].map((k) => (f + k) % 12));
  });

  it('安四化诀（“甲廉破武阳为伴……”）：除壬年外与本项目默认一致；壬年默认即原文“府”，另一说“辅”为选项', () => {
    const verse = line(/甲廉破武阳为伴[^\n]+\n+[^\n]+\n+[^\n]+/);
    const ABBR: Record<string, string> = { 廉: '廉贞', 破: '破军', 武: '武曲', 阳: '太阳', 日: '太阳', 机: '天机', 梁: '天梁', 紫: '紫微', 月: '太阴', 阴: '太阴', 同: '天同', 昌: '文昌', 巨: '巨门', 贪: '贪狼', 弼: '右弼', 曲: '文曲', 府: '天府' };
    STEMS.forEach((stem, i) => {
      const at = verse.indexOf(stem);
      const chars = [...verse.slice(at + 1, at + 5)];
      const four = chars.map((c) => ABBR[c]);
      expect(four.every(Boolean), `${stem}: ${chars.join('')}`).toBe(true);
      expect(SIHUA[i], stem).toEqual(four);
    });
    // 原文“壬梁紫府武”：第 1 版（默认）取府，第 2 版为通行软件的“辅”
    expect(SIHUA_VARIANTS.壬[0]).toEqual(['天梁', '紫微', '天府', '武曲']);
    expect(SIHUA_VARIANTS.壬[1]).toEqual(['天梁', '紫微', '左辅', '武曲']);
  });

  it('安天魁天钺诀：甲戊庚牛羊，乙己鼠猴乡，六辛逢虎马，壬癸兔蛇藏；丙丁“猪狗”疑为转录错误（通行“猪鸡”），保留本项目取值', () => {
    const t = line(/甲戊庚牛羊[^\n]+/).replace('免', '兔'); // 转录本“免蛇”为“兔蛇”之误
    const ANIMAL: Record<string, number> = { 鼠: 0, 牛: 1, 虎: 2, 兔: 3, 免: 3, 龙: 4, 蛇: 5, 马: 6, 羊: 7, 猴: 8, 鸡: 9, 狗: 10, 猪: 11 };
    const groups: [string, string, string][] = [['甲戊庚', '牛', '羊'], ['乙己', '鼠', '猴'], ['辛', '虎', '马'], ['壬癸', '兔', '蛇']];
    for (const [stems, kui, yue] of groups) {
      expect(t).toContain(kui + yue);
      for (const s of stems) expect(KUI_YUE[S(s)], s).toEqual([ANIMAL[kui], ANIMAL[yue]]);
    }
    // 丙丁：原文“猪狗位”，其余所有版本与软件均为“猪鸡”（亥、酉）。取通行值并在此记录差异，交审核人对照影印本。
    expect(t).toContain('丙丁猪狗位');
    expect(KUI_YUE[S('丙')]).toEqual([ANIMAL['猪'], ANIMAL['鸡']]);
  });

  it('安禄存、天马、火铃、左辅右弼、昌曲、天空地劫、红鸾天喜诀', () => {
    line(/甲生禄存在寅宫，乙生在卯丙戊巳，丁己禄存停午方，庚禄居申辛禄酉，壬禄在亥癸禄子/);
    expect(LU_CUN).toEqual('寅卯巳午巳午申酉亥子'.split('').map(B));
    const horse = line(/寅午戍人马居申[^\n]+/); // 转录本“戍”为“戌”之误
    expect(horse).toContain('申子辰人马居寅');
    expect([TIAN_MA[sanheGroup(B('申'))], TIAN_MA[sanheGroup(B('寅'))], TIAN_MA[sanheGroup(B('巳'))], TIAN_MA[sanheGroup(B('亥'))]]).toEqual([B('寅'), B('申'), B('亥'), B('巳')]);
    line(/寅午戌人丑卯方，申子辰人寅戌扬，巳酉丑人卯戌位，亥卯未人酉戌房/);
    // 火：寅午戌丑，申子辰寅，巳酉丑卯，亥卯未酉；铃：寅午戌卯，其余戌
    expect([HUO_START[1], HUO_START[0], HUO_START[2], HUO_START[3]]).toEqual([B('丑'), B('寅'), B('卯'), B('酉')]);
    expect([LING_START[1], LING_START[0], LING_START[2], LING_START[3]]).toEqual([B('卯'), B('戌'), B('戌'), B('戌')]);
    line(/左辅正月起于辰，顺逢生月是贵方，右弼正月宫寻戌，逆至正月便调停/);
    line(/子时戌上起文昌，逆到生时是贵乡，文曲数从辰上起，顺到生时是本乡/);
    line(/亥上起子顺安劫，逆向便是天空乡/);
    line(/卯上起子逆数之，数到当生太岁支，坐守此宫红鸾位，对宫天喜不差移/);
    // 引擎实际输出核对（子时正月：昌戌曲辰、劫空俱在亥；巳年红鸾在 卯-5=戌）
    const c = computeCharts(solarInput(1990, 2, 20, 0, 30)).ziwei; // 庚午年，农历正月，子时
    const at = (n: string) => BRANCHES[c.palaces.find((p) => p.stars.some((s) => s.name === n))!.branch];
    expect([at('文昌'), at('文曲'), at('地劫'), at('地空'), at('左辅'), at('右弼')]).toEqual(['戌', '辰', '亥', '亥', '辰', '戌']);
    expect(at('红鸾')).toBe(BRANCHES[(3 - B('午') + 12) % 12]);
  });

  it('安身命例与十二宫顺序', () => {
    line(/大抵人命俱从寅上起正月，顺数至本生月止，又自人生月起子时逆至本生时安命，顺至本生时安身/);
    line(/一 命宫、二兄弟、三妻妾、四子女、五财帛、六疾厄、七迁移、八奴仆、九官禄、十田宅、十一福德、十二父母/);
    // 正月生子时：命宫、身宫均在寅
    const c = computeCharts(solarInput(1990, 2, 20, 0, 30)).ziwei;
    expect(BRANCHES[c.mingBranch]).toBe('寅');
    expect(BRANCHES[c.bodyBranch]).toBe('寅');
    // 丑时：逆转丑安命，顺去卯安身
    const d = computeCharts(solarInput(1990, 2, 20, 2, 0)).ziwei;
    expect([BRANCHES[d.mingBranch], BRANCHES[d.bodyBranch]]).toEqual(['丑', '卯']);
  });

  it('“正月初一生者是火局，酉宫起初一日，就从酉宫起紫微”（原文示例）', () => {
    line(/如是正月初一生者是火局，酉宫起初一日，就从酉宫起紫微/);
    expect(ziweiPosition(6, 1)).toBe(B('酉'));
  });
});

/** 解析原文的“紫微星落宫”文字表：每局一张 4×4 框图，每个宫格里竖排两行字（上行“初/十/廿/二/三”，下行数字）。 */
function parseZiweiTables(raw: string): [number, number, number][] {
  const BUREAU: Record<string, number> = { 水二局: 2, 木三局: 3, 金四局: 4, 土五局: 5, 火六局: 6 };
  const cellsOf = (l: string) => l.split('|').slice(1, -1);
  const lines = raw.split('\n');
  const out: [number, number, number][] = [];
  let cells: { branch: string; days: number[] }[] = [];
  let bureau = 0;
  let pend: string[] = [];
  let done = false;
  const flush = () => { if (bureau && cells.length === 12) { for (const c of cells) for (const d of c.days) out.push([bureau, d, B(c.branch)]); if (bureau === 6) done = true; } cells = []; bureau = 0; };
  const parseDay = (top: string, bottom: string): number => {
    const n: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
    if (top === '初') return n[bottom];
    if (top === '十') return bottom === '十' ? 20 : 10 + n[bottom]; // “十/十”见于“二十”被排成十十的情形
    if (top === '廿') return 20 + n[bottom];
    if (top === '二' && bottom === '十') return 20;
    if (top === '三' && bottom === '十') return 30;
    throw new Error(`无法解析 ${top}${bottom}`);
  };
  for (const l of lines) {
    if (done) break;
    const nm = Object.keys(BUREAU).find((k) => l.includes(k) && l.includes('--------'));
    if (nm) { bureau = BUREAU[nm]; continue; }
    if (!l.startsWith('|')) { continue; }
    const cs = cellsOf(l);
    const isLabel = cs.some((c) => /^\s*[子丑寅卯辰巳午未申酉戌亥]\s*$/.test(c));
    if (!isLabel) { if (cs.some((c) => /[初十廿二三一四五六七八九]/.test(c))) pend.push(l); continue; }
    // 标签行：宫格从左到右；pend 中最后两行是上、下行文字
    if (pend.length < 2) throw new Error('标签行前缺少两行文字：' + l);
    const [top, bottom] = pend.slice(-2).map(cellsOf);
    pend = [];
    if (cs.some((c) => /巳/.test(c)) && cs.length === 4 && cells.length >= 12) flush();
    if (cs.length === 4 && cs[0].includes('巳') && cells.length) flush();
    cs.forEach((c, i) => {
      const br = c.trim();
      if (!br) return;
      const a = [...(top[i] ?? '').replace(/\s/g, '')], b = [...(bottom[i] ?? '').replace(/\s/g, '')];
      const days = a.map((ch, k) => parseDay(ch, b[k]));
      cells.push({ branch: br, days });
    });
    if (cells.length === 12 && bureau) flush();
  }
  flush();
  return out;
}

describe('《紫微斗数全书》卷二“紫微星落宫表”（原文文字表）× ziweiPosition', () => {
  it('解析出 5 局共 149 个（局，日，宫）；与本项目算法逐格比对，仅有 2 处已记录的原文/转录差异', () => {
    const t = parseZiweiTables(RAW);
    const cnt: Record<number, number> = {}; for (const x of t) cnt[x[0]] = (cnt[x[0]] ?? 0) + 1;
    expect(cnt).toEqual({ 2: 30, 3: 30, 4: 29, 5: 30, 6: 30 }); // 金四局表中无“三十”
    expect(t.length).toBe(149);
    expect([...new Set(t.map((x) => x[0]))].sort()).toEqual([2, 3, 4, 5, 6]);
    const extra = t.filter(([n, d, b]) => ziweiPosition(n, d) !== b);
    const missing: [number, number][] = [];
    for (const n of [2, 3, 4, 5, 6]) for (let d = 1; d <= 30; d++) if (!t.some(([nn, dd, b]) => nn === n && dd === d && b === ziweiPosition(n, d))) missing.push([n, d]);
    // 差异：原文木三局“寅”宫写作“初三、初九”，而初九已在“辰”宫（算法与原文其余部分一致），寅宫应为“初三、初五”——
    // 疑为原书或转录之误（初五漏写、初九重出）。已记入 ADR-010，交审核人对照影印本核对。
    // 另：金四局表中未列“三十”日（该局三十日算法落亥宫，与“初一”同宫），属原表省略。
    expect(extra).toEqual([[3, 9, B('寅')]]);
    expect(missing).toEqual([[3, 5], [4, 30]]);
    expect(ziweiPosition(4, 30)).toBe(B('亥'));
  });
});
