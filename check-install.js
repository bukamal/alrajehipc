// check-install.js — التحقق من ملفات التثبيت (نسخة SQLite)
const fs = require('fs');
const path = require('path');

console.log('╔══════════════════════════════════════════╗');
console.log('║   التحقق من تثبيت نظام الراجحي للمحاسبة ║');
console.log('╚══════════════════════════════════════════╝\n');

const requiredFiles = [
    { path: 'index.html', critical: true },
    { path: 'style.css', critical: true },
    { path: 'main.js', critical: true },
    { path: 'js/db.js', critical: true },
    { path: 'js/init.js', critical: true },
    { path: 'js/core.js', critical: true },
    { path: 'js/modal.js', critical: true },
    { path: 'js/store.js', critical: true },
    { path: 'js/activation.js', critical: true },
    { path: 'js/navigation.js', critical: true },
    { path: 'lib/sql-wasm.wasm', critical: true, help: 'npm run postinstall' },
    { path: 'lib/sql-wasm.js', critical: true, help: 'npm run postinstall' },
    { path: 'lib/chart.umd.min.js', critical: false },
    { path: 'lib/gridstack-all.js', critical: false },
    { path: 'lib/winbox.min.js', critical: false },
    { path: 'lib/Sortable.min.js', critical: false },
    { path: 'lib/tabler.min.css', critical: false },
    { path: 'lib/tabler-icons.min.css', critical: false },
    { path: 'lib/bootstrap-icons.min.css', critical: false },
    { path: 'js/dashboard.js', critical: false },
    { path: 'js/items.js', critical: false },
    { path: 'js/sections.js', critical: false },
    { path: 'js/invoices.js', critical: false },
    { path: 'js/vouchers.js', critical: false },
    { path: 'js/reports.js', critical: false },
    { path: 'js/accounts.js', critical: false },
    { path: 'js/crypto-service.js', critical: false }
];

let allGood = true;
let criticalMissing = 0;

for (const file of requiredFiles) {
    const fullPath = path.join(__dirname, file.path);
    const exists = fs.existsSync(fullPath);
    const status = exists ? '✅' : (file.critical ? '❌' : '⚠️');
    const type = file.critical ? ' [إجباري]' : ' [اختياري]';
    console.log(`${status} ${file.path}${type}`);
    if (!exists && file.critical) {
        allGood = false;
        criticalMissing++;
        console.log(`   └─> ❗ مفقود: ${file.help || 'هذا الملف ضروري لتشغيل التطبيق'}`);
    } else if (!exists && !file.critical) {
        console.log(`   └─> ⚡ تحذير: ${file.help || 'هذا الملف اختياري'}`);
    }
}

console.log('\n╔══════════════════════════════════════════╗');
if (allGood) {
    console.log('║  ✅ جميع الملفات الإجبارية موجودة        ║');
    console.log('║  ✅ يمكنك تشغيل التطبيق: npm start       ║');
} else {
    console.log(`║  ❌ ${criticalMissing} ملف/ملفات إجبارية مفقودة          ║`);
    console.log('║  ❌ لا يمكن تشغيل التطبيق حالياً         ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log('║  🔧 إصلاح سريع:                         ║');
    console.log('║     1. npm install                       ║');
    console.log('║     2. npm run postinstall               ║');
    console.log('║     3. npm run check                     ║');
}
console.log('╚══════════════════════════════════════════╝\n');
if (!allGood) process.exit(1);
