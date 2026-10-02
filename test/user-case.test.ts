import { describe, expect, it } from 'vitest';
import { astro } from 'iztro';
import { computeCharts, BRANCHES, STEMS } from '../src/index';
import { rng, solarInput } from './helpers';

// 外部成熟软件对照：用户本人的盘，在“吉真紫微”（紫微）与“问真八字”（八字）两款软件中的结果（截图转录，2026-10-02）。
// 出生：1988-04-02 07:50（北京时间，辰时），男；农历戊辰年二月十六。期望值来自这两款软件，不来自本引擎。
const b = computeCharts({ calendar: 'solar', year: 1988, month: 4, day: 2, hour: 7, minute: 50, gender: 'M', place: { utcOffsetMinutes: 480, dstMinutes: 0 } });
const z = b.ziwei, bz = b.bazi;
const palace = (gz: string) => z.palaces.find((p) => STEMS[p.stem] + BRANCHES[p.branch] === gz)!;
const names = (gz: string) => palace(gz).stars.map((s) => s.name);

describe('用户本人的盘：与吉真紫微对照', () => {
  it('基本信息：阳男水二局，命宫亥、身宫未，命主巨门、身主文昌，农历二月十六', () => {
    expect(b.resolved.clockLunar).toMatchObject({ year: 1988, month: 2, day: 16, leap: false });
    expect(z.fiveElementBureau.name).toBe('水二局');
    expect(z.decadeDirection).toBe(1);
    expect(BRANCHES[z.mingBranch]).toBe('亥');
    expect(BRANCHES[z.bodyBranch]).toBe('未');
    expect(z.mingZhu).toBe('巨门');
    expect(z.shenZhu).toBe('文昌');
  });
  it('十二宫：干支、宫名、星曜（软件显示的主星与六吉六煞、禄存天马天喜红鸾）', () => {
    const exp: Record<string, [string, string[]]> = {
      丁巳: ['迁移', ['武曲', '破军', '左辅', '禄存', '天喜']], 戊午: ['疾厄', ['太阳', '文昌', '火星', '擎羊']], 己未: ['财帛', ['天府', '天钺', '地空']],
      庚申: ['子女', ['天机', '太阴', '文曲']], 辛酉: ['夫妻', ['紫微', '贪狼', '右弼']], 壬戌: ['兄弟', ['巨门']], 癸亥: ['命宫', ['天相', '红鸾']],
      甲子: ['父母', ['天梁']], 乙丑: ['福德', ['廉贞', '七杀', '天魁']], 甲寅: ['田宅', ['天马', '铃星']], 乙卯: ['官禄', ['地劫']], 丙辰: ['交友', ['天同', '陀罗']],
    };
    for (const [gz, [pn, st]] of Object.entries(exp)) {
      expect(palace(gz).name, gz).toBe(pn);
      expect([...names(gz)].sort(), gz).toEqual([...st].sort());
    }
    expect(palace('己未').isBody).toBe(true);
  });
  it('庙旺利陷（软件显示的主星与火星、擎羊、禄存、文昌、文曲、陀罗、铃星）', () => {
    const br = (gz: string, star: string) => palace(gz).stars.find((s) => s.name === star)!.brightness;
    const map: Record<string, string> = { 庙: '庙', 旺: '旺', 得: '得地', 利: '利益', 平: '平和', 不: '不得地', 陷: '落陷' };
    const exp: [string, string, string][] = [['丁巳', '武曲', '平'], ['丁巳', '破军', '平'], ['丁巳', '禄存', '庙'], ['戊午', '太阳', '旺'], ['戊午', '文昌', '陷'], ['戊午', '火星', '庙'], ['戊午', '擎羊', '陷'],
      ['己未', '天府', '庙'], ['庚申', '天机', '得'], ['庚申', '太阴', '利'], ['庚申', '文曲', '得'], ['辛酉', '紫微', '旺'], ['辛酉', '贪狼', '利'], ['壬戌', '巨门', '陷'], ['癸亥', '天相', '得'],
      ['甲子', '天梁', '庙'], ['乙丑', '廉贞', '利'], ['乙丑', '七杀', '庙'], ['甲寅', '铃星', '庙'], ['丙辰', '天同', '平'], ['丙辰', '陀罗', '庙']];
    for (const [gz, star, g] of exp) expect(br(gz, star), `${gz}${star}`).toBe(map[g]);
  });
  it('四化（戊年：贪狼禄、太阴权、右弼科、天机忌）与大限、小限', () => {
    const tf = Object.fromEntries(z.palaces.flatMap((p) => p.stars.filter((s) => s.transform).map((s) => [s.name, s.transform])));
    expect(tf).toEqual({ 贪狼: '禄', 太阴: '权', 右弼: '科', 天机: '忌' });
    const dec: Record<string, number> = { 癸亥: 2, 甲子: 12, 乙丑: 22, 甲寅: 32, 乙卯: 42, 丙辰: 52, 丁巳: 62, 戊午: 72, 己未: 82, 庚申: 92, 辛酉: 102, 壬戌: 112 };
    for (const [gz, a] of Object.entries(dec)) expect(palace(gz).decade.startAge, gz).toBe(a);
    // 小限：虚岁1岁起戌宫，男顺行（软件各宫小限：戌1、亥2、子3、丑4、寅5、卯6、辰7、巳8、午9、未10、申11、酉12）
    const xiao = 'xyz';
    void xiao;
  });
  it('流年小限与斗君：1988 年（虚岁1）小限落戌，流斗落未', async () => {
    const { ziweiYearLayer } = await import('../src/index');
    const l = ziweiYearLayer(z, 1988);
    expect(BRANCHES[l.minorLimit.branch]).toBe('戌');
    expect(BRANCHES[l.douJunBranch]).toBe('未');
    for (let age = 1; age <= 12; age++) expect(BRANCHES[ziweiYearLayer(z, 1987 + age).minorLimit.branch]).toBe('戌亥子丑寅卯辰巳午未申酉'[age - 1]);
  });
});

describe('用户本人的盘：与问真八字对照', () => {
  const P = (k: 'year' | 'month' | 'day' | 'hour') => STEMS[bz.pillars[k].stem] + BRANCHES[bz.pillars[k].branch];
  it('四柱、纳音、藏干、十神、日主在各支的长生', () => {
    expect([P('year'), P('month'), P('day'), P('hour')]).toEqual(['戊辰', '乙卯', '丁亥', '甲辰']);
    expect((['year', 'month', 'day', 'hour'] as const).map((k) => bz.pillars[k].nayin)).toEqual(['大林木', '大溪水', '屋上土', '覆灯火']);
    expect((['year', 'month', 'day', 'hour'] as const).map((k) => bz.pillars[k].hidden.map((h) => STEMS[h.stem]).join(''))).toEqual(['戊乙癸', '乙', '壬甲', '戊乙癸']);
    expect([bz.pillars.year.stemTenGod, bz.pillars.month.stemTenGod, bz.pillars.hour.stemTenGod]).toEqual(['伤官', '偏印', '正印']);
    expect((['year', 'month', 'day', 'hour'] as const).map((k) => bz.pillars[k].longSheng)).toEqual(['衰', '病', '胎', '衰']);
  });
  it('各柱旬空（软件“空亡”行：戌亥、子丑、午未、寅卯）', () => {
    const br = (k: 'year' | 'month' | 'day' | 'hour') => bz.kongWangByPillar[k].map((x) => BRANCHES[x]).join('');
    expect([br('year'), br('month'), br('day'), br('hour')]).toEqual(['戌亥', '子丑', '午未', '寅卯']);
  });
  it('神煞：软件显示的各项本系统都能算出（软件日柱栏被截断，只比较可见部分）', () => {
    const has = (k: 'year' | 'month' | 'day' | 'hour', n: string) => bz.shensha.some((h) => h.pillar === k && h.name === n);
    const exp: Record<string, string[]> = { year: ['太极贵人'], month: ['太极贵人', '德秀贵人', '将星'], day: ['十恶大败', '天乙贵人', '福星贵人', '德秀贵人', '飞刃', '亡神'], hour: ['太极贵人', '月德贵人', '德秀贵人', '华盖'] };
    for (const [k, list] of Object.entries(exp)) for (const n of list) expect(has(k as 'year', n), `${k}${n}`).toBe(true);
    // 日柱在软件里还显示“空亡”：日支亥落年柱旬空（戌亥）
    expect(bz.kongWangByPillar.year.includes(bz.pillars.day.branch)).toBe(true);
    // 软件对年柱只显示“太极贵人”：年柱的“华盖”是年支自己（辰为申子辰的华盖），本系统不计基准柱自身，因此不出现
    expect(has('year', '华盖')).toBe(false);
  });
});

describe('命主、身主对照 iztro', () => {
  it('300 个随机盘：命主、身主与 iztro 一致（iztro 称子午年身主为“铃星”，本项目取全书“火星”并列为同一项，不比较该项名称）', () => {
    const r = rng(88);
    for (let k = 0; k < 300; k++) {
      const y = r.int(1902, 2099), m = r.int(1, 12), d = r.int(1, 28), h = r.int(0, 22), g = r.next() < 0.5 ? 'M' : 'F';
      const c = computeCharts(solarInput(y, m, d, h, 0, g)).ziwei;
      const a = astro.bySolar(`${y}-${m}-${d}`, Math.floor(((h + 1) % 24) / 2), g === 'M' ? '男' : '女', true, 'zh-CN');
      expect(c.mingZhu, `${y}-${m}-${d}`).toBe(a.soul);
      const body = c.yearBranch % 6 === 0 ? ['火星', '铃星'] : [c.shenZhu];
      expect(body, `${y}-${m}-${d}`).toContain(a.body);
    }
  });
});
