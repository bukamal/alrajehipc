// js/settings.js - إعدادات النظام والنسخ الاحتياطي وإدارة الترخيص
import { refreshCaches, apiCall } from './db.js';
import { showToast, confirmDialog, getCurrencySettings, formatNumber, ICONS, openModal } from './utils.js';
import { checkActivation, onlineActivate } from './activation.js';

export async function loadSettings() {
    const currency = getCurrencySettings();
    const bgEnabled = localStorage.getItem('bgNotifications') !== 'false';
    const numberFormat = localStorage.getItem('numberFormat') || 'western';
    const userAvatar = localStorage.getItem('userAvatar') || null;
    const brandIcon = localStorage.getItem('brandIcon') || null;
    const allowNegativeBalance = localStorage.getItem('allowNegativeBalance') === 'true';

    const html = `
        <div class="settings-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 24px;">
            <div class="card settings-card">
                <div class="card-header"><div class="card-title">💰 إعدادات العملة والتنسيق</div></div>
                <div class="card-body">
                    <div class="form-group"><label class="form-label">رمز العملة</label><input type="text" class="input" id="currency-symbol" value="${currency.symbol}" placeholder="$"></div>
                    <div class="form-group"><label class="form-label">الخانات العشرية</label><select class="select" id="currency-decimals"><option value="0" ${currency.decimals === 0 ? 'selected' : ''}>0</option><option value="1" ${currency.decimals === 1 ? 'selected' : ''}>1</option><option value="2" ${currency.decimals === 2 ? 'selected' : ''}>2</option></select></div>
                    <div class="form-group"><label class="form-label">تنسيق الأرقام</label><select class="select" id="number-format"><option value="western" ${numberFormat === 'western' ? 'selected' : ''}>غربية (0-9)</option><option value="arabic" ${numberFormat === 'arabic' ? 'selected' : ''}>شرقية (٠-٩)</option></select></div>
                    <div style="display: flex; gap: 12px;"><button class="btn btn-primary btn-sm" id="save-currency">${ICONS.check} حفظ العملة</button><button class="btn btn-secondary btn-sm" id="save-format">${ICONS.check} حفظ التنسيق</button></div>
                </div>
            </div>
            <div class="card settings-card">
                <div class="card-header"><div class="card-title">🖼️ التخصيص البصري</div></div>
                <div class="card-body">
                    <div class="form-group"><label class="form-label">الصورة الرمزية للمستخدم</label><input type="file" id="avatar-upload" accept="image/*" class="input" style="padding: 6px;"><div id="avatar-preview" style="margin-top: 10px;">${userAvatar ? `<img src="${userAvatar}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;">` : '<span style="color: var(--text-muted);">لا توجد صورة</span>'}</div><button class="btn btn-secondary btn-sm" id="clear-avatar">إزالة الصورة</button></div>
                    <div class="form-group"><label class="form-label">أيقونة العلامة التجارية</label><input type="file" id="brand-icon-upload" accept="image/*" class="input" style="padding: 6px;"><div id="brand-icon-preview" style="margin-top: 10px;">${brandIcon ? `<img src="${brandIcon}" style="width:40px;height:40px;border-radius:8px;">` : '<span style="color: var(--text-muted);">الأيقونة الافتراضية</span>'}</div><button class="btn btn-secondary btn-sm" id="clear-brand-icon">استعادة الافتراضية</button></div>
                </div>
            </div>
            <div class="card settings-card">
                <div class="card-header"><div class="card-title">⚙️ إعدادات متقدمة</div></div>
                <div class="card-body">
                    <div class="form-group"><label style="display: flex; align-items: center; gap: 12px;"><input type="checkbox" id="bg-notifications-toggle" ${bgEnabled ? 'checked' : ''}> تفعيل الإشعارات في الخلفية</label><small class="text-muted">سيتم عرض تنبيهات الجوازات والرحلات القادمة</small></div>
                    <div class="form-group"><label style="display: flex; align-items: center; gap: 12px;"><input type="checkbox" id="allow-negative-balance" ${allowNegativeBalance ? 'checked' : ''}> السماح بالأرصدة السالبة للعملاء والموردين</label><small class="text-muted">⚠️ تحذير: قد يؤدي إلى أرصدة سالبة (مخاطرة محاسبية)</small></div>
                </div>
            </div>
            <div class="card settings-card">
                <div class="card-header"><div class="card-title">🗄️ أدوات قاعدة البيانات</div></div>
                <div class="card-body">
                    <div style="display: flex; flex-wrap: wrap; gap: 12px;"><button class="btn btn-secondary btn-sm" id="export-all">📤 تصدير جميع البيانات</button><button class="btn btn-secondary btn-sm" id="import-all">📥 استيراد من ملف</button><button class="btn btn-danger btn-sm" id="reset-db">⚠️ إعادة تعيين قاعدة البيانات</button></div>
                    <p class="text-muted" style="font-size: 12px; margin-top: 12px;">إعادة التعيين ستحذف جميع البيانات نهائياً ولا يمكن التراجع عنها.</p>
                </div>
            </div>
            <div class="card settings-card">
                <div class="card-header"><div class="card-title">🔐 إدارة الترخيص</div></div>
                <div class="card-body">
                    <div id="license-status" style="margin-bottom: 16px; font-weight: 700;"></div>
                    <div style="display: flex; flex-wrap: wrap; gap: 12px;"><button class="btn btn-primary btn-sm" id="renew-online-btn">تجديد الترخيص</button><button class="btn btn-danger btn-sm" id="clear-license-btn">مسح الترخيص والبيانات</button></div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('tab-content').innerHTML = html;
    attachSettingsEvents();
    await updateLicenseStatus();
}

function attachSettingsEvents() {
    document.getElementById('save-currency')?.addEventListener('click', () => {
        const symbol = document.getElementById('currency-symbol').value.trim();
        const decimals = parseInt(document.getElementById('currency-decimals').value);
        if (!symbol) { showToast('الرجاء إدخال رمز العملة', 'warning'); return; }
        localStorage.setItem('currencySettings', JSON.stringify({ symbol, decimals }));
        showToast('تم تحديث العملة', 'success');
        location.reload();
    });
    document.getElementById('save-format')?.addEventListener('click', () => {
        localStorage.setItem('numberFormat', document.getElementById('number-format').value);
        showToast('تم تحديث تنسيق الأرقام', 'success');
        location.reload();
    });
    document.getElementById('avatar-upload')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                localStorage.setItem('userAvatar', ev.target.result);
                document.getElementById('avatar-preview').innerHTML = `<img src="${ev.target.result}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;">`;
                updateSidebarAvatar();
                showToast('تم تحديث الصورة الرمزية', 'success');
            };
            reader.readAsDataURL(file);
        }
    });
    document.getElementById('clear-avatar')?.addEventListener('click', () => {
        localStorage.removeItem('userAvatar');
        document.getElementById('avatar-preview').innerHTML = '<span style="color: var(--text-muted);">لا توجد صورة</span>';
        updateSidebarAvatar();
        showToast('تمت إزالة الصورة الرمزية', 'success');
    });
    document.getElementById('brand-icon-upload')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                localStorage.setItem('brandIcon', ev.target.result);
                document.getElementById('brand-icon-preview').innerHTML = `<img src="${ev.target.result}" style="width:40px;height:40px;border-radius:8px;">`;
                updateBrandIcon();
                showToast('تم تحديث أيقونة العلامة', 'success');
            };
            reader.readAsDataURL(file);
        }
    });
    document.getElementById('clear-brand-icon')?.addEventListener('click', () => {
        localStorage.removeItem('brandIcon');
        document.getElementById('brand-icon-preview').innerHTML = '<span style="color: var(--text-muted);">الأيقونة الافتراضية</span>';
        updateBrandIcon();
        showToast('تمت استعادة الأيقونة الافتراضية', 'success');
    });
    document.getElementById('bg-notifications-toggle')?.addEventListener('change', (e) => {
        localStorage.setItem('bgNotifications', e.target.checked);
        showToast('تم تحديث إعدادات الإشعارات', 'success');
    });
    document.getElementById('allow-negative-balance')?.addEventListener('change', (e) => {
        localStorage.setItem('allowNegativeBalance', e.target.checked);
        showToast(e.target.checked ? 'تم تفعيل السماح بالأرصدة السالبة' : 'تم إلغاء السماح بالأرصدة السالبة', 'info');
    });
    document.getElementById('export-all')?.addEventListener('click', exportAllData);
    document.getElementById('import-all')?.addEventListener('click', importAllData);
    document.getElementById('reset-db')?.addEventListener('click', async () => {
        if (await confirmDialog('سيتم حذف جميع البيانات وإعادة إنشاء قاعدة البيانات. هذا لا يمكن التراجع عنه. هل أنت متأكد؟')) {
            try {
                localStorage.clear();
                indexedDB.deleteDatabase('AlrajhiSQLiteStorage');
                showToast('تم حذف قاعدة البيانات. سيتم إعادة التحميل...', 'success');
                setTimeout(() => location.reload(), 1500);
            } catch (err) { showToast('خطأ: ' + err.message, 'error'); }
        }
    });
}

async function exportAllData() {
    const btn = document.getElementById('export-all');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="loader-inline"></span> جاري التصدير...';
    try {
        const { db } = await import('./db.js');
        const data = db.export();
        const blob = new Blob([data], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alrajhi-backup-${new Date().toISOString().slice(0,10)}.db`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('✅ تم تصدير قاعدة البيانات', 'success');
    } catch (err) { showToast('❌ فشل التصدير: ' + err.message, 'error'); }
    finally { btn.disabled = false; btn.innerHTML = originalText; }
}

async function importAllData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.db';
    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        if (!await confirmDialog('سيتم استبدال قاعدة البيانات الحالية. هل أنت متأكد؟')) return;
        const importBtn = document.getElementById('import-all');
        const originalText = importBtn.innerHTML;
        importBtn.disabled = true;
        importBtn.innerHTML = '<span class="loader-inline"></span> جاري الاستيراد...';
        try {
            const buffer = await file.arrayBuffer();
            const { saveDatabase } = await import('./sqlite-storage.js');
            await saveDatabase(new Uint8Array(buffer));
            showToast('تم الاستيراد بنجاح، سيتم إعادة التحميل', 'success');
            setTimeout(() => location.reload(), 1500);
        } catch (err) { showToast('فشل الاستيراد: ' + err.message, 'error'); }
        finally { importBtn.disabled = false; importBtn.innerHTML = originalText; }
    };
    input.click();
}

async function updateLicenseStatus() {
    const status = await checkActivation();
    const licenseDiv = document.getElementById('license-status');
    if (licenseDiv) {
        licenseDiv.innerHTML = status.valid ? '<span style="color: var(--success);">✓ مرخص</span>' : '<span style="color: var(--danger);">✗ غير مرخص</span>';
    }
    document.getElementById('renew-online-btn')?.addEventListener('click', async () => {
        const key = prompt('أدخل كود التفعيل الجديد');
        if (key) {
            try {
                await onlineActivate(key);
                showToast('تم التفعيل بنجاح، سيتم إعادة التشغيل', 'success');
                setTimeout(() => location.reload(), 1500);
            } catch (err) { showToast(err.message, 'error'); }
        }
    });
    document.getElementById('clear-license-btn')?.addEventListener('click', () => {
        if (confirm('سيتم حذف الترخيص وجميع البيانات. هل أنت متأكد؟')) {
            localStorage.clear();
            indexedDB.deleteDatabase('AlrajhiSQLiteStorage');
            location.reload();
        }
    });
}

function updateSidebarAvatar() {
    const avatar = localStorage.getItem('userAvatar');
    const avatarDiv = document.getElementById('user-avatar');
    if (avatarDiv) {
        if (avatar) avatarDiv.innerHTML = `<img src="${avatar}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">`;
        else avatarDiv.innerHTML = 'م';
    }
}

function updateBrandIcon() {
    const icon = localStorage.getItem('brandIcon');
    const brandIconDiv = document.getElementById('brand-icon');
    if (brandIconDiv) {
        if (icon) brandIconDiv.innerHTML = `<img src="${icon}" style="width:36px;height:36px;border-radius:10px;">`;
        else brandIconDiv.innerHTML = `<svg viewBox="0 0 200 200" width="36" height="36"><rect width="200" height="200" rx="40" fill="#4f46e5"/><text x="100" y="120" fill="white" font-family="'Segoe UI', 'Tajawal'" font-size="110" font-weight="900" text-anchor="middle">ر</text><text x="100" y="165" fill="white" font-family="system-ui" font-size="50" text-anchor="middle">💰</text></svg>`;
    }
}

export function scheduleAutoBackup() {
    console.log('Auto backup is handled manually by user export.');
}

export default loadSettings;
