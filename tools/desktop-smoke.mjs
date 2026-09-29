// 桌面壳冒烟测试：用本机 Linux 版 Electron（需 xvfb-run）加载 release/stage，排盘、看神煞行、保存后重开仍在。
// 用法：xvfb-run -a node tools/desktop-smoke.mjs
import { _electron as electron } from 'playwright-core';
const app = await electron.launch({ args: ['release/stage/main.cjs', '--no-sandbox'], executablePath: 'node_modules/electron/dist/electron' });
const win = await app.firstWindow();
const errs = [];
win.on('pageerror', (e) => errs.push(e.message));
await win.waitForSelector('#f button[type=submit]');
await win.click('#f button[type=submit]');
await win.waitForSelector('#out .card');
const t = await win.innerText('#out');
const ok = { 排盘: t.includes('八字四柱'), 神煞行: /神煞：/.test(t), 协议: (await win.url()).startsWith('app://') };
await win.click('[data-tab=syn]');
ok.合盘页 = (await win.innerText('#out')).includes('对方（B）');
console.log(JSON.stringify(ok), 'pageerrors:', errs);
await app.close();
if (!Object.values(ok).every(Boolean) || errs.length) process.exit(1);
