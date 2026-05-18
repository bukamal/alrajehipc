// js/suppliers.js - إدارة الموردين
import { apiCall, refreshCaches, getCache } from './db.js';
import { formatNumber, ICONS, animateEntry, emptyState, toEnglishDigits, escapeHtml, showToast, openModal, confirmDialog, showFormModal } from './utils.js';

let currentPage = 1;
const pageSize = 20;
let allFilteredSuppliers = [];

export async function loadSuppliers() {
    const container = document.getElementById('tab-content');
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div><h3 class="card-title">الموردون</h3><span class="card-subtitle">إدارة بيانات الموردين وأرصدتهم</span></div>
                <button class="btn btn-primary btn-sm" id="btn-add-supplier">${ICONS.plus} إضافة مورد</button>
            </div>
            <div class="form-group"><input type="text" class="input" id="suppliers-search" placeholder="🔍 بحث بالاسم أو رقم الجوال..."></div>
        </div>
        <div id="suppliers-list"></div>`;
    document.getElementById('btn-add-supplier').addEventListener('click', showAddSupplierModal);
    document.getElementById('suppliers-search').addEventListener('input', () => { currentPage = 1; renderFilteredSuppliers(); });
    await refreshCaches();
    renderFilteredSuppliers();
}

function renderFilteredSuppliers() {
    const { suppliers } = getCache();
    const q = document.getElementById('suppliers-search')?.value.toLowerCase() || '';
    const filtered = suppliers.filter(s => s.name.toLowerCase().includes(q) || (s.phone || '').includes(q));
    allFilteredSuppliers = filtered;
    currentPage = 1;
    renderSuppliersPaginated();
}

function renderSuppliersPaginated() {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const paginated = allFilteredSuppliers.slice(start, end);
    const container = document.getElementById('suppliers-list');
    if (!paginated.length && currentPage === 1) {
        container.innerHTML = emptyState('لا يوجد موردون', 'أضف مورداً جديداً');
        return;
    }
    let html = '';
    paginated.forEach(s => {
        html += `<div class="card card-hover" data-id="${s.id}" style="margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between;">
                <div>
                    <div style="font-weight:900;">${escapeHtml(s.name)}</div>
                    <div style="font-size:13px;">📞 ${escapeHtml(s.phone || '-')}</div>
                    <div>جهة الاتصال: ${escapeHtml(s.contact_person || '-')}</div>
                    <div>الرصيد: <span class="${s.balance > 0 ? 'negative' : s.balance < 0 ? 'positive' : ''}">${formatNumber(s.balance)}</span></div>
                </div>
                <div>
                    <button class="btn btn-secondary btn-sm edit-supplier" data-id="${s.id}">${ICONS.edit}</button>
                    <button class="btn btn-danger btn-sm delete-supplier" data-id="${s.id}">${ICONS.trash}</button>
                </div>
            </div>
        </div>`;
    });
    if (allFilteredSuppliers.length > end) {
        html += `<div class="load-more-container" style="text-align:center; margin-top:20px;">
                    <button class="btn btn-secondary" id="load-more-suppliers">تحميل المزيد (${allFilteredSuppliers.length - end} متبقي)</button>
                 </div>`;
    }
    container.innerHTML = html;
    animateEntry('.card', 60);
    
    document.querySelectorAll('.edit-supplier').forEach(btn => btn.onclick = async (e) => { e.stopPropagation(); await showEditSupplierModal(btn.dataset.id); });
    document.querySelectorAll('.delete-supplier').forEach(btn => btn.onclick = async (e) => {
        e.stopPropagation();
        if (await confirmDialog('حذف المورد؟ سيتم حذف جميع بياناته ومواده وفواتيره المرتبطة إن وجدت؟')) {
            try {
                await apiCall(`/suppliers?id=${btn.dataset.id}`, 'DELETE');
                showToast('تم الحذف', 'success');
                await refreshCaches();
                renderFilteredSuppliers();
            } catch(err) { showToast(err.message, 'error'); }
        }
    });
    document.querySelectorAll('.card[data-id]').forEach(card => card.onclick = (e) => {
        if (e.target.closest('.edit-supplier') || e.target.closest('.delete-supplier')) return;
        showSupplierDetail(card.dataset.id);
    });
    document.getElementById('load-more-suppliers')?.addEventListener('click', () => {
        currentPage++;
        renderSuppliersPaginated();
    });
}

async function showAddSupplierModal() {
    showFormModal({
        title: 'إضافة مورد جديد',
        fields: [
            { id: 'name', label: 'اسم المورد' },
            { id: 'phone', label: 'رقم الجوال' },
            { id: 'contact_person', label: 'جهة الاتصال' }
        ],
        onSave: async (v) => {
            if (!v.name) throw new Error('الاسم مطلوب');
            v.phone = toEnglishDigits(v.phone);
            await apiCall('/suppliers', 'POST', v);
            await refreshCaches();
            renderFilteredSuppliers();
            return v;
        }
    });
}

async function showEditSupplierModal(id) {
    const { suppliers } = getCache();
    const s = suppliers.find(s => s.id == id);
    if (!s) return showToast('المورد غير موجود', 'error');
    showFormModal({
        title: 'تعديل بيانات المورد',
        fields: [
            { id: 'name', label: 'اسم المورد' },
            { id: 'phone', label: 'رقم الجوال' },
            { id: 'contact_person', label: 'جهة الاتصال' }
        ],
        initialValues: { name: s.name, phone: s.phone || '', contact_person: s.contact_person || '' },
        onSave: async (v) => {
            v.phone = toEnglishDigits(v.phone);
            await apiCall('/suppliers', 'PUT', { id, ...v });
            await refreshCaches();
            renderFilteredSuppliers();
            return v;
        }
    });
}

function showSupplierDetail(id) {
    const { suppliers, invoices, items } = getCache();
    const s = suppliers.find(s => s.id == id);
    if (!s) return;
    const supplierInvoices = invoices.filter(i => i.supplier_id == id);
    const supplierItems = items.filter(i => i.supplier_id == id);
    let invoicesHtml = '<ul>';
    supplierInvoices.forEach(inv => { invoicesHtml += `<li>فاتورة شراء #${inv.id} - ${formatDate(inv.invoice_date)} - ${formatNumber(inv.total_amount)}</li>`; });
    invoicesHtml += '</ul>';
    let itemsHtml = '<ul>';
    supplierItems.forEach(it => { itemsHtml += `<li>${escapeHtml(it.name)}</li>`; });
    itemsHtml += '</ul>';
    openModal({
        title: escapeHtml(s.name),
        bodyHTML: `<div><strong>الجوال:</strong> ${escapeHtml(s.phone || '-')}</div>
                   <div><strong>جهة الاتصال:</strong> ${escapeHtml(s.contact_person || '-')}</div>
                   <div><strong>الرصيد الحالي:</strong> <span class="${s.balance > 0 ? 'negative' : s.balance < 0 ? 'positive' : ''}">${formatNumber(s.balance)}</span></div>
                   <hr><h4>فواتير الشراء</h4>${invoicesHtml || 'لا توجد فواتير'}
                   <hr><h4>المواد الموردة</h4>${itemsHtml || 'لا توجد مواد'}</div>`,
        footerHTML: `<button class="btn btn-primary" id="new-purchase-invoice">فاتورة شراء جديدة</button>
                     <button class="btn btn-success" id="add-payment-for-supplier">إضافة دفعة (سند دفع)</button>`
    }).element.querySelectorAll('#new-purchase-invoice, #add-payment-for-supplier').forEach(btn => {
        if (btn.id === 'new-purchase-invoice') btn.onclick = () => { btn.closest('.modal-overlay')?.querySelector('.modal-close')?.click(); setTimeout(() => import('./invoices.js').then(m => m.showInvoiceModal('purchase', { supplierId: s.id })), 200); };
        if (btn.id === 'add-payment-for-supplier') btn.onclick = () => { btn.closest('.modal-overlay')?.querySelector('.modal-close')?.click(); setTimeout(() => import('./vouchers.js').then(m => m.showAddVoucherModal({ type: 'payment', supplier_id: s.id })), 200); };
    });
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ar-EG');
}
