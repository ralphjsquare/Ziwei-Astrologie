// 打包 Windows 桌面版（免安装文件夹，内含 ZiweiBazi.exe）。用法：npm run desktop:win
// 步骤：vite 构建 → 把 dist + desktop/main.cjs 放进临时应用目录 → @electron/packager 生成 win32-x64 → 压缩成 zip。
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { packager } from '@electron/packager';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const STAGE = 'release/stage';
rmSync('release', { recursive: true, force: true });
execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
mkdirSync(STAGE, { recursive: true });
cpSync('dist', `${STAGE}/dist`, { recursive: true });
cpSync('desktop/main.cjs', `${STAGE}/main.cjs`);
writeFileSync(`${STAGE}/package.json`, JSON.stringify({ name: 'ziwei-bazi', productName: 'ZiweiBazi', version: pkg.version, main: 'main.cjs', description: '紫微斗数与八字排盘（本地运行）' }, null, 2));
const out = await packager({ dir: STAGE, out: 'release', name: 'ZiweiBazi', platform: 'win32', arch: 'x64', overwrite: true, prune: false, asar: true, appVersion: pkg.version });
console.log('已生成：', out.join(', '));
for (const d of out) {
  const zip = `${d}.zip`;
  execFileSync('python3', ['-c', `import shutil,sys;shutil.make_archive(sys.argv[1][:-4],'zip',root_dir=sys.argv[2])`, zip, d]);
  console.log('压缩包：', zip, existsSync(zip));
}
