const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    // التنقل
    onNavigate: (callback) => ipcRenderer.on('navigate', (event, tabName, reportType) => callback(tabName, reportType)),
    onTriggerExport: (callback) => ipcRenderer.on('trigger-export', callback),
    onTriggerImport: (callback) => ipcRenderer.on('trigger-import', callback),
    onShowHelp: (callback) => ipcRenderer.on('show-help', callback),
    onManualBackup: (callback) => ipcRenderer.on('manual-backup', callback),
    onToggleTheme: (callback) => ipcRenderer.on('toggle-theme', callback),
    themeChanged: (theme) => ipcRenderer.send('theme-changed', theme),
    // التحكم بالنافذة
    focusWindow: () => ipcRenderer.send('focus-window'),
    showBackgroundNotification: (title, body, options) => ipcRenderer.send('show-notification', { title, body, requireInteraction: options?.requireInteraction }),
    reloadApp: () => ipcRenderer.send('reload-app')
});
