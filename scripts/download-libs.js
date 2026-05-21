const fs = require('fs');
const path = require('path');
const https = require('https');
const { pipeline } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);

const libDir = path.join(__dirname, '..', 'lib');

const libraries = [
    { name: 'tabler.min.css', url: 'https://cdn.jsdelivr.net/npm/@tabler/core@1.0.0-beta20/dist/css/tabler.rtl.min.css', dest: 'tabler.min.css' },
    { name: 'tabler.min.js', url: 'https://cdn.jsdelivr.net/npm/@tabler/core@1.0.0-beta20/dist/js/tabler.min.js', dest: 'tabler.min.js' },
    { name: 'tabler-icons.min.css', url: 'https://unpkg.com/@tabler/icons-webfont@3.5.0/dist/tabler-icons.min.css', dest: 'tabler-icons.min.css' },
    { name: 'gridstack.min.css', url: 'https://cdn.jsdelivr.net/npm/gridstack@10.3.1/dist/gridstack.min.css', dest: 'gridstack.min.css' },
    { name: 'gridstack-all.js', url: 'https://cdn.jsdelivr.net/npm/gridstack@10.3.1/dist/gridstack-all.js', dest: 'gridstack-all.js' },
    { name: 'Sortable.min.js', url: 'https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js', dest: 'Sortable.min.js' },
    { name: 'winbox.min.css', url: 'https://cdn.jsdelivr.net/npm/winbox@0.2.82/dist/css/winbox.min.css', dest: 'winbox.min.css' },
    { name: 'winbox.min.js', url: 'https://cdn.jsdelivr.net/npm/winbox@0.2.82/dist/js/winbox.min.js', dest: 'winbox.min.js' },
    { name: 'bootstrap-icons.min.css', url: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css', dest: 'bootstrap-icons.min.css' },
    { name: 'chart.umd.min.js', url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js', dest: 'chart.umd.min.js' }
];

async function downloadFile(url, destPath) {
    console.log(`⏳ تحميل ${path.basename(destPath)} ...`);
    try {
        const response = await new Promise((resolve, reject) => {
            https.get(url, (res) => {
                if (res.statusCode !== 200) reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                else resolve(res);
            }).on('error', reject);
        });
        await streamPipeline(response, fs.createWriteStream(destPath));
        console.log(`✅ تم حفظ ${path.basename(destPath)}`);
    } catch (err) {
        console.error(`❌ فشل تحميل ${path.basename(destPath)}: ${err.message}`);
    }
}

async function main() {
    if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true });
    console.log('📦 بدء تحميل المكتبات...\n');
    for (const lib of libraries) {
        const destPath = path.join(libDir, lib.dest);
        await downloadFile(lib.url, destPath);
    }
    console.log('\n✅ اكتمل التحميل');
}
main().catch(console.error);
