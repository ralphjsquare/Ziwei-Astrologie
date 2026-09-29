import { describe, expect, it } from 'vitest';
import { astro } from 'iztro';
import { computeCharts, BRANCHES, ziweiYearLayer } from '../src/index';
import { rng, solarInput } from './helpers';

// 小限：期望值来自 iztro 每个宫位的 ages（虚岁列表），不取自本引擎。
describe('紫微小限（对照 iztro）', () => {
  it('300 个随机盘 × 虚岁 1–100：小限落宫与 iztro 一致（男顺女逆，起宫由出生年支定）', () => {
    const r = rng(20261001);
    for (let k = 0; k < 300; k++) {
      const y = r.int(1902, 2000), m = r.int(1, 12), d = r.int(1, 28), h = r.int(0, 22), g = r.next() < 0.5 ? 'M' : 'F';
      const c = computeCharts(solarInput(y, m, d, h, r.int(0, 59), g)).ziwei;
      const a = astro.bySolar(`${y}-${m}-${d}`, Math.floor(((h + 1) % 24) / 2), g === 'M' ? '男' : '女', true, 'zh-CN');
      const at = new Map<number, string>();
      for (const p of a.palaces) for (const age of p.ages) at.set(age, p.earthlyBranch);
      for (let age = 1; age <= 100; age += 3) {
        const layer = ziweiYearLayer(c, c.input.lunarYear + age - 1);
        expect(BRANCHES[layer.minorLimit.branch], `${y}-${m}-${d} ${g} 虚岁${age}`).toBe(at.get(age));
      }
    }
  });
  it('《全书》安小限诀：四组起宫（寅午戌辰、申子辰戌、巳酉丑未、亥卯未丑）', () => {
    const cases: [string, string][] = [['寅', '辰'], ['午', '辰'], ['戌', '辰'], ['申', '戌'], ['子', '戌'], ['辰', '戌'], ['巳', '未'], ['酉', '未'], ['丑', '未'], ['亥', '丑'], ['卯', '丑'], ['未', '丑']];
    for (const [yb, start] of cases) {
      // 找一个该年支的出生年
      const yr = [...Array(60).keys()].map((i) => 1904 + i).find((y) => BRANCHES[(y - 4) % 12] === yb)!;
      const c = computeCharts(solarInput(yr, 6, 15, 10, 0, 'M')).ziwei;
      expect(BRANCHES[ziweiYearLayer(c, c.input.lunarYear).minorLimit.branch]).toBe(start);
    }
  });
});
