// 桌面壳（Electron）：本地加载已构建的网页（dist/），不联网；数据存于应用自己的 IndexedDB（用户数据目录）。
const { app, BrowserWindow, Menu, shell, protocol, net } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// 用自定义标准协议 app:// 提供页面：比 file:// 更稳（ES 模块脚本、IndexedDB 都按正常网页处理）
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
const DIST = path.join(__dirname, 'dist');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 720, minHeight: 560, title: '紫微斗数 · 八字排盘',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  // 只允许加载本地页面；任何外部链接一律交给系统浏览器
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) void shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); if (/^https?:/i.test(url)) void shell.openExternal(url); } });
  void win.loadURL('app://local/index.html');
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(DIST, rel));
    if (!file.startsWith(DIST)) return new Response('forbidden', { status: 403 }); // 防止路径穿越
    return net.fetch(pathToFileURL(file).toString());
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '文件', submenu: [{ role: 'quit', label: '退出' }] },
    { label: '视图', submenu: [{ role: 'reload', label: '重新加载' }, { role: 'togglefullscreen', label: '全屏' }, { role: 'zoomIn', label: '放大' }, { role: 'zoomOut', label: '缩小' }, { role: 'resetZoom', label: '重置缩放' }] },
  ]));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
