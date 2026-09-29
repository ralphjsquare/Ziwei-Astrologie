// 下载工具：通过 curl（自动使用系统代理与 CA 配置），带重试与礼貌延时。Node 内置 fetch 不读取代理环境变量，故不用它。
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
export const UA = 'ziwei-astrologie-research/0.2 (open-source research; non-commercial)';
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function httpGet(url: string, retries = 4): Promise<string> {
  let lastErr = '';
  for (let i = 0; i <= retries; i++) {
    try {
      const { stdout } = await run('curl', ['-sS', '-L', '-m', '60', '-A', UA, '-w', '\n%{http_code}', url], { maxBuffer: 256 * 1024 * 1024 });
      const idx = stdout.lastIndexOf('\n');
      const code = Number(stdout.slice(idx + 1));
      const body = stdout.slice(0, idx);
      if (code === 200) return body;
      lastErr = `HTTP ${code}`;
      if (code === 404) break;
      if (code === 429) await sleep(5000 * (i + 1));
    } catch (e) { lastErr = (e as Error).message.split('\n')[0]; }
    await sleep(1500 * (i + 1));
  }
  throw new Error(`${lastErr} ${url}`);
}
