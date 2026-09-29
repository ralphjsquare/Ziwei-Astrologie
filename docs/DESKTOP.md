# 桌面版（Windows）

## 使用
1. 解压 `ZiweiBazi-win32-x64.zip`，双击文件夹里的 `ZiweiBazi.exe`（免安装，可放在任意目录或 U 盘）。
2. 完全本地运行，不联网。存档保存在 `%APPDATA%\ZiweiBazi`（浏览器 IndexedDB 的本机位置），也可在“存档”页导出 JSON 备份。
3. 首次运行时 Windows 可能弹出“SmartScreen 已保护你的电脑”：因为这个 exe 没有代码签名证书。点“更多信息 → 仍要运行”。如需正式分发，需要购买代码签名证书并在打包时签名。

## 自己重新打包
```bash
npm install
npm run desktop:win        # 构建网页 → 打包 release/ZiweiBazi-win32-x64（含 zip）
xvfb-run -a node tools/desktop-smoke.mjs   # 可选：用本机 Linux 版 Electron 做冒烟测试（排盘、神煞、合盘页、app:// 协议）
```
要打 macOS 或 Linux 版，把 `tools/desktop.mjs` 里的 `platform`/`arch` 改成对应值即可（macOS 版需在 macOS 上做签名与公证）。

## 说明
- 外壳是 Electron，只加载打包进去的 `dist/`（自定义协议 `app://`，禁止路径穿越，外部链接交给系统浏览器）。计算引擎、规则、语料与网页版完全相同。
- 本仓库在云端 Linux 环境生成 Windows 包，**没有在真实 Windows 上运行过这个 exe**；已验证的是：同一份 `main.cjs` 与 `dist/` 在 Linux 版 Electron 下的冒烟测试通过。
