// 生成单文件网页版 release/ziwei-bazi.html：把构建好的 JS、CSS 内联进 index.html，双击即可在浏览器打开，无需服务器、不联网。
// 用法：npm run build:html
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
let html = readFileSync('dist/index.html', 'utf8');
const assets = readdirSync('dist/assets');
const read = (name) => readFileSync(`dist/assets/${name}`, 'utf8');
const js = assets.filter((f) => f.endsWith('.js'));
const css = assets.filter((f) => f.endsWith('.css'));
if (js.length !== 1) throw new Error(`期望单个 JS 包，实际 ${js.length} 个：请检查构建是否拆分了代码块`);
// 去掉外部引用，改为内联；内联脚本里不能出现 </script
html = html.replace(/<script type="module" crossorigin src="[^"]+"><\/script>/, '');
html = html.replace(/<link rel="stylesheet" crossorigin href="[^"]+">/, '');
html = html.replace('</head>', `<style>\n${css.map(read).join('\n')}\n</style>\n</head>`);
html = html.replace('</body>', `<script type="module">\n${read(js[0]).replace(/<\/script/gi, '<\\/script')}\n</script>\n</body>`);
mkdirSync('release', { recursive: true });
writeFileSync('release/ziwei-bazi.html', html, 'utf8');
console.log(`已生成 release/ziwei-bazi.html（${(html.length / 1024 / 1024).toFixed(2)} MB）`);
