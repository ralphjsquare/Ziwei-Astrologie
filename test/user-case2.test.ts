import { describe, expect, it } from 'vitest';
import { computeCharts, BRANCHES, STEMS } from '../src/index';
import { ziweiYearLayer } from '../src/ziwei/timelayers';
import { computeShenSha } from '../src/bazi/shensha';

// 外部成熟软件对照（第二个盘）：吉真紫微＋问真八字，1993-11-21 北京时间16:15（真太阳时16:06），申时，农历癸酉年十月初八（截图转录，2026-10-03）。
// 女命（紫微“阴女”；问真八字重新输入后为“坤造”，首次截图误输入为男）。期望值来自软件，不来自本引擎。
const b: any = computeCharts({ calendar: 'solar', year: 1993, month: 11, day: 21, hour: 16, minute: 15, gender: 'F', place: { utcOffsetMinutes: 480, dstMinutes: 0 } } as any);
const z = b.ziwei, bz = b.bazi;
const palace = (gz: string) => z.palaces.find((p: any) => STEMS[p.stem] + BRANCHES[p.branch] === gz);

describe('第二个盘：与吉真紫微对照', () => {
  it('基本信息', () => {
    expect(b.resolved.clockLunar).toMatchObject({ year: 1993, month: 10, day: 8, leap: false });
    expect(z.fiveElementBureau.name).toBe('水二局');
    expect([BRANCHES[z.mingBranch], BRANCHES[z.bodyBranch], z.mingZhu, z.shenZhu]).toEqual(['卯', '未', '文曲', '天同']);
  });
  it('十二宫星曜、庙旺、宫名、大限起岁', () => {
    const exp: Record<string, [string, string[], number]> = {
      丁巳: ['福德', ['紫微旺', '七杀平和', '天钺'], 22], 戊午: ['田宅', ['铃星庙', '红鸾'], 32], 己未: ['官禄', ['地劫'], 42], 庚申: ['交友', [], 52],
      辛酉: ['迁移', ['廉贞平和', '破军落陷'], 62], 壬戌: ['疾厄', [], 72], 癸亥: ['财帛', ['天府得地', '天马', '陀罗落陷', '火星利益'], 82],
      甲子: ['子女', ['天同旺', '太阴庙', '文曲得地', '禄存庙', '天喜'], 92], 乙丑: ['夫妻', ['武曲庙', '贪狼庙', '左辅', '右弼', '擎羊庙'], 102],
      甲寅: ['兄弟', ['太阳旺', '巨门庙', '文昌落陷'], 112], 乙卯: ['命宫', ['天相落陷', '天魁', '地空'], 2], 丙辰: ['父母', ['天机利益', '天梁庙'], 12],
    };
    for (const [gz, [pn, st, age]] of Object.entries(exp)) {
      const p = palace(gz);
      expect(p.name, gz).toBe(pn);
      expect(p.decade.startAge, gz).toBe(age);
      // 期望里两字名只比对名称（软件对其庙旺另有标注，未转录）；带庙旺字样的按全名比对
      const got = p.stars.map((s: any) => s.name + s.brightness);
      for (const e of st) {
        expect(got.some((g: string) => g.startsWith(e.slice(0, 2)) && (e.length === 2 || g === e)), `${gz} ${e}`).toBe(true);
      }
    }
  });
  it('四化（癸干）：破军禄、巨门权、太阴科、贪狼忌；小限 1993 虚1岁在未，逆行', () => {
    expect(z.fourTransforms).toMatchObject({ lu: '破军', quan: '巨门', ke: '太阴', ji: '贪狼' });
    const xb = [1993, 1994, 1995, 1996, 1997].map((y) => BRANCHES[ziweiYearLayer(z, y).minorLimit.branch]);
    expect(xb).toEqual(['未', '午', '巳', '辰', '卯']);
  });
});

describe('第二个盘：与问真八字对照', () => {
  it('四柱、纳音、星运、各柱空亡', () => {
    const p = bz.pillars;
    expect(['year', 'month', 'day', 'hour'].map((k) => STEMS[p[k].stem] + BRANCHES[p[k].branch])).toEqual(['癸酉', '癸亥', '丙午', '丙申']);
    expect(['year', 'month', 'day', 'hour'].map((k) => p[k].nayin)).toEqual(['剑锋金', '大海水', '天河水', '山下火']);
    expect(['year', 'month', 'day', 'hour'].map((k) => p[k].longSheng)).toEqual(['死', '绝', '帝旺', '病']);
    expect(['year', 'month', 'day', 'hour'].map((k) => bz.kongWangByPillar[k].map((i: number) => BRANCHES[i]).join(''))).toEqual(['戌亥', '子丑', '寅卯', '辰巳']);
  });
  it('十神：正官 正官 — 比肩', () => {
    expect(['year', 'month', 'hour'].map((k) => bz.pillars[k].stemTenGod)).toEqual(['正官', '正官', '比肩']);
  });
  it('神煞：软件可见项在本引擎中均出现', () => {
    const has = (n: string, k: string) => bz.shensha.some((h: any) => h.name.startsWith(n) && h.pillar === k);
    const exp: [string, string][] = [['天乙贵人', 'year'], ['太极贵人', 'year'], ['天乙贵人', 'month'], ['驿马', 'month'], ['孤辰', 'month'], ['丧门', 'month'], ['血刃', 'month'], ['劫煞', 'month'],
      ['阴阳差错', 'day'], ['六秀日', 'day'], ['孤鸾煞', 'day'], ['四废日', 'day'], ['羊刃', 'day'], ['咸池', 'day'], ['红鸾', 'day'], ['披麻', 'day'],
      ['太极贵人', 'hour'], ['国印贵人', 'hour'], ['亡神', 'hour'], ['驿马', 'hour']];
    for (const [n, k] of exp) expect(has(n, k), `${k}${n}`).toBe(true);
  });
  it('文昌贵人：软件取通行表（丙→申），默认三命通会表无此项，切换 common 后一致', () => {
    const f = (m: 'sanming' | 'common') => computeShenSha(bz.pillars, 'F', { wenchangMode: m, yinStemYangRen: false }).some((h) => h.name === '文昌贵人' && h.pillar === 'hour');
    expect(f('sanming')).toBe(false);
    expect(f('common')).toBe(true);
  });
});
