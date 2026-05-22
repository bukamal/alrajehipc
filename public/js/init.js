// public/js/init.js - مع دعم التفعيل عبر الإنترنت
import { apiCall } from './core.js';
import { loadDashboard } from './dashboard.js';
import { checkActivation, onlineActivate } from './activation.js';
import { initNavigation } from './navigation.js';

let activationModal = null;

function showActivationUI() {
    const modalPortal = document.getElementById('modal-portal');
    if (!modalPortal) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '20000';
    overlay.innerHTML = `
        <div class="modal-box" style="max-width: 450px;">
            <div class="modal-header">
                <h3 class="modal-title">🔐 تفعيل البرنامج</h3>
            </div>
            <div class="modal-body">
                <div style="text-align: center; margin-bottom: 20px;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                </div>
                <p style="text-align: center; margin-bottom: 20px;">أدخل رمز التفعيل لبدء استخدام النظام</p>
                <div class="form-group">
                    <label class="form-label">رمز التفعيل</label>
                    <input type="text" class="input" id="license-input" placeholder="TEST-XXXX-XXXX" dir="ltr" style="text-align: center;">
                </div>
                <div id="activation-error" style="color: var(--danger); text-align: center; margin-top: 10px; display: none;"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" id="activate-btn" style="width: 100%;">🔓 تفعيل</button>
            </div>
        </div>
    `;
    modalPortal.appendChild(overlay);
    activationModal = overlay;

    const btn = overlay.querySelector('#activate-btn');
    const input = overlay.querySelector('#license-input');
    const errDiv = overlay.querySelector('#activation-error');

    btn.onclick = async () => {
        const code = input.value.trim();
        if (!code) {
            errDiv.textContent = 'الرجاء إدخال رمز التفعيل';
            errDiv.style.display = 'block';
            return;
        }
        btn.disabled = true;
        btn.innerHTML = '<span class="loader-inline"></span> جاري التفعيل...';
        errDiv.style.display = 'none';
        try {
            await onlineActivate(code);
            if (activationModal) activationModal.remove();
            window.location.reload();
        } catch (err) {
            errDiv.textContent = err.message;
            errDiv.style.display = 'block';
            btn.disabled = false;
            btn.innerHTML = '🔓 تفعيل';
        }
    };
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') btn.click(); });
}

async function start() {
    // إخفاء شاشة التحميل
    const loading = document.getElementById('loading-screen');
    if (loading) loading.style.display = 'none';

    // التحقق من الترخيص
    const activation = await checkActivation();
    if (!activation.valid) {
        showActivationUI();
        return;
    }

    // الترخيص صالح: تحميل التطبيق
    try {
        const result = await apiCall('/verify', 'POST', { initData: 'local_user' });
        if (result.verified) {
            // تهيئة التنقل
            initNavigation();
            // تحميل لوحة التحكم
            loadDashboard();
        } else {
            document.getElementById('tab-content').innerHTML = '<div style="color:red; padding:20px;">غير مصرح</div>';
        }
    } catch (err) {
        document.getElementById('tab-content').innerHTML = `<div style="color:red; padding:20px;">خطأ: ${err.message}</div>`;
    }
}

start();
