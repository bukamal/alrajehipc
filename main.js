const { app, BrowserWindow } = require('electron');
const express = require('express');
const path = require('path');
const { initTables, setupApiRoutes } = require('./database');

let mainWindow;
let server;

function createExpressServer() {
  const expressApp = express();
  expressApp.use(express.json());
  setupApiRoutes(expressApp);
  const PORT = 3123;
  server = expressApp.listen(PORT, 'localhost', () => {
    console.log(`✅ خادم API المحلي يعمل على http://localhost:${PORT}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'public', 'favicon.ico'),
    title: 'الراجحي للمحاسبة',
  });
  mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));
  // mainWindow.webContents.openDevTools(); // افتحها للتصحيح إن أردت
}

app.whenReady().then(() => {
  initTables();
  createExpressServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') app.quit();
});
