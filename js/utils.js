// utils.js - دوال مساعدة ومودالات وإخطارات (متكامل) + Smart Select

export const ICONS = {
    home: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    box: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
    cart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
    download: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    users: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    factory: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22h20"/><path d="M4 22V10l4-2v14"/><path d="M12 22V8l4-2v16"/><path d="M20 22V4l-4 2v16"/></svg>',
    tag: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
    wallet: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><path d="M16 10a4 4 0 0 1-4 4"/></svg>',
    dollar: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    fileText: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    chart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    alert: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    print: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    scale: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/></svg>',
    settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
};

// ----- دوال التنسيق والأرقام -----
export function getCurrencySettings() {
    try {
        const saved = localStorage.getItem('currencySettings');
        if (saved) {
            const parsed = JSON.parse(saved);
            return { symbol: parsed.symbol || '$', decimals: parsed.decimals !== undefined ? parsed.decimals : 0 };
        }
    } catch(e) {}
    return { symbol: '$', decimals: 0 };
}

export function updateCurrencySettings(symbol, decimals) {
    localStorage.setItem('currencySettings', JSON.stringify({ symbol, decimals }));
}

export function toEnglishDigits(str) {
    if (str === undefined || str === null) return '';
    return String(str).replace(/[\u0660-\u0669]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48))
                      .replace(/[\u06F0-\u06F9]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x06F0 + 48));
}

export function formatNumber(num) {
    if (num === undefined || num === null || isNaN(num)) return '0';
    let n = Number(num);
    if (isNaN(n)) n = 0;
    const { decimals } = getCurrencySettings();
    let formatted = parseFloat(n.toFixed(decimals)).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const pref = localStorage.getItem('numberFormat') === 'arabic' ? 'arabic' : 'western';
    if (pref === 'arabic') {
        formatted = formatted.replace(/\d/g, d => String.fromCharCode(d.charCodeAt(0) - 48 + 0x0660));
    }
    return formatted;
}

export function formatCurrency(amount) {
    const { symbol } = getCurrencySettings();
    return `${formatNumber(amount)} ${symbol}`;
}

export function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

export function emptyState(title, subtitle = '') {
    return `<div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(subtitle)}</p>
    </div>`;
}

export function animateEntry(selector, delay = 0) {
    document.querySelectorAll(selector).forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        setTimeout(() => {
            el.style.transition = 'all 0.5s';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, delay + i * 80);
    });
}

export function debounce(fn, ms = 300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

export function renderSkeleton(type = 'cards') {
    let html = '';
    switch (type) {
        case 'cards': html = Array(3).fill(`<div class="skeleton-card"><div class="skeleton-line w-60"></div><div class="skeleton-line w-80"></div><div class="skeleton-line w-40"></div></div>`).join(''); break;
        case 'stats': html = `<div class="skeleton-stats">${Array(4).fill('<div class="skeleton-stat"><div class="skeleton-line w-50"></div><div class="skeleton-line w-70" style="height:28px; margin-top:8px;"></div></div>').join('')}</div>`; break;
        case 'chart': html = `<div class="skeleton-chart"><div class="skeleton-line w-40" style="margin-bottom:16px;"></div><div style="height:200px; background:var(--border); border-radius:8px; animation:pulse 1.5s infinite;"></div></div>`; break;
        default: html = '<div class="skeleton-card"><div class="skeleton-line w-80"></div></div>';
    }
    return `<div class="skeleton-container">${html}</div>`;
}

let scrollLockPos = 0;
export function lockScroll() {
    if (document.body.style.position === 'fixed') return;
    scrollLockPos = window.scrollY || document.documentElement.scrollTop;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollLockPos}px`;
    document.body.style.width = '100%';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.classList.add('scroll-locked');
}
export function unlockScroll() {
    if (document.body.style.position === 'fixed') {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.classList.remove('scroll-locked');
        window.scrollTo(0, scrollLockPos);
    }
}

let activeModal = null;

export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let iconSvg = ICONS.info;
    if (type === 'success') iconSvg = ICONS.check;
    if (type === 'error') iconSvg = ICONS.x;
    if (type === 'warning') iconSvg = ICONS.alert;
    toast.innerHTML = `<span class="toast-icon">${iconSvg}</span> ${escapeHtml(message)}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.35s ease forwards';
        setTimeout(() => toast.remove(), 350);
    }, 3000);
}

export function openModal({ title, bodyHTML, footerHTML = '', onClose }) {
    const portal = document.getElementById('modal-portal');
    if (activeModal) {
        const closeBtn = activeModal.querySelector('.modal-close');
        if (closeBtn) closeBtn.click();
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-box">
            <div class="modal-header">
                <h3 class="modal-title">${escapeHtml(title)}</h3>
                <button class="modal-close" aria-label="إغلاق">${ICONS.x}</button>
            </div>
            <div class="modal-body">${bodyHTML}</div>
            ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
        </div>
    `;
    portal.appendChild(overlay);
    lockScroll();
    activeModal = overlay;

    const box = overlay.querySelector('.modal-box');
    const closeBtn = overlay.querySelector('.modal-close');
    const closeModal = () => {
        overlay.style.animation = 'fadeIn 0.2s ease reverse';
        box.style.animation = 'slideUp 0.25s ease reverse';
        setTimeout(() => {
            overlay.remove();
            if (activeModal === overlay) activeModal = null;
            unlockScroll();
            if (onClose) onClose();
        }, 200);
    };
    closeBtn.onclick = closeModal;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); }, { once: true });
    return { close: closeModal, element: overlay };
}

export function confirmDialog(message) {
    return new Promise((resolve) => {
        const modal = openModal({
            title: 'تأكيد العملية',
            bodyHTML: `<div style="display:flex; gap:14px; align-items:center; padding:8px 0;">
                        <div style="color:var(--warning);">${ICONS.alert}</div>
                        <p style="font-size:15px;">${escapeHtml(message)}</p>
                       </div>`,
            footerHTML: `<button class="btn btn-secondary" id="confirm-cancel">إلغاء</button>
                         <button class="btn btn-danger" id="confirm-ok">تأكيد</button>`
        });
        modal.element.querySelector('#confirm-cancel').onclick = () => { modal.close(); resolve(false); };
        modal.element.querySelector('#confirm-ok').onclick = () => { modal.close(); resolve(true); };
    });
}

export function showFormModal({ title, fields, initialValues = {}, onSave, onSuccess }) {
    const formId = 'form_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    let body = '';
    fields.forEach(f => {
        const val = initialValues[f.id] !== undefined ? initialValues[f.id] : '';
        if (f.type === 'select') {
            body += `<div class="form-group"><label class="form-label">${escapeHtml(f.label)}</label><select class="select" id="${formId}_${f.id}">${f.options}</select></div>`;
        } else if (f.type === 'textarea') {
            body += `<div class="form-group"><label class="form-label">${escapeHtml(f.label)}</label><textarea class="textarea" id="${formId}_${f.id}" placeholder="${escapeHtml(f.placeholder || '')}">${escapeHtml(val)}</textarea></div>`;
        } else {
            body += `<div class="form-group"><label class="form-label">${escapeHtml(f.label)}</label><input class="input" id="${formId}_${f.id}" type="${f.type || 'text'}" placeholder="${escapeHtml(f.placeholder || '')}" value="${escapeHtml(val)}"></div>`;
        }
    });
    const modal = openModal({
        title,
        bodyHTML: body,
        footerHTML: `<button class="btn btn-secondary" id="${formId}_cancel">إلغاء</button>
                     <button class="btn btn-primary" id="${formId}_save">${ICONS.check} حفظ</button>`
    });
    const cancelBtn = modal.element.querySelector(`#${formId}_cancel`);
    const saveBtn = modal.element.querySelector(`#${formId}_save`);
    if (cancelBtn) cancelBtn.onclick = () => modal.close();
    if (saveBtn) {
        saveBtn.onclick = async () => {
            if (saveBtn.disabled) return;
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="loader-inline"></span> جاري الحفظ...';
            try {
                const values = {};
                for (const f of fields) {
                    const el = modal.element.querySelector(`#${formId}_${f.id}`);
                    if (el) {
                        let val = el.value.trim();
                        if (f.type === 'number') val = toEnglishDigits(val);
                        values[f.id] = val;
                    }
                }
                await onSave(values);
                modal.close();
                showToast('تم الحفظ بنجاح', 'success');
                if (onSuccess) onSuccess();
            } catch (e) {
                showToast(e.message || 'حدث خطأ أثناء الحفظ', 'error');
                saveBtn.disabled = false;
                saveBtn.innerHTML = `${ICONS.check} حفظ`;
            }
        };
    }
}

// Smart Select Component
export function smartSelect(selectElement, options, { placeholder = 'ابحث...', limit = 50, onSelect = null } = {}) {
    if (!selectElement || selectElement.tagName !== 'SELECT') {
        console.error('smartSelect: العنصر ليس <select>');
        return null;
    }

    const originalSelect = selectElement;
    const container = document.createElement('div');
    container.className = 'smart-select-container';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input smart-select-input';
    input.placeholder = placeholder;
    input.autocomplete = 'off';
    
    const clearBtn = document.createElement('div');
    clearBtn.className = 'smart-select-clear';
    clearBtn.innerHTML = '✕';
    clearBtn.title = 'مسح التحديد';
    
    const dropdown = document.createElement('div');
    dropdown.className = 'smart-select-dropdown';
    dropdown.style.display = 'none';
    
    const resultsDiv = document.createElement('div');
    resultsDiv.className = 'smart-select-results';
    dropdown.appendChild(resultsDiv);
    
    container.appendChild(input);
    container.appendChild(clearBtn);
    container.appendChild(dropdown);
    
    originalSelect.style.display = 'none';
    originalSelect.parentNode.insertBefore(container, originalSelect.nextSibling);
    
    let optionItems = [];
    function refreshOptions() {
        optionItems = [];
        for (let i = 0; i < originalSelect.options.length; i++) {
            const opt = originalSelect.options[i];
            let detail = '';
            const text = opt.text;
            if (text.includes('(') && text.includes(')')) {
                const match = text.match(/\((.*?)\)/);
                if (match) detail = match[1];
            }
            optionItems.push({
                value: opt.value,
                label: text.replace(/\(.*?\)/, '').trim(),
                detail: detail,
                selected: opt.selected
            });
        }
    }
    refreshOptions();
    
    function render(filter = '') {
        const filterLower = filter.toLowerCase();
        let filtered = optionItems;
        if (filterLower) {
            filtered = optionItems.filter(opt => 
                opt.label.toLowerCase().includes(filterLower) || 
                (opt.detail && opt.detail.toLowerCase().includes(filterLower))
            );
        }
        const limited = filtered.slice(0, limit);
        
        if (limited.length === 0) {
            resultsDiv.innerHTML = '<div class="smart-select-empty">لا توجد نتائج</div>';
            return;
        }
        
        resultsDiv.innerHTML = limited.map(opt => `
            <div class="smart-select-item ${opt.selected ? 'selected' : ''}" data-value="${escapeHtml(opt.value)}">
                <span class="item-label">${escapeHtml(opt.label)}</span>
                ${opt.detail ? `<span class="item-secondary">${escapeHtml(opt.detail)}</span>` : ''}
            </div>
        `).join('');
        
        resultsDiv.querySelectorAll('.smart-select-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const value = item.dataset.value;
                const opt = optionItems.find(o => o.value == value);
                if (opt) {
                    input.value = opt.label;
                    originalSelect.value = opt.value;
                    optionItems.forEach(o => o.selected = (o.value == value));
                    render(filter);
                    dropdown.style.display = 'none';
                    const changeEvent = new Event('change', { bubbles: true });
                    originalSelect.dispatchEvent(changeEvent);
                    if (onSelect) onSelect(opt.value, opt);
                }
            });
        });
    }
    
    input.addEventListener('focus', () => {
        render('');
        dropdown.style.display = 'block';
        clearBtn.style.display = input.value ? 'flex' : 'none';
    });
    
    input.addEventListener('input', (e) => {
        render(e.target.value);
        dropdown.style.display = 'block';
        clearBtn.style.display = e.target.value ? 'flex' : 'none';
    });
    
    input.addEventListener('blur', () => {
        setTimeout(() => {
            if (!dropdown.matches(':hover') && !input.matches(':focus')) {
                dropdown.style.display = 'none';
            }
        }, 150);
    });
    
    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        input.value = '';
        originalSelect.value = '';
        optionItems.forEach(o => o.selected = false);
        render('');
        input.focus();
        clearBtn.style.display = 'none';
        const changeEvent = new Event('change', { bubbles: true });
        originalSelect.dispatchEvent(changeEvent);
        if (onSelect) onSelect(null, null);
    });
    
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
    
    const selectedOption = optionItems.find(o => o.selected);
    if (selectedOption) {
        input.value = selectedOption.label;
    } else if (originalSelect.value) {
        const selectedByValue = optionItems.find(o => o.value == originalSelect.value);
        if (selectedByValue) {
            input.value = selectedByValue.label;
            selectedByValue.selected = true;
        }
    }
    
    function updateOptions(newOptions) {
        while (originalSelect.options.length > 0) {
            originalSelect.remove(0);
        }
        for (const opt of newOptions) {
            const option = document.createElement('option');
            option.value = opt.value;
            option.text = opt.label + (opt.detail ? ` (${opt.detail})` : '');
            if (opt.selected) option.selected = true;
            originalSelect.appendChild(option);
        }
        refreshOptions();
        const selected = optionItems.find(o => o.selected);
        input.value = selected ? selected.label : '';
        if (!selected && originalSelect.value) {
            const byVal = optionItems.find(o => o.value == originalSelect.value);
            if (byVal) input.value = byVal.label;
        }
    }
    
    return { container, input, dropdown, updateOptions };
}
