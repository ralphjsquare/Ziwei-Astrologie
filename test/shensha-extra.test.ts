import { describe, expect, it } from 'vitest';
import { BaziChart, BaziOptions, GENDER, collectNatalShenSha, shenShaNames } from 'bazi-lite';
import { ZonedTime } from 'js-ephemeris-lite';
import { computeCharts, STEMS, BRANCHES } from '../src/index';
import { computeShenSha, SHENSHA_NAMES, type PillarKey } from '../src/bazi/shensha';
import { EXTRA_NAMES, EXTRA_TEXT_NAMES } from '../src/bazi/shensha-extra';
import { RULES, validateRules } from '../src/rules';
import { rng, solarInput } from './helpers';

const S = (c: string) => STEMS.indexOf(c as (typeof STEMS)[number]);
const B = (c: string) => BRANCHES.indexOf(c as (typeof BRANCHES)[number]);
const P = (gz: string) => ({ stem: S(gz[0]), branch: B(gz[1]) });
type Ch = { year: { stem: number; branch: number }; month: { stem: number; branch: number }; day: { stem: number; branch: number }; hour: { stem: number; branch: number } };
const chart = (y: string, m: string, d: string, h: string): Ch => ({ year: P(y), month: P(m), day: P(d), hour: P(h) });
const raw = (stem: string, branch: string) => ({ stem: S(stem), branch: B(branch) }); // 不要求是合法干支，仅用于构造测试局面
const hit = (c: Ch, name: string, pillar: PillarKey, g: 'M' | 'F' = 'M', hongyan: 'sanming' | 'common' = 'sanming') =>
  computeShenSha(c, g, { wenchangMode: 'sanming', yinStemYangRen: false, hongyanMode: hongyan }).filter((h) => h.name === name && h.pillar === pillar);
const base = chart('甲子', '丙寅', '甲子', '甲子');
const withHour = (h: { stem: number; branch: number }): Ch => ({ ...base, hour: h });
const withDay = (d: { stem: number; branch: number }): Ch => ({ ...base, day: d });
const withYear = (y: { stem: number; branch: number }, h: { stem: number; branch: number }): Ch => ({ ...base, year: y, hour: h });

describe('神煞第四批：文本有表的（手写期望取自《三命通会》语料）', () => {
  it('天赦日：春戊寅、夏甲午、秋戊申、冬甲子（按月令季节）', () => {
    const c = (month: string, day: string) => ({ ...base, month: P(month), day: P(day) });
    expect(hit(c('丙寅', '戊寅'), '天赦日', 'day').length).toBe(1);
    expect(hit(c('丙午', '甲午'), '天赦日', 'day').length).toBe(1);
    expect(hit(c('丙申', '戊申'), '天赦日', 'day').length).toBe(1);
    expect(hit(c('丙子', '甲子'), '天赦日', 'day').length).toBe(1);
    expect(hit(c('丙午', '戊寅'), '天赦日', 'day').length).toBe(0);
  });
  it('日柱类：八专、九丑（四库本十日）、孤鸾、阴阳差错', () => {
    const lists: Record<string, string[]> = {
      八专日: ['甲寅', '乙卯', '己未', '丁未', '庚申', '辛酉', '戊戌', '癸丑'],
      九丑日: ['壬子', '壬午', '戊子', '戊午', '己酉', '己卯', '乙卯', '乙酉', '辛酉', '辛卯'],
      孤鸾煞: ['乙巳', '丁巳', '辛亥', '戊申', '甲寅', '丙午', '戊午', '壬子'],
      阴阳差错: ['丙子', '丁丑', '戊寅', '辛卯', '壬辰', '癸巳', '丙午', '丁未', '戊申', '辛酉', '壬戌', '癸亥'],
    };
    for (const [name, days] of Object.entries(lists)) {
      for (const d of days) expect(hit(withDay(P(d)), name, 'day').length, `${name}${d}`).toBe(1);
      expect(hit(base, name, 'day').length).toBe(0);
    }
    expect(hit(withDay(P('丁酉')), '九丑日', 'day').length).toBe(0); // bazi-lite 的丁酉是误列
  });
  it('红艳煞：默认《三命通会》原文表（戊子、壬巳），common 为通行表（戊辰、壬子）', () => {
    const orig: Record<string, string> = { 甲: '午', 乙: '午', 丙: '寅', 丁: '未', 戊: '子', 己: '辰', 庚: '戌', 辛: '酉', 壬: '巳', 癸: '申' };
    const com = { ...orig, 戊: '辰', 壬: '子' };
    for (const [g, b] of Object.entries(orig)) expect(hit({ ...base, day: raw(g, '子'), hour: raw('甲', b) }, '红艳煞', 'hour').length, `原文 ${g}${b}`).toBe(1);
    for (const [g, b] of Object.entries(com)) expect(hit({ ...base, day: raw(g, '子'), hour: raw('甲', b) }, '红艳煞', 'hour', 'M', 'common').length, `通行 ${g}${b}`).toBe(1);
    expect(hit({ ...base, day: raw('戊', '子'), hour: raw('甲', '辰') }, '红艳煞', 'hour').length).toBe(0); // 原文表下戊见子而非辰
  });
  it('六厄（申子辰卯、寅午戌酉、亥卯未午、巳酉丑子）与暗金煞（子午卯酉巳、寅申巳亥酉、辰戌丑未丑）', () => {
    for (const [yb, t] of [['申', '卯'], ['子', '卯'], ['寅', '酉'], ['午', '酉'], ['亥', '午'], ['卯', '午'], ['巳', '子'], ['酉', '子']]) expect(hit(withYear(raw('甲', yb), raw('甲', t)), '六厄', 'hour').length, `${yb}→${t}`).toBeGreaterThan(0);
    for (const [yb, t] of [['子', '巳'], ['午', '巳'], ['卯', '巳'], ['寅', '酉'], ['亥', '酉'], ['辰', '丑'], ['未', '丑']]) expect(hit(withYear(raw('甲', yb), raw('甲', t)), '暗金煞', 'hour').length, `${yb}→${t}`).toBeGreaterThan(0);
  });
  it('破煞：卯午、丑辰、子酉、未戌相破（两柱都标注），子午冲不算破', () => {
    const c: Ch = { year: raw('甲', '子'), month: raw('甲', '寅'), day: raw('甲', '辰'), hour: raw('甲', '酉') };
    expect(computeShenSha(c).filter((h) => h.name === '破煞').map((h) => h.pillar).sort()).toEqual(['hour', 'year']);
    const d: Ch = { year: raw('甲', '子'), month: raw('甲', '寅'), day: raw('甲', '辰'), hour: raw('甲', '午') };
    expect(computeShenSha(d).filter((h) => h.name === '破煞').length).toBe(0);
  });
  it('拱禄、拱贵：日时同干，地支夹住所拱之位（原文表）', () => {
    const gl: [string, string, string][] = [['癸', '亥', '丑'], ['癸', '丑', '亥'], ['丁', '巳', '未'], ['己', '未', '巳'], ['戊', '辰', '午']];
    for (const [g, x, y] of gl) expect(hit({ ...base, day: raw(g, x), hour: raw(g, y) }, '拱禄', 'day').length, `${g}${x}${y}`).toBe(1);
    const gg: [string, string, string][] = [['甲', '申', '戌'], ['乙', '未', '酉'], ['甲', '寅', '子'], ['戊', '申', '午'], ['辛', '丑', '卯']];
    for (const [g, x, y] of gg) expect(hit({ ...base, day: raw(g, x), hour: raw(g, y) }, '拱贵', 'day').length, `${g}${x}${y}`).toBe(1);
    expect(hit({ ...base, day: raw('癸', '亥'), hour: raw('甲', '丑') }, '拱禄', 'day').length).toBe(0); // 日时不同干
  });
  it('天福贵人（官星坐禄）：甲酉乙申（原文），丙子丁亥戊卯己寅庚午辛巳壬午癸巳（反推）', () => {
    const t = '酉申子亥卯寅午巳午巳';
    for (let i = 0; i < 10; i++) expect(hit({ ...base, day: raw(STEMS[i], '子'), hour: raw('甲', t[i]) }, '天福贵人', 'hour').length, STEMS[i]).toBeGreaterThan(0);
  });
  it('自缢煞（年支对应表）、挂剑煞、天火煞、宅墓煞、天屠煞', () => {
    const zi: [string, string][] = [['戌', '巳'], ['巳', '戌'], ['辰', '亥'], ['亥', '辰'], ['寅', '未'], ['未', '寅'], ['卯', '申'], ['申', '卯'], ['午', '丑'], ['丑', '午'], ['子', '酉'], ['酉', '子']];
    for (const [yb, t] of zi) expect(hit(withYear(raw('甲', yb), raw('甲', t)), '自缢煞', 'hour').length, `${yb}→${t}`).toBeGreaterThan(0);
    expect(computeShenSha({ year: raw('甲', '巳'), month: raw('甲', '酉'), day: raw('甲', '丑'), hour: raw('甲', '申') }).filter((h) => h.name === '挂剑煞').length).toBe(4);
    expect(computeShenSha({ year: raw('甲', '巳'), month: raw('甲', '酉'), day: raw('甲', '丑'), hour: raw('甲', '子') }).filter((h) => h.name === '挂剑煞').length).toBe(0);
    const fire: Ch = { year: raw('丙', '寅'), month: raw('甲', '午'), day: raw('丁', '戌'), hour: raw('庚', '子') };
    expect(computeShenSha(fire).filter((h) => h.name === '天火煞').length).toBe(3);
    expect(computeShenSha({ ...fire, hour: raw('壬', '子') }).filter((h) => h.name === '天火煞').length).toBe(0); // 天干见壬水则不成立
    expect(hit(withYear(raw('甲', '子'), raw('甲', '巳')), '宅墓煞', 'hour').length).toBe(1); // 子+5=巳（宅）
    expect(hit(withYear(raw('甲', '子'), raw('甲', '未')), '宅墓煞', 'hour').length).toBe(1); // 子-5=未（墓）
    for (const [d, h] of [['丑', '亥'], ['亥', '丑'], ['寅', '戌'], ['戌', '寅'], ['卯', '酉'], ['酉', '卯'], ['辰', '申'], ['申', '辰'], ['巳', '未'], ['未', '巳']]) expect(computeShenSha({ ...base, day: raw('甲', d), hour: raw('甲', h) }).filter((x) => x.name === '天屠煞').length, `${d}${h}`).toBe(2);
    expect(computeShenSha({ ...base, day: raw('甲', '子'), hour: raw('甲', '午') }).filter((x) => x.name === '天屠煞').length).toBe(0);
  });
  it('阴阳煞（男丙子女戊午为正；反之为相反）与戟锋煞（月令旺干，日时两重）', () => {
    expect(hit(withDay(P('丙子')), '阴阳煞', 'day', 'M')[0].basis).toContain('正阴');
    expect(hit(withDay(P('戊午')), '阴阳煞', 'day', 'F')[0].basis).toContain('正阳');
    expect(hit(withDay(P('戊午')), '阴阳煞', 'day', 'M')[0].basis).toContain('相反');
    expect(hit(withDay(P('丙子')), '阴阳煞', 'day', 'F')[0].basis).toContain('相反');
    // 寅月旺干甲；日、时都是甲 → 两重成立；只日为甲 → 仅一重
    const two: Ch = { year: P('甲子'), month: P('丙寅'), day: P('甲子'), hour: P('甲戌') };
    expect(hit(two, '戟锋煞', 'day')[0].qualified).toBe(true);
    expect(hit(two, '戟锋煞', 'hour')[0].qualified).toBe(true);
    const one: Ch = { ...two, hour: P('乙亥') };
    expect(hit(one, '戟锋煞', 'day')[0].qualified).toBe(false);
    expect(hit(one, '戟锋煞', 'hour').length).toBe(0);
    // 十二月旺干为己（原文写作“巳”，据规律取己）
    const dec: Ch = { year: P('甲子'), month: P('己丑'), day: P('己巳'), hour: P('己未') };
    expect(hit(dec, '戟锋煞', 'day')[0].qualified).toBe(true);
  });
  it('水溺煞：丙子、癸未、癸丑上带咸池或羊刃', () => {
    // 年支寅（寅午戌）咸池在卯；构造日柱丙子且日支子为咸池：申子辰年→咸池酉，故用年支申：咸池酉…不含子；用 亥卯未年→咸池子
    const c: Ch = { year: raw('乙', '亥'), month: P('丙寅'), day: P('丙子'), hour: P('甲子') };
    expect(computeShenSha(c).filter((h) => h.name === '水溺煞' && h.pillar === 'day').length).toBe(1);
    const no: Ch = { year: raw('甲', '寅'), month: P('丙寅'), day: P('丙子'), hour: P('甲子') }; // 寅午戌咸池在卯，丙日无羊刃在子
    expect(computeShenSha(no).filter((h) => h.name === '水溺煞').length).toBe(0);
  });
});

describe('神煞第四批：与 bazi-lite 比对与规则完整性', () => {
  it('3000 盘：bazi-lite 也有的名目逐柱一致（九丑日、拱禄拱贵的时柱除外，原因见 ADR-019）', () => {
    const MAP: Record<string, string> = { 天赦日: '天赦日', 八专日: '八专日', 孤鸾煞: '孤鸾煞', 阴阳差错: '阴差阳错', 红艳煞: '红艳煞', 飞刃: '飞刃', 福星贵人: '福星贵人', 国印贵人: '国印贵人', 天厨贵人: '天厨贵人', 天医: '天医', 血刃: '血刃', 流霞: '流霞', 披麻: '披麻', 金神: '金神', 童子: '童子', 十灵日: '十灵日', 六秀日: '六秀日', 四废日: '四废日', 地转: '地转', 天转: '天转', 日干学堂: '日干学堂', 日干词馆: '日干词馆' };
    const r = rng(303);
    const bad: string[] = [];
    for (let k = 0; k < 3000; k++) {
      const y = r.int(1902, 2099), m = r.int(1, 12), d = r.int(1, 28), h = r.int(0, 23), g = k % 2 ? 'F' : 'M';
      const c = computeCharts(solarInput(y, m, d, h, 10, g), { hongyanMode: 'common' }).bazi;
      const gg = g === 'M' ? GENDER.MALE : GENDER.FEMALE;
      const b = BaziChart.fromZonedTime(new ZonedTime({ year: y, month: m, day: d, hour: h, minute: 10, second: 0, offsetMinutes: 480 }), new BaziOptions({ gender: gg, mode: 'china-astronomical', pillarHistoricalMode: 'off' } as never));
      const o = collectNatalShenSha(b as never, { gender: gg } as never) as unknown as Record<PillarKey, bigint>;
      for (const pk of ['year', 'month', 'day', 'hour'] as PillarKey[]) {
        const theirs = new Set(shenShaNames(o[pk]));
        const mine = new Set(c.shensha.filter((x) => x.pillar === pk).map((x) => x.name as string));
        for (const [mn, tn] of Object.entries(MAP)) if (mine.has(mn) !== theirs.has(tn)) bad.push(`${y}-${m}-${d} ${h} ${g} ${pk} ${mn}`);
        for (const n of ['拱禄', '拱贵']) if (pk === 'day' && mine.has(n) !== theirs.has(n)) bad.push(`${y}-${m}-${d} ${h} ${g} ${pk} ${n}`);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
  it('每个新增名目都有规则：文本类在 bz.shensha.*，现代类在 modern_shensha.*；分级与引文规则符合', () => {
    expect(EXTRA_NAMES.length).toBe(37);
    for (const n of EXTRA_NAMES) {
      const isText = (EXTRA_TEXT_NAMES as readonly string[]).includes(n);
      const r = RULES.byId.get(`${isText ? 'bz' : 'modern'}${isText ? '.shensha.' : '_shensha.'}${n}`)!;
      expect(r, n).toBeDefined();
      expect(r.sourceClass, n).toBeDefined();
      if (isText) expect(r.classical.length, n).toBeGreaterThan(0);
      else { expect(r.classical, n).toHaveLength(0); expect(['MODERN_COMMON', 'IMPLEMENTATION_ONLY']).toContain(r.sourceClass); }
    }
    expect(SHENSHA_NAMES.length).toBe(78);
    expect(validateRules(RULES)).toEqual([]);
  });
});
