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
        for (const name of SHENSHA_NAMES.slice(0, 11)) {
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
    for (const n0 of SHENSHA_NAMES) {
      const r = RULES.byId.get(`bz.shensha.${n0.replace(/（.*）/, '')}`)!;
      expect(r.plain).toContain('传统');
      expect(r.plain).toContain('并不代表');
    }
  });
});

describe('神煞第二批：表格对照《三命通会》文字（手写期望）与 bazi-lite', () => {
  const stemIdx = (c: string) => STEMS.indexOf(c as (typeof STEMS)[number]);
  it('月德与月德合：寅午戌丙、申子辰壬、亥卯未甲、巳酉丑庚；合为丙辛、壬丁、甲己、庚乙', () => {
    const cases: [string, string, string][] = [['寅', '丙', '辛'], ['午', '丙', '辛'], ['子', '壬', '丁'], ['辰', '壬', '丁'], ['卯', '甲', '己'], ['未', '甲', '己'], ['酉', '庚', '乙'], ['丑', '庚', '乙']];
    for (const [mb, de, he] of cases) {
      const p = pillars(B('子'), B(mb), B('子'), B('子'));
      p.hour.stem = stemIdx(de); p.day.stem = stemIdx(he);
      const hits = computeShenSha(p);
      expect(hits.some((h) => h.name === '月德贵人' && h.pillar === 'hour'), `${mb}月德${de}`).toBe(true);
      expect(hits.some((h) => h.name === '月德合' && h.pillar === 'day'), `${mb}月德合${he}`).toBe(true);
    }
  });
  it('日柱类：十恶大败（含己丑而非乙丑）、魁罡、日德、日贵', () => {
    const day = (s: string, b: string) => computeShenSha(pillars(0, 0, B(b), 0, stemIdx(s)));
    for (const d of ['甲辰', '乙巳', '壬申', '丙申', '丁亥', '庚辰', '戊戌', '癸亥', '辛巳', '己丑']) expect(day(d[0], d[1]).some((h) => h.name === '十恶大败'), d).toBe(true);
    expect(day('乙', '丑').some((h) => h.name === '十恶大败')).toBe(false);
    for (const d of ['庚辰', '壬辰', '戊戌', '庚戌']) expect(day(d[0], d[1]).some((h) => h.name === '魁罡'), d).toBe(true);
    for (const d of ['甲寅', '丙辰', '戊辰', '庚辰', '壬戌']) expect(day(d[0], d[1]).some((h) => h.name === '日德'), d).toBe(true);
    for (const d of ['丁酉', '丁亥', '癸巳', '癸卯']) expect(day(d[0], d[1]).some((h) => h.name === '日贵'), d).toBe(true);
  });
  it('元辰、勾煞、绞煞：甲子阳男 → 元辰未、勾卯、绞酉；乙丑阴男 → 元辰午、勾戌、绞辰（《三命通会》举例）', () => {
    const a = computeShenSha(pillars(B('子'), B('午'), B('未'), B('卯'), 0, 0), 'M'); // 年柱甲子阳男
    expect(a.some((h) => h.name === '元辰' && h.pillar === 'day')).toBe(true); // 未
    expect(a.some((h) => h.name === '勾煞' && h.pillar === 'hour')).toBe(true); // 卯
    const b = computeShenSha(pillars(B('丑'), B('午'), B('戌'), B('辰'), 0, 1), 'M'); // 年柱乙丑阴男
    expect(b.some((h) => h.name === '元辰' && h.pillar === 'month')).toBe(true); // 午
    expect(b.some((h) => h.name === '勾煞' && h.pillar === 'day')).toBe(true); // 戌
    expect(b.some((h) => h.name === '绞煞' && h.pillar === 'hour')).toBe(true); // 辰
  });
  it('灾煞（申子辰午、寅午戌子、巳酉丑卯、亥卯未酉）与丧门吊客（年支后二、前二）', () => {
    for (const [yb, z] of [['子', '午'], ['午', '子'], ['酉', '卯'], ['卯', '酉']]) expect(computeShenSha(pillars(B(yb), B('丑'), B('丑'), B(z))).some((h) => h.name === '灾煞' && h.pillar === 'hour'), yb).toBe(true);
    const h = computeShenSha(pillars(B('子'), B('寅'), B('戌'), B('丑')));
    expect(h.some((x) => x.name === '丧门' && x.pillar === 'month')).toBe(true); // 子+2=寅
    expect(h.some((x) => x.name === '吊客' && x.pillar === 'day')).toBe(true); // 子-2=戌
  });
  it('天罗地网：火命男戌亥同见才有天罗；水土命女辰巳同见才有地网；金木命无', () => {
    const chart = (yearStem: number, yearBranch: number, extra: number[], g: 'M' | 'F') => computeShenSha({ year: st(yearBranch, yearStem), month: st(extra[0]), day: st(extra[1]), hour: st(extra[2]) }, g);
    // 戊戌年（大林木？——用纳音取火命：丙寅年炉中火）
    expect(chart(2, B('寅'), [B('戌'), B('亥'), B('子')], 'M').some((h) => h.name === '天罗')).toBe(true);
    expect(chart(2, B('寅'), [B('戌'), B('亥'), B('子')], 'F').some((h) => h.name === '天罗')).toBe(false);
    expect(chart(2, B('寅'), [B('戌'), B('子'), B('子')], 'M').some((h) => h.name === '天罗')).toBe(false); // 只见戌不见亥
    // 丙子年涧下水
    expect(chart(2, B('子'), [B('辰'), B('巳'), B('午')], 'F').some((h) => h.name === '地网')).toBe(true);
    expect(chart(2, B('子'), [B('辰'), B('巳'), B('午')], 'M').some((h) => h.name === '地网')).toBe(false);
    // 甲子年海中金：金命无
    expect(chart(0, B('子'), [B('辰'), B('巳'), B('午')], 'F').some((h) => h.name === '地网')).toBe(false);
  });
  it('三奇：三个天干都出现才算，并标注是否顺布', () => {
    const p = { year: st(0, 1), month: st(0, 2), day: st(0, 3), hour: st(0, 0) }; // 乙丙丁 顺布
    expect(computeShenSha(p).filter((h) => h.name === '三奇贵人').every((h) => h.basis.includes('顺布'))).toBe(true);
    expect(computeShenSha(p).filter((h) => h.name === '三奇贵人').length).toBe(3);
    const q = { year: st(0, 3), month: st(0, 2), day: st(0, 1), hour: st(0, 0) }; // 丁丙乙 倒布
    expect(computeShenSha(q).filter((h) => h.name === '三奇贵人').every((h) => h.basis.includes('未顺布'))).toBe(true);
    const r = { year: st(0, 1), month: st(0, 2), day: st(0, 9), hour: st(0, 0) };
    expect(computeShenSha(r).some((h) => h.name === '三奇贵人')).toBe(false);
  });
  it('与 bazi-lite 比对 1200 盘：月德、月德合、德秀（当月德/秀干）、元辰、灾煞、勾绞、十恶大败、天罗地网、禄神、魁罡、丧门、吊客的四柱分布一致；三奇按“是否成立”比对', () => {
    const r = rng(4242);
    const MAP: Record<string, string> = { 月德贵人: '月德贵人', 月德合: '月德合', 德秀贵人: '德秀贵人', 元辰: '元辰', 灾煞: '灾煞', 勾煞: '勾煞', 绞煞: '绞煞', 十恶大败: '十恶大败', 禄神: '禄神', 魁罡: '魁罡', 丧门: '丧门', 吊客: '吊客' };
    const bad: string[] = [];
    for (let k = 0; k < 1200; k++) {
      const y = r.int(1902, 2099), m = r.int(1, 12), d = r.int(1, 28), h = r.int(0, 23), g = k % 2 ? 'F' : 'M';
      const c = computeCharts(solarInput(y, m, d, h, 10, g)).bazi;
      const gg = g === 'M' ? GENDER.MALE : GENDER.FEMALE;
      const b = BaziChart.fromZonedTime(new ZonedTime({ year: y, month: m, day: d, hour: h, minute: 10, second: 0, offsetMinutes: 480 }), new BaziOptions({ gender: gg, mode: 'china-astronomical', pillarHistoricalMode: 'off' } as never));
      const o = collectNatalShenSha(b as never, { gender: gg } as never) as unknown as Record<PillarKey, bigint>;
      for (const pk of ['year', 'month', 'day', 'hour'] as PillarKey[]) {
        const theirs = new Set(shenShaNames(o[pk]));
        const mine = new Set(c.shensha.filter((x) => x.pillar === pk).map((x) => x.name as string));
        for (const [mn, tn] of Object.entries(MAP)) if (mine.has(mn) !== theirs.has(tn)) bad.push(`${y}-${m}-${d} ${h} ${g} ${pk} ${mn}`);
        if ((mine.has('天罗') || mine.has('地网')) !== theirs.has('天罗地网')) bad.push(`${y}-${m}-${d} ${h} ${g} ${pk} 天罗地网`); // bazi-lite 把天罗、地网合为一项
      }
      const mySanQi = c.shensha.some((x) => x.name === '三奇贵人');
      const theirSanQi = ['三奇贵人（天）', '三奇贵人（地）', '三奇贵人（人）'].some((n) => new Set(shenShaNames(o.day)).has(n));
      if (mySanQi !== theirSanQi) bad.push(`${y}-${m}-${d} ${h} ${g} 三奇`);
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
});

