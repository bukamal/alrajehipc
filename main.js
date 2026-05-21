const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let isQuiting = false;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

function createWindow() {
    const backgroundColor = '#0f172a';

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: backgroundColor,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        title: 'الراجحي للمحاسبة'
    });

    mainWindow.loadFile('index.html');
    
    mainWindow.once('ready-to-show', () => {
        setTimeout(() => {
            mainWindow.show();
            mainWindow.focus();
        }, 50);
    });

    mainWindow.on('close', (event) => {
        if (!isQuiting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    createApplicationMenu();
    createTray();
}

function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'icon.ico');
    let trayIcon;
    if (fs.existsSync(iconPath)) {
        trayIcon = nativeImage.createFromPath(iconPath);
    } else {
        trayIcon = nativeImage.createFromDataURL('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#6366f1"/><text x="50" y="68" fill="white" font-family="Arial" font-size="55" font-weight="bold" text-anchor="middle">ر</text><text x="50" y="88" fill="white" font-family="Arial" font-size="20" text-anchor="middle">💰</text></svg>');
    }
    tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
    
    const contextMenu = Menu.buildFromTemplate([
        { label: 'إظهار النافذة', click: () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } } },
        { label: 'إخفاء النافذة', click: () => { if (mainWindow) mainWindow.hide(); } },
        { type: 'separator' },
        { label: 'فاتورة جديدة', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.send('navigate', 'new_invoice'); } } },
        { label: 'التقارير', submenu: [{ label: 'قائمة الدخل', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.send('navigate', 'reports', 'income_statement'); } } }, { label: 'ميزان المراجعة', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.send('navigate', 'reports', 'trial_balance'); } } }] },
        { type: 'separator' },
        { label: 'التبديل بين الوضع الفاتح/الداكن', click: () => { if (mainWindow) { mainWindow.webContents.send('toggle-theme'); } } },
        { type: 'separator' },
        { label: 'الخروج', click: () => { isQuiting = true; app.quit(); } }
    ]);
    tray.setContextMenu(contextMenu);
    tray.setToolTip('الراجحي للمحاسبة');
    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) mainWindow.hide();
            else { mainWindow.show(); mainWindow.focus(); }
        }
    });
}

function createApplicationMenu() {
    const template = [
        { label: 'ملف', submenu: [
            { label: 'فاتورة جديدة', accelerator: 'CmdOrCtrl+N', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.send('navigate', 'new_invoice'); } } },
            { label: 'تصدير جميع البيانات', accelerator: 'CmdOrCtrl+E', click: () => { if (mainWindow) mainWindow.webContents.send('trigger-export'); } },
            { label: 'استيراد بيانات', accelerator: 'CmdOrCtrl+I', click: () => { if (mainWindow) mainWindow.webContents.send('trigger-import'); } },
            { type: 'separator' },
            { label: 'الخروج', accelerator: 'CmdOrCtrl+Q', click: () => { isQuiting = true; app.quit(); } }
        ] },
        { label: 'عرض', submenu: [
            { label: 'إعادة تحميل', accelerator: 'F5', click: () => { if (mainWindow) mainWindow.reload(); } },
            { label: 'تكبير/تصغير', role: 'togglefullscreen' },
            { type: 'separator' },
            { label: 'الوضع الفاتح/الداكن', accelerator: 'CmdOrCtrl+T', click: () => { if (mainWindow) mainWindow.webContents.send('toggle-theme'); } },
            { type: 'separator' },
            { label: 'أدوات المطور', accelerator: 'F12', click: () => { if (mainWindow) mainWindow.webContents.openDevTools(); } }
        ] },
        { label: 'تقارير سريعة', submenu: [
            { label: 'قائمة الدخل', accelerator: 'CmdOrCtrl+Shift+I', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.send('navigate', 'reports', 'income_statement'); } } },
            { label: 'ميزان المراجعة', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.send('navigate', 'reports', 'trial_balance'); } } },
            { label: 'الميزانية العمومية', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.send('navigate', 'reports', 'balance_sheet'); } } }
        ] },
        { label: 'مساعدة', submenu: [
            { label: 'مركز المساعدة', accelerator: 'F1', click: () => { if (mainWindow) mainWindow.webContents.send('show-help'); } },
            { label: 'حول البرنامج', click: () => { dialog.showMessageBox(mainWindow, { type: 'info', title: 'عن الراجحي للمحاسبة', message: 'نظام الراجحي للمحاسبة\nالإصدار 2.0.0\n\n© 2025 الراجحي', buttons: ['موافق'] }); } }
        ] }
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

ipcMain.on('focus-window', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); }
});
ipcMain.on('show-notification', (event, { title, body, requireInteraction = false }) => {
    if (!mainWindow) return;
    new Notification({ title, body, silent: false, requireInteraction }).show();
});
ipcMain.on('reload-app', () => { if (mainWindow) mainWindow.reload(); });
ipcMain.on('theme-changed', (event, theme) => { console.log(`السمة تغيرت إلى ${theme}`); });

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
        else if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    });
});
app.on('before-quit', () => { isQuiting = true; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
process.on('uncaughtException', (error) => { console.error('خطأ غير متوقع:', error); dialog.showErrorBox('خطأ غير متوقع', error.message); });
