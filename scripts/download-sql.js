// scripts/download-sql.js - تحميل ملفات sql.js من CDN
const fs = require('fs');
const path = require('path');
const https = require('https');

const SQLJS_VERSION = '1.10.3';
const BASE_URL = `https://cdn.jsdelivr.net/npm/sql.js@${SQLJS_VERSION}/dist/`;
const files = [{ name: 'sql-wasm.js', url: BASE_URL + 'sql-wasm.js' }, { name: 'sql-wasm.wasm', url: BASE_URL + 'sql-wasm.wasm' }];
const targetDir = path.join(__dirname, '..', 'lib');

async function download(file) {
  const targetPath = path.join(targetDir, file.name);
  console.log(`⏳ تحميل ${file.name} ...`);
  return new Promise((resolve, reject) => {
    https.get(file.url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const writeStream = fs.createWriteStream(targetPath);
      res.pipe(writeStream);
      writeStream.on('finish', () => { writeStream.close(); console.log(`✅ تم تحميل ${file.name}`); resolve(); });
      writeStream.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  console.log('🔧 بدء تحميل ملفات SQL.js...\n');
  for (const file of files) { await download(file).catch(e => console.error(`❌ فشل ${file.name}: ${e.message}`)); }
  console.log('\n✅ اكتمل التحميل');
}
main();
