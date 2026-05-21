const fs = require('fs');
const path = require('path');

console.log('🔧 نسخ ملفات SQL.js إلى مجلد lib ...\n');
const srcDir = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist');
const targetDir = path.join(__dirname, '..', 'lib');

if (!fs.existsSync(srcDir)) {
    console.error('❌ لم يتم العثور على sql.js في node_modules. قم بتشغيل npm install أولاً.');
    process.exit(1);
}
if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

const files = ['sql-wasm.js', 'sql-wasm.wasm'];
for (const file of files) {
    const src = path.join(srcDir, file);
    const dest = path.join(targetDir, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`✅ تم نسخ ${file}`);
    } else {
        console.error(`❌ الملف ${file} غير موجود في ${srcDir}`);
        process.exit(1);
    }
}
console.log('\n✅ اكتمل إعداد SQL.js');
