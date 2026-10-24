'use strict';
const { app, BrowserWindow, ipcMain, dialog, screen, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { GameStore } = require('./store.cjs');
const { loadQuestionBank } = require('./content.cjs');

app.setName('AI or Real');
app.commandLine.appendSwitch('disable-pinch');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let window;
let store;
let rendererUrl;

function trusted(event) {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
    throw new Error('This request did not come from the game.');
  }
  if (event.senderFrame.url !== rendererUrl && !event.senderFrame.url.startsWith(`${rendererUrl}#`)) {
    throw new Error('This page cannot access game data.');
  }
}

function handle(channel, callback) {
  ipcMain.handle(channel, async (event, ...args) => {
    trusted(event);
    return callback(...args);
  });
}

function registerHandlers() {
  handle('store:load', () => store.load());
  handle('content:load', () => loadQuestionBank(
    app.getPath('userData'),
    path.join(app.getAppPath(), app.isPackaged || process.argv.includes('--built') ? 'dist' : 'public'),
  ));
  handle('store:save-result', (result) => store.saveResult(result));
  handle('store:save-settings', (settings) => store.saveSettings(settings));
  handle('store:clear-results', () => store.clearResults());
  handle('window:fullscreen', (enabled) => {
    if (typeof enabled !== 'boolean') throw new Error('Invalid fullscreen option.');
    window.setKiosk(enabled);
    window.setFullScreen(enabled);
  });
  handle('store:export-csv', async (csv) => {
    if (typeof csv !== 'string' || Buffer.byteLength(csv, 'utf8') > 32 * 1024 * 1024) throw new Error('Invalid export data.');
    const result = await dialog.showSaveDialog(window, {
      title: 'Export leaderboard',
      defaultPath: path.join(app.getPath('documents'), `AI-or-Real-results-${new Date().toISOString().slice(0, 10)}.csv`),
      filters: [{ name: 'CSV spreadsheet', extensions: ['csv'] }],
    });
    if (result.canceled || !result.filePath) return false;
    await fs.writeFile(result.filePath, csv.startsWith('\uFEFF') ? csv : '\uFEFF' + csv, { encoding: 'utf8', mode: 0o600 });
    return true;
  });
}

function createWindow() {
  const displays = screen.getAllDisplays();
  const target = displays.find((display) => display.bounds.height > display.bounds.width) || screen.getPrimaryDisplay();
  const bounds = target.bounds;
  const windowed = process.argv.includes('--windowed') || process.argv.includes('--review');
  const previewHeight = Math.max(640, Math.min(1200, target.workArea.height - 80));
  const previewWidth = process.argv.includes('--review') ? Math.max(750, Math.min(1150, target.workArea.width - 100)) : Math.round(previewHeight * 9 / 16);
  window = new BrowserWindow({
    title: 'AI or Real',
    x: bounds.x, y: bounds.y, width: windowed ? previewWidth : bounds.width, height: windowed ? previewHeight : bounds.height,
    minWidth: windowed ? 360 : 540, minHeight: windowed ? 600 : 720,
    fullscreen: !windowed,
    kiosk: !windowed,
    autoHideMenuBar: true,
    backgroundColor: '#080b11',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      navigateOnDragDrop: false,
    },
  });
  if (windowed) window.center();
  window.removeMenu();
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (new URL(rendererUrl).searchParams.get('review') === '1') {
      try {
        const link = new URL(url);
        const nodes = ['4064-533','4064-723','4064-598','4064-639','4064-1501'];
        if (link.protocol === 'https:' && link.hostname === 'www.figma.com' &&
          link.pathname === '/design/aXSIhrFP89npxkNOq8gOqB/AI-or-Real---UI-Flow' &&
          link.searchParams.size === 1 && nodes.includes(link.searchParams.get('node-id'))) {
          void shell.openExternal(link.href);
        }
      } catch { /* Only the fixed approved Figma references may open externally. */ }
    }
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== rendererUrl && !url.startsWith(`${rendererUrl}#`)) event.preventDefault();
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.webContents.on('context-menu', (event) => event.preventDefault());
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.control && input.shift && input.key.toLowerCase() === 'a') {
      event.preventDefault();
      window.webContents.send('kiosk:admin');
    } else if (input.control && input.shift && input.key.toLowerCase() === 'q') {
      event.preventDefault();
      app.quit();
    } else if (input.key === 'F11') {
      event.preventDefault();
      const enabled = !window.isFullScreen();
      window.setKiosk(enabled);
      window.setFullScreen(enabled);
    }
  });
  window.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {});
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => { window = null; });
  window.loadURL(rendererUrl).catch((error) => {
    dialog.showErrorBox('AI or Real could not start', `The game screen could not be loaded. ${error.message}`);
    app.quit();
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on('second-instance', (_event, commandLine) => {
    if (!window) return;
    if (window.isMinimized()) window.restore();
    const review = commandLine.includes('--review');
    const nextUrl = new URL(rendererUrl);
    if (review) nextUrl.searchParams.set('review', '1');
    else nextUrl.searchParams.delete('review');
    if (nextUrl.href !== rendererUrl) {
      rendererUrl = nextUrl.href;
      const windowed = review || commandLine.includes('--windowed');
      window.setKiosk(!windowed);
      window.setFullScreen(!windowed);
      if (windowed) {
        const area = screen.getDisplayMatching(window.getBounds()).workArea;
        window.setSize(Math.min(1150, area.width - 80), Math.min(1200, area.height - 80));
        window.center();
      }
      void window.loadURL(rendererUrl);
    }
    window.focus();
  });
  app.whenReady().then(() => {
    store = new GameStore(app.getPath('userData'));
    if (app.isPackaged || process.argv.includes('--built')) rendererUrl = pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).href;
    else {
      const requested = process.env.ELECTRON_RENDERER_URL || 'http://127.0.0.1:5173';
      const parsed = new URL(requested);
      if (!['http:', 'https:'].includes(parsed.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
        throw new Error('The development screen must be hosted on localhost.');
      }
      rendererUrl = parsed.href;
    }
    if (process.argv.includes('--review')) {
      const reviewUrl = new URL(rendererUrl);
      reviewUrl.searchParams.set('review', '1');
      rendererUrl = reviewUrl.href;
    }
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    registerHandlers();
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  }).catch((error) => {
    dialog.showErrorBox('AI or Real could not start', error.message);
    app.quit();
  });
}
app.on('window-all-closed', () => app.quit());
