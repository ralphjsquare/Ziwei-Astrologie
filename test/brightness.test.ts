import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { astro } from 'iztro';
import { computeCharts, BRANCHES } from '../src/index';
import { BRIGHTNESS } from '../src/ziwei/brightness.generated';
import { rng, solarInput } from './helpers';

const M: Record<string, string> = { 庙: '庙', 旺: '旺', 得: '得地', 利: '利益', 平: '平和', 不: '不得地', 陷: '落陷' };

describe('星曜庙旺利陷（《全书》卷二表）', () => {
  it('生成文件与转录本重新解析的结果一致（表格没有被手改）', () => {
    const before = readFileSync('src/ziwei/brightness.generated.ts', 'utf8');
    execFileSync('npx', ['tsx', 'tools/gen-brightness.ts'], { stdio: 'pipe' });
    expect(readFileSync('src/ziwei/brightness.generated.ts', 'utf8')).toBe(before);
  });
  it('十四主星每宫都有等级；全书表规模：21 颗星', () => {
    expect(Object.keys(BRIGHTNESS)).toHaveLength(21);
    for (const s of ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军']) expect(Object.keys(BRIGHTNESS[s])).toHaveLength(12);
  });
  it('对照 iztro：300 个随机盘，主星与昌曲、火铃、羊陀的亮度一致（iztro 不给禄存定等级，不比较）', () => {
    const r = rng(20261002);
    const bad: string[] = [];
    for (let k = 0; k < 300; k++) {
      const y = r.int(1902, 2099), m = r.int(1, 12), d = r.int(1, 28), h = r.int(0, 22), g = r.next() < 0.5 ? 'M' : 'F';
      const c = computeCharts(solarInput(y, m, d, h, r.int(0, 59), g)).ziwei;
      const a = astro.bySolar(`${y}-${m}-${d}`, Math.floor(((h + 1) % 24) / 2), g === 'M' ? '男' : '女', true, 'zh-CN');
      for (const p of c.palaces) {
        const ip = a.palaces.find((x) => x.earthlyBranch === BRANCHES[p.branch])!;
        for (const s of p.stars) {
          if (s.name === '禄存') continue;
          const is = [...ip.majorStars, ...ip.minorStars].find((x) => x.name === s.name);
          if (!is) continue;
          const exp = M[is.brightness as string] ?? undefined;
          if (exp !== s.brightness) bad.push(`${y}-${m}-${d} ${s.name}@${BRANCHES[p.branch]} 引擎${s.brightness} iztro${is.brightness}`);
        }
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
});
