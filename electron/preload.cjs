'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kiosk', {
  loadStore: () => ipcRenderer.invoke('store:load'),
  loadQuestionBank: () => ipcRenderer.invoke('content:load'),
  saveResult: (result) => ipcRenderer.invoke('store:save-result', result),
  saveSettings: (settings) => ipcRenderer.invoke('store:save-settings', settings),
  clearResults: () => ipcRenderer.invoke('store:clear-results'),
  exportResults: (csv) => ipcRenderer.invoke('store:export-csv', csv),
  setFullscreen: (enabled) => ipcRenderer.invoke('window:fullscreen', enabled),
  onAdminRequested: (callback) => {
    if (typeof callback !== 'function') throw new TypeError('Expected a callback.');
    const handler = () => callback();
    ipcRenderer.on('kiosk:admin', handler);
    return () => ipcRenderer.removeListener('kiosk:admin', handler);
  },
});
