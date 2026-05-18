// js/customers.js - إدارة العملاء
import { apiCall, refreshCaches, getCache } from './db.js';
import { formatNumber, ICONS, animateEntry, emptyState, toEnglishDigits, escapeHtml, showToast, openModal, confirmDialog, showFormModal, smartSelect } from './utils.js';

let currentPage = 1;
const pageSize = 20;
let allFilteredCustomers = [];

export async function loadCustomers() {
    const container = document.getElementById('tab-content');
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div><h3 class="card-title">العملاء</h3><span class="card-subtitle">إدارة بيانات العملاء وأرصدتهم</span></div>
                <button class="btn btn-primary btn-sm" id="btn-add-customer">${ICONS.plus} إضافة عميل</button>
            </div>
            <div class="form-group"><input type="text" class="input" id="customers-search" placeholder="🔍 بحث بالاسم أو رقم الجوال..."></div>
        </div>
        <div id="customers-list"></div>`;
    document.getElementById('btn-add-customer').addEventListener('click', showAddCustomerModal);
    document.getElementById('customers-search').addEventListener('input', () => { currentPage = 1; renderFilteredCustomers(); });
    await refreshCaches();
    renderFilteredCustomers();
}

function renderFilteredCustomers() {
    const { customers } = getCache();
    const q = document.getElementById('customers-search')?.value.toLowerCase() || '';
    const filtered = customers.filter(c => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q));
    allFilteredCustomers = filtered;
    currentPage = 1;
    renderCustomersPaginated();
}

function renderCustomersPaginated() {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const paginated = allFilteredCustomers.slice(start, end);
    const container = document.getElementById('customers-list');
    if (!paginated.length && currentPage === 1) {
        container.innerHTML = emptyState('لا يوجد عملاء', 'أضف عميلاً جديداً');
        return;
    }
    let html = '';
    paginated.forEach(c => {
        html += `<div class="card card-hover" data-id="${c.id}" style="margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between;">
                <div>
                    <div style="font-weight:900;">${escapeHtml(c.name)}</div>
                    <div style="font-size:13px;">📞 ${escapeHtml(c.phone || '-')} ${c.email ? `✉️ ${escapeHtml(c.email)}` : ''}</div>
                    <div>الرصيد: <span class="${c.balance > 0 ? 'negative' : c.balance < 0 ? 'positive' : ''}">${formatNumber(c.balance)}</span></div>
                </div>
                <div>
                    <button class="btn btn-secondary btn-sm edit-customer" data-id="${c.id}">${ICONS.edit}</button>
                    <button class="btn btn-danger btn-sm delete-customer" data-id="${c.id}">${ICONS.trash}</button>
                </div>
            </div>
        </div>`;
    });
    if (allFilteredCustomers.length > end) {
        html += `<div class="load-more-container" style="text-align:center; margin-top:20px;">
                    <button class="btn btn-secondary" id="load-more-customers">تحميل المزيد (${allFilteredCustomers.length - end} متبقي)</button>
                 </div>`;
    }
    container.innerHTML = html;
    animateEntry('.card', 60);
    
    document.querySelectorAll('.edit-customer').forEach(btn => btn.onclick = async (e) => { e.stopPropagation(); await showEditCustomerModal(btn.dataset.id); });
    document.querySelectorAll('.delete-customer').forEach(btn => btn.onclick = async (e) => {
        e.stopPropagation();
        if (await confirmDialog('حذف العميل؟ سيتم حذف جميع بياناته وفواتيره المرتبطة إن وجدت؟')) {
            try {
                await apiCall(`/customers?id=${btn.dataset.id}`, 'DELETE');
                showToast('تم الحذف', 'success');
                await refreshCaches();
                renderFilteredCustomers();
            } catch(err) { showToast(err.message, 'error'); }
        }
    });
    document.querySelectorAll('.card[data-id]').forEach(card => card.onclick = (e) => {
        if (e.target.closest('.edit-customer') || e.target.closest('.delete-customer')) return;
        showCustomerDetail(card.dataset.id);
    });
    document.getElementById('load-more-customers')?.addEventListener('click', () => {
        currentPage++;
        renderCustomersPaginated();
    });
}

async function showAddCustomerModal() {
    showFormModal({
        title: 'إضافة عميل جديد',
        fields: [
            { id: 'name', label: 'الاسم الكامل' },
            { id: 'phone', label: 'رقم الجوال' },
            { id: 'email', label: 'البريد الإلكتروني' },
            { id: 'address', label: 'العنوان' }
        ],
        onSave: async (v) => {
            if (!v.name) throw new Error('الاسم مطلوب');
            v.phone = toEnglishDigits(v.phone);
            await apiCall('/customers', 'POST', v);
            await refreshCaches();
            renderFilteredCustomers();
            return v;
        }
    });
}

async function showEditCustomerModal(id) {
    const { customers } = getCache();
    const c = customers.find(c => c.id == id);
    if (!c) return showToast('العميل غير موجود', 'error');
    showFormModal({
        title: 'تعديل بيانات العميل',
        fields: [
            { id: 'name', label: 'الاسم الكامل' },
            { id: 'phone', label: 'رقم الجوال' },
            { id: 'email', label: 'البريد الإلكتروني' },
            { id: 'address', label: 'العنوان' }
        ],
        initialValues: { name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '' },
        onSave: async (v) => {
            v.phone = toEnglishDigits(v.phone);
            await apiCall('/customers', 'PUT', { id, ...v });
            await refreshCaches();
            renderFilteredCustomers();
            return v;
        }
    });
}

function showCustomerDetail(id) {
    const { customers, invoices } = getCache();
    const c = customers.find(c => c.id == id);
    if (!c) return;
    const customerInvoices = invoices.filter(i => i.customer_id == id);
    let invoicesHtml = '<ul>';
    customerInvoices.forEach(inv => { invoicesHtml += `<li>فاتورة #${inv.id} - ${formatDate(inv.invoice_date)} - ${formatNumber(inv.total_amount)} - الحالة: ${inv.status}</li>`; });
    invoicesHtml += '</ul>';
    openModal({
        title: escapeHtml(c.name),
        bodyHTML: `<div><strong>الجوال:</strong> ${escapeHtml(c.phone || '-')}</div>
                   <div><strong>البريد:</strong> ${escapeHtml(c.email || '-')}</div>
                   <div><strong>العنوان:</strong> ${escapeHtml(c.address || '-')}</div>
                   <div><strong>الرصيد الحالي:</strong> <span class="${c.balance > 0 ? 'negative' : c.balance < 0 ? 'positive' : ''}">${formatNumber(c.balance)}</span></div>
                   <hr><h4>فواتير العميل</h4>${invoicesHtml || 'لا توجد فواتير'}</div>`,
        footerHTML: `<button class="btn btn-primary" id="new-invoice-for-customer">فاتورة بيع جديدة</button>
                     <button class="btn btn-success" id="add-receipt-for-customer">إضافة دفعة (سند قبض)</button>`
    }).element.querySelectorAll('#new-invoice-for-customer, #add-receipt-for-customer').forEach(btn => {
        if (btn.id === 'new-invoice-for-customer') btn.onclick = () => { btn.closest('.modal-overlay')?.querySelector('.modal-close')?.click(); setTimeout(() => import('./invoices.js').then(m => m.showInvoiceModal('sale', { customerId: c.id })), 200); };
        if (btn.id === 'add-receipt-for-customer') btn.onclick = () => { btn.closest('.modal-overlay')?.querySelector('.modal-close')?.click(); setTimeout(() => import('./vouchers.js').then(m => m.showAddVoucherModal({ type: 'receipt', customer_id: c.id })), 200); };
    });
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ar-EG');
}
