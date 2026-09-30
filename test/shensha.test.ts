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
      for (const it of sec!.items) { if (it.ruleId.startsWith('bz.shensha.')) expect(it.classical.length, it.ruleId).toBeGreaterThan(0); expect(it.reviewStatus).toBe('draft'); }
    }
  });
  it('没有绝对化措辞：每条神煞解读都含“传统”与“并不代表”', () => {
    for (const n0 of SHENSHA_NAMES) {
      const key = n0.replace(/（.*）/, '');
      const r = (RULES.byId.get(`bz.shensha.${key}`) ?? RULES.byId.get(`modern_shensha.${key}`))!;
      expect(r.plain).toContain(r.id.startsWith('modern_') ? '通行' : '传统');
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

describe('神煞第三批（ADR-017）：天德、文昌、太极、红鸾天喜、阴干羊刃选项', () => {
  const stemIdx = (c: string) => STEMS.indexOf(c as (typeof STEMS)[number]);
  it('文昌贵人：默认《三命通会》歌诀表，通行表为选项（手写期望）', () => {
    const san: Record<string, string> = { 甲: '巳', 乙: '亥', 丙: '戌', 丁: '辰', 戊: '申', 己: '午', 庚: '寅', 辛: '未', 壬: '卯', 癸: '丑' };
    const com: Record<string, string> = { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };
    for (const g of Object.keys(san)) {
      const mk = (br: string) => pillars(B('子'), B('子'), B('子'), B(br), stemIdx(g));
      expect(computeShenSha(mk(san[g])).some((h) => h.name === '文昌贵人' && h.pillar === 'hour'), `sanming ${g}`).toBe(true);
      expect(computeShenSha(mk(com[g]), 'M', { wenchangMode: 'common', yinStemYangRen: false }).some((h) => h.name === '文昌贵人' && h.pillar === 'hour'), `common ${g}`).toBe(true);
    }
    expect(computeShenSha(pillars(B('子'), B('子'), B('子'), B('午'), 1)).some((h) => h.name === '文昌贵人' && h.pillar === 'hour')).toBe(false); // 乙午是通行表，不是歌诀表
  });
  it('太极贵人（壬癸取申、巳）与红鸾天喜（子年红鸾在卯、天喜在酉）', () => {
    for (const [g, brs] of [['甲', '子午'], ['丙', '卯酉'], ['戊', '辰戌丑未'], ['庚', '寅亥'], ['壬', '申巳'], ['癸', '申巳']] as [string, string][])
      for (const br of brs) expect(computeShenSha(pillars(B('子'), B('子'), B('子'), B(br), stemIdx(g))).some((h) => h.name === '太极贵人' && h.pillar === 'hour'), `${g}${br}`).toBe(true);
    const h = computeShenSha(pillars(B('子'), B('卯'), B('酉'), B('子')));
    expect(h.some((x) => x.name === '红鸾' && x.pillar === 'month')).toBe(true);
    expect(h.some((x) => x.name === '天喜' && x.pillar === 'day')).toBe(true);
  });
  it('天德贵人与天德合（正月丁壬、二月申巳、三月壬丁、四月辛丙、五月亥寅、六月甲己、七月癸戊、八月寅亥、九月丙辛、十月乙庚、十一月巳申、十二月庚乙）', () => {
    const rows: [string, string, string][] = [['寅', '丁', '壬'], ['卯', '申', '巳'], ['辰', '壬', '丁'], ['巳', '辛', '丙'], ['午', '亥', '寅'], ['未', '甲', '己'], ['申', '癸', '戊'], ['酉', '寅', '亥'], ['戌', '丙', '辛'], ['亥', '乙', '庚'], ['子', '巳', '申'], ['丑', '庚', '乙']];
    for (const [mb, de, he] of rows) {
      const isStem = STEMS.includes(de as (typeof STEMS)[number]);
      const p = pillars(B('午'), B(mb), B('午'), B('午'));
      if (isStem) { p.hour.stem = stemIdx(de); p.day.stem = stemIdx(he); } else { p.hour.branch = B(de); p.day.branch = B(he); }
      const hits = computeShenSha(p);
      expect(hits.some((x) => x.name === '天德贵人' && x.pillar === 'hour'), `${mb}月天德${de}`).toBe(true);
      expect(hits.some((x) => x.name === '天德合' && x.pillar === 'day'), `${mb}月天德合${he}`).toBe(true);
    }
  });
  it('阴干羊刃选项：默认关闭；开启后乙寅、丁巳、己巳、辛申、癸亥（日干基准）', () => {
    for (const [g, br] of [['乙', '寅'], ['丁', '巳'], ['己', '巳'], ['辛', '申'], ['癸', '亥']] as [string, string][]) {
      const p = pillars(B('子'), B('子'), B('子'), B(br), stemIdx(g));
      expect(computeShenSha(p).some((h) => h.name === '羊刃')).toBe(false);
      expect(computeShenSha(p, 'M', { wenchangMode: 'sanming', yinStemYangRen: true }).some((h) => h.name === '羊刃' && h.pillar === 'hour')).toBe(true);
    }
  });
  it('分层：德秀同见与否、三奇是否顺布，检测到就列出，qualified 记录是否满足完整条件', () => {
    // 寅月（寅午戌）德=丙丁，秀=戊癸：只有德（丙）
    const onlyDe = pillars(B('午'), B('寅'), B('子'), B('子')); onlyDe.year.stem = stemIdx('丙'); onlyDe.month.stem = stemIdx('甲'); onlyDe.day.stem = stemIdx('庚'); onlyDe.hour.stem = stemIdx('庚');
    const a = computeShenSha(onlyDe).filter((h) => h.name === '德秀贵人');
    expect(a.length).toBeGreaterThan(0); expect(a.every((h) => h.qualified === false)).toBe(true);
    const both = pillars(B('午'), B('寅'), B('子'), B('子')); both.year.stem = stemIdx('丙'); both.month.stem = stemIdx('戊'); both.day.stem = stemIdx('庚'); both.hour.stem = stemIdx('庚');
    expect(computeShenSha(both).filter((h) => h.name === '德秀贵人').every((h) => h.qualified === true)).toBe(true);
    const seq = { year: st(0, 1), month: st(0, 2), day: st(0, 3), hour: st(0, 0) };
    expect(computeShenSha(seq).filter((h) => h.name === '三奇贵人').every((h) => h.qualified === true)).toBe(true);
    const rev = { year: st(0, 3), month: st(0, 2), day: st(0, 1), hour: st(0, 0) };
    expect(computeShenSha(rev).filter((h) => h.name === '三奇贵人').every((h) => h.qualified === false)).toBe(true);
  });
  it('与 bazi-lite 比对 1200 盘：天德、天德合、太极、红鸾、天喜、文昌（通行表）一致；阴干羊刃开启后与 bazi-lite 完整一致', () => {
    const r = rng(9090);
    const bad: string[] = [];
    for (let k = 0; k < 1200; k++) {
      const y = r.int(1902, 2099), m = r.int(1, 12), d = r.int(1, 28), h = r.int(0, 23), g = k % 2 ? 'F' : 'M';
      const c = computeCharts(solarInput(y, m, d, h, 10, g), { wenchangMode: 'common', yinStemYangRen: true }).bazi;
      const gg = g === 'M' ? GENDER.MALE : GENDER.FEMALE;
      const b = BaziChart.fromZonedTime(new ZonedTime({ year: y, month: m, day: d, hour: h, minute: 10, second: 0, offsetMinutes: 480 }), new BaziOptions({ gender: gg, mode: 'china-astronomical', pillarHistoricalMode: 'off' } as never));
      const o = collectNatalShenSha(b as never, { gender: gg } as never) as unknown as Record<PillarKey, bigint>;
      const MAP: Record<string, string> = { 天德贵人: '天德贵人', 天德合: '天德合', 太极贵人: '太极贵人', 红鸾: '红鸾', 天喜: '天喜', 文昌贵人: '文昌贵人', 羊刃: '羊刃' };
      for (const pk of ['year', 'month', 'day', 'hour'] as PillarKey[]) {
        const theirs = new Set(shenShaNames(o[pk]));
        const mine = new Set(c.shensha.filter((x) => x.pillar === pk).map((x) => x.name as string));
        for (const [mn, tn] of Object.entries(MAP)) if (mine.has(mn) !== theirs.has(tn)) bad.push(`${y}-${m}-${d} ${h} ${g} ${pk} ${mn}`);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
  it('来源分级：所有神煞规则都有 sourceClass；modern_shensha 无引文；文昌、太极有异文注记', () => {
    const all = [...RULES.bazi].filter((r) => r.id.startsWith('bz.shensha.') || r.id.startsWith('modern_shensha.'));
    expect(all.length).toBe(78);
    for (const r of all) expect(r.sourceClass, r.id).toBeDefined();
    for (const r of all.filter((x) => x.id.startsWith('modern_shensha.'))) { expect(['MODERN_COMMON', 'IMPLEMENTATION_ONLY']).toContain(r.sourceClass); expect(r.classical).toHaveLength(0); }
    const wc = RULES.byId.get('bz.shensha.文昌贵人')!, tj = RULES.byId.get('bz.shensha.太极贵人')!;
    expect(wc.classical.some((q) => q.variant?.includes('甲人蛇口'))).toBe(true);
    expect(tj.classical.some((q) => q.variant?.includes('先得申而生'))).toBe(true);
    expect(validateRules(RULES)).toEqual([]);
  });
});

describe('学堂词馆专题（ADR-018）', () => {
  const S = (c: string) => STEMS.indexOf(c as (typeof STEMS)[number]);
  const P = (gz: string) => st(B(gz[1]), S(gz[0]));
  const chart = (y: string, m: string, d: string, h: string) => ({ year: P(y), month: P(m), day: P(d), hour: P(h) });
  const has = (hits: ReturnType<typeof computeShenSha>, name: string, pillar: PillarKey) => hits.filter((x) => x.name === name && x.pillar === pillar);
  it('原文举例：金命见辛巳为学堂、壬申为词馆；己酉人得丙子日、壬午人得辛卯时为学堂会贵', () => {
    const a = computeShenSha(chart('甲子', '戊寅', '辛巳', '壬申')); // 甲子海中金，金命
    expect(has(a, '正学堂', 'day').length).toBe(1);
    expect(has(a, '正词馆', 'hour').length).toBe(1);
    const b = computeShenSha(chart('己酉', '甲子', '丙子', '戊子'));
    expect(has(b, '学堂会贵', 'day').length).toBe(1);
    const c = computeShenSha(chart('壬午', '甲辰', '丙午', '辛卯'));
    expect(has(c, '学堂会贵', 'hour').length).toBe(1);
    // 只查日、时：月柱是丙子也不算
    expect(has(computeShenSha(chart('己酉', '丙子', '甲午', '戊辰')), '学堂会贵', 'month').length).toBe(0);
  });
  it('官星学堂：甲乙辛亥、丙丁壬寅、戊己甲申、庚辛丁巳；壬癸戊申为据规律反推（标注）', () => {
    const cells: [string, string, boolean][] = [['甲', '辛亥', false], ['乙', '辛亥', false], ['丙', '壬寅', false], ['丁', '壬寅', false], ['戊', '甲申', false], ['己', '甲申', false], ['庚', '丁巳', false], ['辛', '丁巳', false], ['壬', '戊申', true], ['癸', '戊申', true]];
    for (const [ds, gz, derived] of cells) {
      const h = computeShenSha(chart('甲子', '丙寅', ds + '子', gz)).filter((x) => x.name === '官星学堂' && x.pillar === 'hour');
      expect(h.length, `${ds}日 ${gz}`).toBeGreaterThan(0);
      expect(h.some((x) => x.basis.includes('反推')) === derived, `${ds} 反推标注`).toBe(true);
    }
  });
  it('食神学堂：甲丙寅、乙丁巳、丙戊申（原文），其余反推为丁己亥、戊庚申、己辛巳、庚壬申、辛癸亥、壬甲寅、癸乙亥', () => {
    const cells: [string, string][] = [['甲', '丙寅'], ['乙', '丁巳'], ['丙', '戊申'], ['丁', '己亥'], ['戊', '庚申'], ['己', '辛巳'], ['庚', '壬申'], ['辛', '癸亥'], ['壬', '甲寅'], ['癸', '乙亥']];
    for (const [ds, gz] of cells) {
      const h = computeShenSha(chart('甲子', '丙寅', ds + '子', gz)).filter((x) => x.name === '食神学堂' && x.pillar === 'hour');
      expect(h.length, `${ds}日 ${gz}`).toBeGreaterThan(0);
      expect(h.some((x) => x.basis.includes('反推')), ds).toBe('甲乙丙'.includes(ds) ? false : true);
    }
  });
  it('成色：落空亡、逢冲则 qualified=false，不列出成色问题则 true（原文“切不要犯空亡及冲破”）', () => {
    // 年柱壬子（桑柘木，木命），时柱己亥（平地木，亥为木长生）
    const bad = computeShenSha(chart('壬子', '丙寅', '甲子', '己亥')).filter((x) => x.name === '正学堂' && x.pillar === 'hour'); // 甲子日旬空戌亥
    expect(bad.length).toBe(1); expect(bad[0].qualified).toBe(false); expect(bad[0].basis).toContain('落空亡');
    const chong = computeShenSha(chart('壬子', '丙寅', '甲午', '己亥')).filter((x) => x.name === '正学堂' && x.pillar === 'hour'); // 甲午旬空辰巳；月支寅、无巳；亥冲巳，无巳
    expect(chong[0].qualified).toBe(true);
    const cl = computeShenSha(chart('壬子', '丁巳', '甲午', '己亥')).filter((x) => x.name === '正学堂' && x.pillar === 'hour'); // 月支巳冲亥
    expect(cl[0].qualified).toBe(false); expect(cl[0].basis).toContain('逢冲');
  });
  it('与 bazi-lite 比对 1500 盘：正学堂、正词馆（年柱纳音）一致；官贵学堂、官贵词馆（日干基准）一致；学堂会贵（日、时柱）我方是其子集，且差异只来自“仅日干天乙”', () => {
    const r = rng(1234);
    const bad: string[] = [];
    for (let k = 0; k < 1500; k++) {
      const y = r.int(1902, 2099), m = r.int(1, 12), d = r.int(1, 28), h = r.int(0, 23), g = k % 2 ? 'F' : 'M';
      const c = computeCharts(solarInput(y, m, d, h, 10, g)).bazi;
      const gg = g === 'M' ? GENDER.MALE : GENDER.FEMALE;
      const b = BaziChart.fromZonedTime(new ZonedTime({ year: y, month: m, day: d, hour: h, minute: 10, second: 0, offsetMinutes: 480 }), new BaziOptions({ gender: gg, mode: 'china-astronomical', pillarHistoricalMode: 'off' } as never));
      const o = collectNatalShenSha(b as never, { gender: gg } as never) as unknown as Record<PillarKey, bigint>;
      for (const pk of ['year', 'month', 'day', 'hour'] as PillarKey[]) {
        const theirs = new Set(shenShaNames(o[pk]));
        const mine = c.shensha.filter((x) => x.pillar === pk);
        const has2 = (n: string, dayOnly = false) => mine.some((x) => x.name === n && (!dayOnly || x.basis.startsWith('日干')));
        for (const n of ['正学堂', '正词馆']) if (has2(n) !== theirs.has(n)) bad.push(`${y}-${m}-${d} ${h} ${pk} ${n}`);
        for (const n of ['官贵学堂', '官贵词馆']) if (has2(n, true) !== theirs.has(n)) bad.push(`${y}-${m}-${d} ${h} ${pk} ${n}`);
        if (pk === 'day' || pk === 'hour') {
          // 本项目只认年干的天乙（P0 修正），bazi-lite 认年干或日干：本项目命中必为其子集，多出来的必须是“仅日干天乙”造成的
          const mineHit = has2('学堂会贵'), theirHit = theirs.has('学堂会贵');
          const brn = c.pillars[pk].branch;
          const yearTY = [[1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [1, 7], [2, 6], [3, 5], [3, 5]][c.pillars.year.stem].includes(brn);
          if (mineHit && !theirHit) bad.push(`${y}-${m}-${d} ${h} ${pk} 学堂会贵（我方多出）`);
          if (!mineHit && theirHit && yearTY) bad.push(`${y}-${m}-${d} ${h} ${pk} 学堂会贵（漏报）`);
        }
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
  it('规则：七条学堂词馆规则都带引文与来源分级；反推类标 DERIVED_FROM_TEXT', () => {
    for (const n of ['正学堂', '正词馆', '官贵学堂', '官贵词馆', '官星学堂', '食神学堂', '学堂会贵']) {
      const r = RULES.byId.get(`bz.shensha.${n}`)!;
      expect(r.classical.length, n).toBeGreaterThan(0);
      expect(r.plain).toContain('并不代表');
    }
    for (const n of ['官星学堂', '食神学堂', '学堂会贵']) expect(RULES.byId.get(`bz.shensha.${n}`)!.sourceClass).toBe('DERIVED_FROM_TEXT');
    expect(validateRules(RULES)).toEqual([]);
  });
});

describe('第二轮计算审计修正（P0/P1）与回归夹具', () => {
  const S = (c: string) => STEMS.indexOf(c as (typeof STEMS)[number]);
  const P = (gz: string) => st(B(gz[1]), S(gz[0]));
  const chart = (y: string, m: string, d: string, h: string) => ({ year: P(y), month: P(m), day: P(d), hour: P(h) });
  it('P0 学堂会贵：只认年干的天乙；日干自身的天乙不得额外命中', () => {
    // 壬午年（杨柳木，木帝旺卯）：壬的天乙为卯巳，日柱辛卯 → 命中
    expect(computeShenSha(chart('壬午', '甲辰', '辛卯', '丙申')).some((h) => h.name === '学堂会贵' && h.pillar === 'day')).toBe(true);
    // 丙寅年（炉中火，火帝旺午）：年干丙的天乙为亥酉，不含午；日干辛的天乙含午（午寅）——旧规则会误报，新规则不得命中
    const fp = computeShenSha(chart('丙寅', '甲辰', '辛卯', '甲午'));
    expect(fp.some((h) => h.name === '学堂会贵')).toBe(false);
  });
  it('元辰、勾煞、绞煞夹具：甲子男 → 元辰未、勾卯、绞酉；乙丑男 → 元辰午、勾戌、绞辰', () => {
    const a = computeShenSha(chart('甲子', '丙寅', '丁未', '乙卯'), 'M'); // 未、卯在日、时
    expect(a.some((h) => h.name === '元辰' && h.pillar === 'day')).toBe(true);
    expect(a.some((h) => h.name === '勾煞' && h.pillar === 'hour')).toBe(true);
    const a2 = computeShenSha(chart('甲子', '丙寅', '乙酉', '丁未'), 'M');
    expect(a2.some((h) => h.name === '绞煞' && h.pillar === 'day')).toBe(true); // 酉
    const b = computeShenSha(chart('乙丑', '丙午', '甲戌', '戊辰'), 'M'); // 午月、戌日、辰时
    expect(b.some((h) => h.name === '元辰' && h.pillar === 'month')).toBe(true);
    expect(b.some((h) => h.name === '勾煞' && h.pillar === 'day')).toBe(true);
    expect(b.some((h) => h.name === '绞煞' && h.pillar === 'hour')).toBe(true);
  });
  it('P1 三奇：detected 只看三干是否齐全；qualified 仅当年月日或月日时连续依序', () => {
    const seq = (a: string, b: string, c: string, d: string) => computeShenSha({ year: st(0, S(a)), month: st(0, S(b)), day: st(0, S(c)), hour: st(0, S(d)) }).filter((h) => h.name === '三奇贵人');
    const cases: [string[], boolean][] = [[['乙', '丙', '丁', '壬'], true], [['壬', '乙', '丙', '丁'], true], [['乙', '壬', '丙', '丁'], false], [['丁', '丙', '乙', '壬'], false],
      [['甲', '戊', '庚', '壬'], true], [['壬', '辛', '壬', '癸'], true], [['辛', '壬', '癸', '甲'], true], [['辛', '癸', '壬', '甲'], false], [['乙', '丙', '壬', '丁'], false]];
    for (const [c, q] of cases) {
      const h = seq(c[0], c[1], c[2], c[3]);
      const complete = [[1, 2, 3], [0, 4, 6], [7, 8, 9]].some((t) => t.every((x) => c.map(S).includes(x)));
      expect(h.length > 0, c.join('')).toBe(complete);
      if (h.length) { expect(h.every((x) => x.qualified === q), `${c.join('')} qualified=${q}`).toBe(true); expect(h[0].qualifiedMeaning).toBe('依序顺布'); }
    }
  });
  it('P1 德秀：qualified 只表示“德秀同见”，并带 qualifiedMeaning，不等同完整成立', () => {
    const p = { year: st(0, S('丙')), month: st(2, S('戊')), day: st(0, S('庚')), hour: st(0, S('庚')) }; // 寅月：德丙丁、秀戊癸
    const h = computeShenSha(p).filter((x) => x.name === '德秀贵人');
    expect(h.length).toBeGreaterThan(0);
    for (const x of h) { expect(x.qualified).toBe(true); expect(x.qualifiedMeaning).toBe('德秀同见'); }
    expect(RULES.byId.get('bz.shensha.德秀贵人')!.plain).toContain('不等同于原文');
  });
});

