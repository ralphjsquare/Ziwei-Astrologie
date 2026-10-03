import { describe, expect, it } from 'vitest';
import { astro } from 'iztro';
import { computeCharts, BRANCHES } from '../src/index';
import { rng, solarInput } from './helpers';

// 长生、博士、将前、岁前十二神与子斗。期望值：外部软件“吉真紫微”的截图转录（1993-11-21 16:15 女、1988-04-02 07:50 男）与 iztro 的逐盘比对，不取自本引擎。
const at = (z: any, br: string) => z.palaces.find((p: any) => BRANCHES[p.branch] === br).gods;

describe('四组十二神与子斗：与吉真紫微对照（1993-11-21 女，阴女顺行，水二局）', () => {
  const z = computeCharts(solarInput(1993, 11, 21, 16, 15, 'F')).ziwei;
  const sheet: Record<string, [string, string, string, string]> = {
    // 支：长生，博士，将前，岁前
    子: ['帝旺', '博士', '息神', '贯索'], 丑: ['衰', '力士', '华盖', '官符'], 寅: ['病', '青龙', '劫煞', '小耗'], 卯: ['死', '小耗', '灾煞', '岁破'],
    辰: ['墓', '将军', '天煞', '龙德'], 巳: ['绝', '奏书', '指背', '白虎'], 午: ['胎', '飞廉', '咸池', '天德'], 未: ['养', '喜神', '月煞', '吊客'],
    申: ['长生', '病符', '亡神', '病符'], 酉: ['沐浴', '大耗', '将星', '岁建'], 戌: ['冠带', '伏兵', '攀鞍', '晦气'], 亥: ['临官', '官府', '岁驿', '丧门'],
  };
  it('十二宫逐宫一致（岁前第一神软件与 iztro 均称“岁建”，即常说的太岁）', () => {
    for (const [br, [cs, bs, jq, sq]] of Object.entries(sheet)) {
      const g = at(z, br);
      expect([g.changSheng, g.boShi, g.jiangQian, g.suiQian], br).toEqual([cs, bs, jq, sq]);
    }
  });
  it('子斗：1993 女落亥；1988 男落卯', () => {
    expect(BRANCHES[z.ziDou]).toBe('亥');
    expect(BRANCHES[computeCharts(solarInput(1988, 4, 2, 7, 50, 'M')).ziwei.ziDou]).toBe('卯');
  });
});

describe('与 iztro 逐盘比对（500 个随机盘，男女、阴阳年）', () => {
  // iztro 把岁前第七神称“大耗”，吉真紫微称“岁破”；位置相同，本项目取软件称法
  it('长生、博士、将前、岁前十二神一致', () => {
    const r = rng(2024);
    for (let k = 0; k < 500; k++) {
      const y = r.int(1902, 2099), m = r.int(1, 12), d = r.int(1, 28), h = r.int(0, 22), g = r.next() < 0.5 ? 'M' : 'F';
      const c = computeCharts(solarInput(y, m, d, h, 0, g)).ziwei;
      const a = astro.bySolar(`${y}-${m}-${d}`, Math.floor(((h + 1) % 24) / 2), g === 'M' ? '男' : '女', true, 'zh-CN');
      for (const p of a.palaces) {
        const mine = at(c, p.earthlyBranch);
        expect([mine.changSheng, mine.boShi, mine.jiangQian, mine.suiQian], `${y}-${m}-${d} ${g} ${p.earthlyBranch}`).toEqual([p.changsheng12, p.boshi12, p.jiangqian12, p.suiqian12 === '大耗' ? '岁破' : p.suiqian12]);
      }
    }
  });
});
