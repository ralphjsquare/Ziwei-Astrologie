import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium, type Browser, type Page } from 'playwright-core';
import { computeCharts } from '../src/index';
import type { BirthInput } from '../src/core/types';
import golden from './fixtures/golden.json';
import { rng } from './helpers';

const CHROME = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
let server: Server, browser: Browser, page: Page, base = '';

describe.skipIf(!CHROME)('端到端：浏览器中排盘、解读、存档、导出，并与 Node 逐字节一致', () => {
  beforeAll(async () => {
    const r = spawnSync('npx', ['vite', 'build', '--config', 'web/vite.config.ts'], { encoding: 'utf8' });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    server = createServer((req, res) => {
      const p = join('dist', req.url === '/' || !req.url ? 'index.html' : req.url.split('?')[0]);
      if (!existsSync(p)) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' }).end(readFileSync(p));
    });
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
    browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
    page = await browser.newPage({ viewport: { width: 1100, height: 1300 } });
    await page.goto(base);
  }, 120000);
  afterAll(async () => { await browser?.close(); server?.close(); });

  it('输入 → 排盘：命盘、八字四柱与样例一致', async () => {
    await page.fill('#y', '1990'); await page.fill('#m', '6'); await page.fill('#d', '15');
    await page.fill('#hh', '10'); await page.fill('#mm', '30');
    await page.click('button[type=submit]');
    await page.waitForSelector('.chart');
    const text = await page.innerText('#out');
    expect(text).toContain('火六局');
    expect(text).toContain('庚午 壬午 辛亥 癸巳');
    expect(await page.locator('.pal').count()).toBe(12);
    mkdirSync(process.env.E2E_SHOT_DIR ?? '.scratch', { recursive: true });
    await page.screenshot({ path: join(process.env.E2E_SHOT_DIR ?? '.scratch', 'chart.png'), fullPage: true });
  }, 60000);

  it('点击星曜显示三层解释（白话、依据等级、出处、古籍原文栏）', async () => {
    await page.click('.star.major[data-star="紫微"]');
    const d = await page.innerText('#detail');
    expect(d).toContain('紫微');
    expect(d).toContain('流派观点');
    expect(d).toContain('未审核');
    expect(await page.locator('#detail details').count()).toBeGreaterThan(0);
    expect(await page.innerText('#detail')).toContain('古籍原文');
  });

  it('时间层、对照、解读页可打开且有内容；对照页含免责声明', async () => {
    await page.click('[data-tab=time]');
    expect(await page.innerText('#out')).toContain('紫微流年');
    await page.fill('#yr', '2030'); await page.dispatchEvent('#yr', 'change');
    expect(await page.innerText('#out')).toContain('2030 年');
    await page.click('[data-tab=cross]');
    expect(await page.innerText('#out')).toContain('不构成独立证据');
    await page.click('[data-tab=read]');
    const t = await page.innerText('#out');
    expect(t).toContain('紫微·命宫');
    expect(t).toContain('八字·旺衰、格局、用神（候选）');
    expect(await page.locator('.item').count()).toBeGreaterThan(30);
  });

  it('输入错误与范围外给出明确提示', async () => {
    await page.fill('#y', '2200');
    await page.click('button[type=submit]');
    expect(await page.innerText('#msg')).toContain('输入有误');
    await page.fill('#y', '1990');
  });

  it('存档：保存 → 刷新页面后仍在 → 打开重算 → 导出', async () => {
    await page.click('button[type=submit]');
    await page.click('[data-tab=archive]');
    await page.fill('#sn', '测试盘'); await page.click('#save');
    await page.waitForSelector('[data-open]');
    await page.reload();
    await page.click('[data-tab=archive]');
    await page.waitForSelector('[data-open]');
    expect(await page.innerText('#out')).toContain('测试盘');
    await page.click('[data-open]');
    await page.waitForSelector('.chart');
    expect(await page.innerText('#out')).toContain('庚午 壬午 辛亥 癸巳');
    await page.click('[data-tab=archive]');
    await page.waitForSelector('#exp');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exp')]);
    expect(dl.suggestedFilename()).toBe('ziwei-archive.json');
  }, 60000);

  it('设置页导出审核文档', async () => {
    await page.click('[data-tab=settings]');
    await page.selectOption('#rf', 'csv');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#rexp')]);
    expect(dl.suggestedFilename()).toBe('review-all.csv');
  });

  it('手机宽度下无横向溢出', async () => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.click('[data-tab=chart]').catch(() => undefined);
    const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(over).toBe(false);
    await page.setViewportSize({ width: 1100, height: 1300 });
  });

  it('跨环境一致：浏览器与 Node 对 60 个黄金输入 + 200 个随机输入，计算结果逐字节相同', async () => {
    const r = rng(2026);
    const inputs: BirthInput[] = golden.cases.map((c) => c.input as BirthInput);
    for (let k = 0; k < 200; k++) {
      inputs.push({ calendar: 'solar', year: r.int(1901, 2100), month: r.int(1, 12), day: r.int(1, 28), hour: r.int(0, 23), minute: r.int(0, 59), gender: r.next() < 0.5 ? 'M' : 'F', place: { utcOffsetMinutes: 480, dstMinutes: 0 } });
    }
    // 含真太阳时与农历输入
    inputs.push({ calendar: 'solar', year: 1985, month: 3, day: 9, hour: 12, minute: 0, gender: 'M', place: { utcOffsetMinutes: 480, dstMinutes: 0, longitude: 87.6 } });
    inputs.push({ calendar: 'lunar', year: 2023, month: 2, day: 5, leap: true, hour: 10, minute: 0, gender: 'F', place: { utcOffsetMinutes: 480, dstMinutes: 0 } });
    const optsFor = (i: number) => (i >= inputs.length - 2 && i === inputs.length - 2 ? { trueSolarTime: true } : {});
    const inBrowser = await page.evaluate(([ins, ]) => {
      const w = window as unknown as { __zw: { computeCharts: (i: unknown, o?: unknown) => unknown } };
      return (ins as { input: unknown; opt: unknown }[]).map((x) => JSON.stringify(w.__zw.computeCharts(x.input, x.opt)));
    }, [inputs.map((input, i) => ({ input, opt: optsFor(i) }))] as const);
    const bad: number[] = [];
    inputs.forEach((input, i) => { if (JSON.stringify(computeCharts(input, optsFor(i))) !== inBrowser[i]) bad.push(i); });
    expect(bad).toEqual([]);
  }, 120000);
});
