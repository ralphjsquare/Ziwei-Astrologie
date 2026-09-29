import { describe, expect, it } from 'vitest';
import { BaziChart, BaziOptions, GENDER, collectNatalShenSha, shenShaNames } from 'bazi-lite';
import { ZonedTime } from 'js-ephemeris-lite';
import { computeCharts, STEMS, BRANCHES } from '../src/index';
import { computeShenSha, SHENSHA_NAMES, type PillarKey } from '../src/bazi/shensha';
import { interpretNatal } from '../src/interpret';
import { RULES, validateRules } from '../src/rules';
import { rng, solarInput } from './helpers';

const B = (c: string) => BRANCHES.indexOf(c as (typeof BRANCHES)[number]);
const st = (branch: number, stem = 0) => ({ stem, branch });
const pillars = (year: number, month: number, day: number, hour: number, dayStem = 0, yearStem = 0) => ({ year: st(year, yearStem), month: st(month), day: st(day, dayStem), hour: st(hour) });

describe('神煞：表格对照《三命通会》文字（手写期望）', () => {
  it('驿马 咸池 劫煞 亡神 将星 华盖：以年支为基准，每个三合局的落点', () => {
    const exp: Record<string, string[]> = { // 年支 → [驿马, 咸池, 劫煞, 亡神, 将星, 华盖]
      申: ['寅', '酉', '巳', '亥', '子', '辰'], 子: ['寅', '酉', '巳', '亥', '子', '辰'], 辰: ['寅', '酉', '巳', '亥', '子', '辰'],
      寅: ['申', '卯', '亥', '巳', '午', '戌'], 午: ['申', '卯', '亥', '巳', '午', '戌'], 戌: ['申', '卯', '亥', '巳', '午', '戌'],
      巳: ['亥', '午', '寅', '申', '酉', '丑'], 酉: ['亥', '午', '寅', '申', '酉', '丑'], 丑: ['亥', '午', '寅', '申', '酉', '丑'],
      亥: ['巳', '子', '申', '寅', '卯', '未'], 卯: ['巳', '子', '申', '寅', '卯', '未'], 未: ['巳', '子', '申', '寅', '卯', '未'],
    };
    const names = ['驿马', '咸池（桃花）', '劫煞', '亡神', '将星', '华盖'];
    for (const [yb, targets] of Object.entries(exp)) {
      // 把四个目标地支依次放在月、日、时柱之外的位置：逐个测试，令时柱地支等于目标
      targets.forEach((t, i) => {
        const hits = computeShenSha(pillars(B(yb), B('丑'), B('丑'), B(t))).filter((h) => h.name === names[i] && h.pillar === 'hour' && h.basis === `年支${yb}`);
        expect(hits.length, `${yb}年 ${names[i]}应在${t}`).toBe(1);
      });
    }
  });
  it('孤辰寡宿（亥子丑孤寅寡戌；寅卯辰孤巳寡丑；巳午未孤申寡辰；申酉戌孤亥寡未）', () => {
    const exp: [string, string, string][] = [['子', '寅', '戌'], ['卯', '巳', '丑'], ['午', '申', '辰'], ['酉', '亥', '未']];
    for (const [yb, gu, gua] of exp) {
      expect(computeShenSha(pillars(B(yb), B('子'), B('子'), B(gu))).some((h) => h.name === '孤辰' && h.pillar === 'hour')).toBe(true);
      expect(computeShenSha(pillars(B(yb), B('子'), B('子'), B(gua))).some((h) => h.name === '寡宿' && h.pillar === 'hour')).toBe(true);
    }
  });
  it('羊刃仅阳干（甲卯 丙戊午 庚酉 壬子），金舆禄前二辰（甲辰 乙巳 丙戊未 丁己申 庚戌 辛亥 壬丑 癸寅）', () => {
    const ren: [number, string][] = [[0, '卯'], [2, '午'], [4, '午'], [6, '酉'], [8, '子']];
    for (const [ds, br] of ren) expect(computeShenSha(pillars(B('子'), B('子'), B('子'), B(br), ds)).some((h) => h.name === '羊刃' && h.pillar === 'hour')).toBe(true);
    for (const ds of [1, 3, 5, 7, 9]) for (let b = 0; b < 12; b++) expect(computeShenSha(pillars(B('子'), B('子'), B('子'), b, ds)).some((h) => h.name === '羊刃' && h.pillar === 'hour')).toBe(false);
    const jin = '辰巳未申未申戌亥丑寅';
    for (let ds = 0; ds < 10; ds++) expect(computeShenSha(pillars(B('子'), B('子'), B('子'), B(jin[ds]), ds)).some((h) => h.name === '金舆' && h.pillar === 'hour'), `${STEMS[ds]}`).toBe(true);
  });
  it('天乙贵人（甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，六辛逢马虎）', () => {
    const exp: Record<string, string> = { 甲: '丑未', 戊: '丑未', 庚: '丑未', 乙: '子申', 己: '子申', 丙: '亥酉', 丁: '亥酉', 壬: '卯巳', 癸: '卯巳', 辛: '午寅' };
    for (const [g, brs] of Object.entries(exp)) for (const br of brs) {
      expect(computeShenSha(pillars(B('子'), B('子'), B('子'), B(br), STEMS.indexOf(g as (typeof STEMS)[number]), 9)).some((h) => h.name === '天乙贵人' && h.pillar === 'hour' && h.basis === `日干${g}`), `${g}${br}`).toBe(true);
    }
  });
});

describe('神煞：与独立实现 bazi-lite 比对', () => {
  it('随机 1500 盘：十种神煞在四柱的分布一致（羊刃仅比较阳干：bazi-lite 对阴干也定羊刃，是另一流派）', () => {
    const r = rng(2026);
    const bad: string[] = [];
    for (let k = 0; k < 1500; k++) {
      const y = r.int(1902, 2099), m = r.int(1, 12), d = r.int(1, 28), h = r.int(0, 23), mi = r.int(0, 59);
      const c = computeCharts(solarInput(y, m, d, h, mi, 'M')).bazi;
      const b = BaziChart.fromZonedTime(new ZonedTime({ year: y, month: m, day: d, hour: h, minute: mi, second: 0, offsetMinutes: 480 }), new BaziOptions({ gender: GENDER.MALE, mode: 'china-astronomical', pillarHistoricalMode: 'off' } as never));
      const o = collectNatalShenSha(b as never, { gender: GENDER.MALE } as never) as unknown as Record<PillarKey, bigint>;
      for (const pk of ['year', 'month', 'day', 'hour'] as PillarKey[]) {
        const theirs = new Set(shenShaNames(o[pk]));
        const mine = new Set(c.shensha.filter((x) => x.pillar === pk).map((x) => x.name as string));
        for (const name of SHENSHA_NAMES) {
          if (name === '羊刃' && c.dayMaster.stem % 2 === 1) continue;
          if (mine.has(name) !== theirs.has(name)) bad.push(`${y}-${m}-${d} ${h}:${mi} ${pk} ${name}`);
        }
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
});

describe('神煞：规则与解读', () => {
  it('规则校验通过；解读中每个命中的神煞都带《三命通会》引文', () => {
    expect(validateRules(RULES)).toEqual([]);
    const b = computeCharts(solarInput(1990, 6, 15, 10, 30, 'M'));
    const sec = interpretNatal(b, RULES).find((x) => x.id === 'bz-shensha');
    if (b.bazi.shensha.length) {
      expect(sec).toBeDefined();
      for (const it of sec!.items) { expect(it.classical.length).toBeGreaterThan(0); expect(it.reviewStatus).toBe('draft'); }
    }
  });
  it('没有绝对化措辞：每条神煞解读都含“传统”与“并不代表”', () => {
    for (const n of ['天乙贵人', '驿马', '咸池', '劫煞', '亡神', '将星', '华盖', '羊刃', '金舆', '孤辰', '寡宿']) {
      const r = RULES.byId.get(`bz.shensha.${n}`)!;
      expect(r.plain).toContain('传统');
      expect(r.plain).toContain('并不代表');
    }
  });
});
