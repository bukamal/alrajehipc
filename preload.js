const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {});

window.addEventListener('DOMContentLoaded', () => {
  console.log('✅ بيئة سطح المكتب (Electron) جاهزة');
});
