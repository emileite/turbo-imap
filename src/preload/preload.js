'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('turbo', {
  getTools: () => ipcRenderer.invoke('tools:list'),
  getSystemInfo: () => ipcRenderer.invoke('system:info'),

  getConfig: (scriptName) => ipcRenderer.invoke('config:get', scriptName),
  saveConfig: (scriptName, values) => ipcRenderer.invoke('config:save', scriptName, values),

  startRun: (scriptName, values) => ipcRenderer.invoke('run:start', { scriptName, values }),
  stopRun: () => ipcRenderer.invoke('run:stop'),
  getActiveRun: () => ipcRenderer.invoke('run:active'),
  getHistory: (scriptName) => ipcRenderer.invoke('run:history', scriptName),
  getProgress: (scriptName) => ipcRenderer.invoke('progress:get', scriptName),

  readLog: (logFile) => ipcRenderer.invoke('log:read', logFile),
  openLog: (logFile) => ipcRenderer.invoke('log:open', logFile),
  openLogsFolder: () => ipcRenderer.invoke('logs:open-folder'),
  openRepository: () => ipcRenderer.invoke('external:open-repository'),

  onRunEvent: (callback) => {
    const listener = (event, payload) => callback(payload);
    ipcRenderer.on('run:event', listener);
    return () => ipcRenderer.removeListener('run:event', listener);
  }
});
