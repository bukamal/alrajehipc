import { checkActivation, onlineActivate } from './activation.js';
import { initDB, initializeDefaultData, getAll } from './db.js';
import { initNavigation } from './navigation.js';
import { loadDashboard } from './dashboard.js';
import { showToast, openModal } from './modal.js';

function hideLoader() {
    const loader = document.getElementById('loading-screen');
    if (loader) {
        loader.classList.add('hidden');
        loader.style.display = 'none';
    }
}
setTimeout(hideLoader, 3000);

async function start() {
    const activation = await checkActivation();
    if (!activation.valid) {
        const modal = openModal({
            title: 'تفعيل البرنامج',
            bodyHTML: `
                <div class="form-group">
                    <label class="form-label">رمز التفعيل</label>
                    <input type="text" id="license-key" class="input" placeholder="أدخل الرمز">
                </div>
                <div id="activation-error" style="color:var(--danger); display:none;"></div>
            `,
            footerHTML: `<button class="btn btn-primary" id="activate-btn">تفعيل</button>`
        });
        modal.element.querySelector('#activate-btn').onclick = async () => {
            const key = modal.element.querySelector('#license-key').value;
            const btn = modal.element.querySelector('#activate-btn');
            btn.disabled = true;
            btn.innerHTML = '<span class="loader-inline"></span> جاري التفعيل...';
            try {
                await onlineActivate(key);
                modal.close();
                showToast('تم التفعيل بنجاح', 'success');
                start();
            } catch (err) {
                const errDiv = modal.element.querySelector('#activation-error');
                errDiv.textContent = err.message;
                errDiv.style.display = 'block';
                btn.disabled = false;
                btn.innerHTML = 'تفعيل';
            }
        };
        return;
    }
    
    try {
        await initDB();
        await initializeDefaultData();
        await Promise.all([
            getAll('customers'), getAll('suppliers'), getAll('items'), getAll('invoices'),
            getAll('categories'), getAll('units'), getAll('item_units'), getAll('payments'),
            getAll('vouchers'), getAll('expenses'), getAll('accounts')
        ]);
        initNavigation();
        await loadDashboard();
    } catch (err) {
        console.error(err);
        document.getElementById('tab-content').innerHTML = `<div class="empty-state"><h3>⚠️ خطأ في قاعدة البيانات</h3><p>${err.message}</p><button class="btn btn-primary" onclick="location.reload()">إعادة التحميل</button></div>`;
        hideLoader();
        return;
    }
    hideLoader();
}

start();
