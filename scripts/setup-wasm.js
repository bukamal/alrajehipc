// scripts/setup-wasm.js — نسخ ملفات sql.js إلى مجلد lib
const fs = require('fs');
const path = require('path');

console.log('🔧 جاري إعداد ملفات النظام...\n');

const sqlJsPaths = [
    path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist'),
    path.join(__dirname, '..', 'node_modules', 'sql.js')
];

let foundSqlJs = false;
let sqlJsDistPath = null;
for (const p of sqlJsPaths) {
    if (fs.existsSync(p)) {
        foundSqlJs = true;
        sqlJsDistPath = p;
        break;
    }
}

if (!foundSqlJs) {
    console.error('❌ لم يتم العثور على حزمة sql.js');
    console.error('💡 قم بتشغيل: npm install sql.js');
    process.exit(1);
}

const targetDir = path.join(__dirname, '..', 'lib');
if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

const filesToCopy = [
    { from: 'sql-wasm.wasm', critical: true },
    { from: 'sql-wasm.js', critical: false }
];

let copied = 0, failed = 0;
for (const file of filesToCopy) {
    const sourcePath = path.join(sqlJsDistPath, file.from);
    const targetPath = path.join(targetDir, file.from);
    if (fs.existsSync(sourcePath)) {
        try {
            fs.copyFileSync(sourcePath, targetPath);
            console.log(`✅ تم نسخ ${file.from}`);
            copied++;
        } catch (err) {
            console.error(`❌ فشل نسخ ${file.from}: ${err.message}`);
            failed++;
        }
    } else {
        if (file.critical) {
            console.error(`❌ ملف حرج مفقود: ${file.from}`);
            failed++;
        } else {
            console.log(`⚠️ لم يتم العثور على ${file.from} (اختياري)`);
        }
    }
}

console.log('\n╔══════════════════════════════════════════╗');
if (failed === 0) {
    console.log('║  ✅ تم إعداد جميع الملفات بنجاح          ║');
    console.log('║  ✅ جاهز للتشغيل: npm start              ║');
} else {
    console.log(`║  ❌ فشل في نسخ ${failed} ملف/ملفات        ║`);
    console.log('║  💡 تأكد من: npm install sql.js          ║');
}
console.log('╚══════════════════════════════════════════╝\n');
if (failed > 0) process.exit(1);
