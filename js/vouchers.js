// js/vouchers.js - إدارة سندات القبض والدفع والمصاريف
import { apiCall, refreshCaches, getCache } from './db.js';
import { formatNumber, formatDate, ICONS, animateEntry, emptyState, toEnglishDigits, escapeHtml, showToast, confirmDialog, openModal, smartSelect } from './utils.js';

let currentPage = 1;
const pageSize = 20;
let allFilteredVouchers = [];

export async function loadVouchers() {
    const container = document.getElementById('tab-content');
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div><h3 class="card-title">السندات المالية</h3><span class="card-subtitle">سندات قبض، دفع، ومصاريف</span></div>
                <button class="btn btn-primary btn-sm" id="btn-add-voucher">${ICONS.plus} إضافة سند</button>
            </div>
            <div class="filter-bar">
                <button class="filter-pill active" data-filter="all">الكل</button>
                <button class="filter-pill" data-filter="receipt">قبض</button>
                <button class="filter-pill" data-filter="payment">دفع</button>
                <button class="filter-pill" data-filter="expense">مصروف</button>
            </div>
            <div class="form-group"><input type="text" class="input" id="voucher-search" placeholder="🔍 بحث بالمرجع أو الوصف أو العميل/المورد..."></div>
            <div id="vouchers-summary"></div>
        </div>
        <div id="vouchers-list"></div>`;
    document.getElementById('btn-add-voucher').addEventListener('click', () => showAddVoucherModal());
    document.getElementById('voucher-search').addEventListener('input', () => { currentPage = 1; renderFilteredVouchers(); });
    document.querySelectorAll('.filter-pill').forEach(pill => {
        pill.addEventListener('click', function() {
            document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            currentPage = 1;
            renderFilteredVouchers();
        });
    });
    await refreshCaches();
    renderFilteredVouchers();
}

function renderFilteredVouchers() {
    const { paymentVouchers, customers, suppliers } = getCache();
    const filter = document.querySelector('.filter-pill.active')?.dataset.filter || 'all';
    const search = document.getElementById('voucher-search')?.value.toLowerCase() || '';
    let filtered = paymentVouchers.filter(v => filter === 'all' || v.type === filter);
    filtered = filtered.filter(v => 
        (v.reference || '').toLowerCase().includes(search) ||
        (v.description || '').toLowerCase().includes(search) ||
        (customers.find(c => c.id === v.customer_id)?.name || '').toLowerCase().includes(search) ||
        (suppliers.find(s => s.id === v.supplier_id)?.name || '').toLowerCase().includes(search)
    );
    allFilteredVouchers = filtered;
    currentPage = 1;
    renderVouchersPaginated();
}

function renderVouchersPaginated() {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const paginated = allFilteredVouchers.slice(start, end);
    const container = document.getElementById('vouchers-list');
    const summaryContainer = document.getElementById('vouchers-summary');
    let totalReceipt = 0, totalPayment = 0, totalExpense = 0;
    allFilteredVouchers.forEach(v => {
        if (v.type === 'receipt') totalReceipt += v.amount;
        else if (v.type === 'payment') totalPayment += v.amount;
        else totalExpense += v.amount;
    });
    if (summaryContainer) {
        summaryContainer.innerHTML = `
            <div style="display:flex; gap:24px; flex-wrap:wrap; margin-top:16px; padding:12px; background:var(--bg-secondary); border-radius:var(--radius);">
                <span style="color:var(--success);">📥 إجمالي القبض: ${formatNumber(totalReceipt)}</span>
                <span style="color:var(--danger);">📤 إجمالي الدفع: ${formatNumber(totalPayment)}</span>
                <span style="color:var(--warning);">💸 إجمالي المصاريف: ${formatNumber(totalExpense)}</span>
            </div>`;
    }
    if (!paginated.length && currentPage === 1) {
        container.innerHTML = emptyState('لا توجد سندات', 'أضف سنداً جديداً');
        return;
    }
    let html = '';
    paginated.forEach(v => {
        const typeLabel = v.type === 'receipt' ? 'قبض' : v.type === 'payment' ? 'دفع' : 'مصروف';
        const bgColor = v.type === 'receipt' ? 'var(--success)' : v.type === 'payment' ? 'var(--danger)' : 'var(--warning)';
        const entity = v.customer_id ? getCache().customers.find(c => c.id === v.customer_id)?.name : 
                      v.supplier_id ? getCache().suppliers.find(s => s.id === v.supplier_id)?.name : '';
        const sign = v.type === 'receipt' ? '+' : '-';
        html += `<div class="card card-hover" data-id="${v.id}" style="border-right:4px solid ${bgColor}; margin-bottom:14px; cursor:pointer;">
            <div style="display:flex; justify-content:space-between;">
                <div>
                    <div style="font-weight:900; font-size:22px; color:${bgColor};">${sign} ${formatNumber(v.amount)}</div>
                    <div style="font-size:13px;">${formatDate(v.date)} · ${typeLabel}</div>
                    ${entity ? `<div style="font-size:13px;">👤 ${escapeHtml(entity)}</div>` : ''}
                    ${v.reference ? `<div style="font-size:12px;">المرجع: ${escapeHtml(v.reference)}</div>` : ''}
                    ${v.description ? `<div style="font-size:12px;">${escapeHtml(v.description)}</div>` : ''}
                </div>
            </div>
        </div>`;
    });
    if (allFilteredVouchers.length > end) {
        html += `<div class="load-more-container" style="text-align:center; margin-top:20px;">
                    <button class="btn btn-secondary" id="load-more-vouchers">تحميل المزيد (${allFilteredVouchers.length - end} متبقي)</button>
                 </div>`;
    }
    container.innerHTML = html;
    animateEntry('.card', 60);
    document.getElementById('load-more-vouchers')?.addEventListener('click', () => { currentPage++; renderVouchersPaginated(); });
    container.querySelectorAll('.card[data-id]').forEach(card => card.onclick = () => showVoucherDetail(card.dataset.id));
}

export async function showAddVoucherModal(initial = {}) {
    await refreshCaches();
    const { customers, suppliers, invoices } = getCache();
    const allowNegativeDefault = localStorage.getItem('allowNegativeBalance') === 'true';
    const travelerOptions = customers.map(c => ({ value: c.id, label: c.name, detail: c.phone ? `📞 ${c.phone}` : '' }));
    const companyOptions = suppliers.map(s => ({ value: s.id, label: s.name, detail: s.phone ? `📞 ${s.phone}` : '' }));
    const invoiceOptions = invoices.map(i => ({ value: i.id, label: `#${i.id} - ${i.customer?.name || i.supplier?.name || ''}`, detail: formatNumber(i.total_amount) }));
    const modal = openModal({
        title: 'إضافة سند جديد',
        bodyHTML: `
            <div class="form-group"><label>نوع السند</label><select class="select" id="v-type">
                <option value="receipt" ${initial.type === 'receipt' ? 'selected' : ''}>📥 سند قبض (من عميل)</option>
                <option value="payment" ${initial.type === 'payment' ? 'selected' : ''}>📤 سند دفع (لمورد)</option>
                <option value="expense" ${initial.type === 'expense' ? 'selected' : ''}>💸 سند مصروف (عام)</option>
            </select></div>
            <div class="form-group" id="v-customer-group" style="display:${initial.type === 'receipt' ? 'block' : 'none'};"><label>العميل</label><select class="select" id="v-customer"><option value="">اختر العميل</option>${customers.map(c => `<option value="${c.id}" ${initial.customer_id == c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select></div>
            <div class="form-group" id="v-supplier-group" style="display:${initial.type === 'payment' ? 'block' : 'none'};"><label>المورد</label><select class="select" id="v-supplier"><option value="">اختر المورد</option>${suppliers.map(s => `<option value="${s.id}" ${initial.supplier_id == s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}</select></div>
            <div class="form-group"><label>المبلغ</label><input type="number" step="0.01" class="input" id="v-amount" placeholder="0.00" value="${initial.amount || ''}"></div>
            <div class="form-group"><label>التاريخ</label><input type="date" class="input" id="v-date" value="${initial.date || new Date().toISOString().split('T')[0]}"></div>
            <div class="form-group"><label>الوصف</label><textarea class="textarea" id="v-desc">${escapeHtml(initial.description || '')}</textarea></div>
            <div class="form-group"><label>المرجع (اختياري)</label><input type="text" class="input" id="v-ref" value="${escapeHtml(initial.reference || '')}"></div>
            <div class="form-group"><label>ربط بفاتورة (اختياري)</label><select class="select" id="v-invoice"><option value="">بدون فاتورة</option>${invoices.map(i => `<option value="${i.id}" ${initial.invoice_id == i.id ? 'selected' : ''}>#${i.id} - ${i.customer?.name || i.supplier?.name || ''}</option>`).join('')}</select></div>
            <div class="form-group">
                <label><input type="checkbox" id="allow-negative" ${allowNegativeDefault ? 'checked' : ''}> السماح بالرصيد السالب (تجاوز التحقق)</label>
                <small style="display:block; color:var(--text-muted);">بتفعيل هذا الخيار، يمكن أن يصبح رصيد العميل أو المورد سالباً.</small>
            </div>`,
        footerHTML: `<button class="btn btn-secondary" id="v-cancel">إلغاء</button><button class="btn btn-primary" id="v-save">حفظ</button>`
    });
    const typeSel = modal.element.querySelector('#v-type');
    const customerGroup = modal.element.querySelector('#v-customer-group');
    const supplierGroup = modal.element.querySelector('#v-supplier-group');
    const customerSelect = modal.element.querySelector('#v-customer');
    const supplierSelect = modal.element.querySelector('#v-supplier');
    const amountInput = modal.element.querySelector('#v-amount');
    const allowNegativeCheckbox = modal.element.querySelector('#allow-negative');
    const saveBtn = modal.element.querySelector('#v-save');
    smartSelect(customerSelect, travelerOptions, { placeholder: 'ابحث عن عميل...', limit: 30 });
    smartSelect(supplierSelect, companyOptions, { placeholder: 'ابحث عن مورد...', limit: 30 });
    smartSelect(modal.element.querySelector('#v-invoice'), invoiceOptions, { placeholder: 'ابحث عن فاتورة...', limit: 30 });
    customerSelect.addEventListener('change', () => {
        if (typeSel.value === 'receipt' && customerSelect.value) {
            const cust = customers.find(c => c.id == customerSelect.value);
            if (cust && cust.balance > 0) amountInput.value = cust.balance;
            else amountInput.value = '';
        }
    });
    supplierSelect.addEventListener('change', () => {
        if (typeSel.value === 'payment' && supplierSelect.value) {
            const supp = suppliers.find(s => s.id == supplierSelect.value);
            if (supp && supp.balance > 0) amountInput.value = supp.balance;
            else amountInput.value = '';
        }
    });
    typeSel.addEventListener('change', () => {
        const val = typeSel.value;
        customerGroup.style.display = val === 'receipt' ? 'block' : 'none';
        supplierGroup.style.display = val === 'payment' ? 'block' : 'none';
        amountInput.value = '';
    });
    amountInput.addEventListener('input', (e) => { if(e.target.value) e.target.value = toEnglishDigits(e.target.value); });
    saveBtn.onclick = async () => {
        if (saveBtn.disabled) return;
        const type = typeSel.value;
        const amount = parseFloat(toEnglishDigits(amountInput.value));
        const customerId = customerSelect.value;
        const supplierId = supplierSelect.value;
        if (isNaN(amount) || amount <= 0) return showToast('المبلغ مطلوب وأكبر من صفر', 'error');
        if (type === 'receipt' && !customerId) return showToast('اختر العميل', 'error');
        if (type === 'payment' && !supplierId) return showToast('اختر المورد', 'error');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="loader-inline"></span> جاري الحفظ...';
        try {
            await apiCall('/payment_vouchers', 'POST', {
                type,
                amount,
                date: modal.element.querySelector('#v-date').value,
                description: modal.element.querySelector('#v-desc').value,
                reference: modal.element.querySelector('#v-ref').value || undefined,
                customer_id: type === 'receipt' ? parseInt(customerId) : null,
                supplier_id: type === 'payment' ? parseInt(supplierId) : null,
                invoice_id: modal.element.querySelector('#v-invoice').value || null
            }, { allowNegative: allowNegativeCheckbox.checked });
            await refreshCaches();
            modal.close();
            showToast('تم حفظ السند بنجاح', 'success');
            loadVouchers();
        } catch (e) {
            showToast(e.message, 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'حفظ';
        }
    };
    modal.element.querySelector('#v-cancel').onclick = () => modal.close();
}

async function showVoucherDetail(id) {
    await refreshCaches();
    const { paymentVouchers, customers, suppliers } = getCache();
    const v = paymentVouchers.find(v => v.id == id);
    if (!v) return;
    const typeLabel = v.type === 'receipt' ? 'سند قبض' : v.type === 'payment' ? 'سند دفع' : 'سند مصروف';
    const amountColor = v.type === 'receipt' ? 'var(--success)' : v.type === 'payment' ? 'var(--danger)' : 'var(--warning)';
    const entity = v.customer_id ? customers.find(c => c.id === v.customer_id)?.name : 
                   v.supplier_id ? suppliers.find(s => s.id === v.supplier_id)?.name : '';
    const modal = openModal({
        title: `${typeLabel} ${v.reference ? '- ' + escapeHtml(v.reference) : '#' + v.id}`,
        bodyHTML: `<div>
            <div style="padding:16px; background:var(--bg-secondary); border-radius:12px; margin-bottom:16px;">
                <span style="font-weight:700;">المبلغ</span>
                <span style="font-weight:900; font-size:28px; color:${amountColor};">${v.type === 'receipt' ? '+' : '-'} ${formatNumber(v.amount)}</span>
            </div>
            <div><strong>التاريخ:</strong> ${formatDate(v.date)}</div>
            <div><strong>النوع:</strong> ${typeLabel}</div>
            ${entity ? `<div><strong>الجهة:</strong> ${escapeHtml(entity)}</div>` : ''}
            ${v.reference ? `<div><strong>المرجع:</strong> ${escapeHtml(v.reference)}</div>` : ''}
            ${v.description ? `<div><strong>الوصف:</strong> ${escapeHtml(v.description)}</div>` : ''}
            ${v.invoice_id ? `<div><strong>مرتبط بفاتورة رقم:</strong> ${v.invoice_id}</div>` : ''}
        </div>`,
        footerHTML: `<button class="btn btn-danger" id="delete-voucher">🗑️ حذف السند</button>`
    });
    modal.element.querySelector('#delete-voucher').onclick = async () => {
        const allowNegative = localStorage.getItem('allowNegativeBalance') === 'true';
        if (await confirmDialog('هل أنت متأكد من حذف هذا السند؟ سيتم عكس التأثير المالي.')) {
            try {
                await apiCall(`/payment_vouchers?id=${v.id}`, 'DELETE', {}, { allowNegative });
                await refreshCaches();
                modal.close();
                showToast('تم الحذف بنجاح', 'success');
                loadVouchers();
            } catch (e) {
                showToast(e.message, 'error');
            }
        }
    };
}

export default loadVouchers;
