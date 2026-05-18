// js/items.js - إدارة المواد والخدمات (مع نظام الوحدات)
import { apiCall, refreshCaches, getCache } from './db.js';
import { formatNumber, ICONS, animateEntry, emptyState, debounce, toEnglishDigits, escapeHtml, showToast, openModal, confirmDialog, showFormModal, smartSelect } from './utils.js';

let currentPage = 1;
const pageSize = 20;
let allFilteredItems = [];

export async function loadItems() {
    const container = document.getElementById('tab-content');
    await refreshCaches();
    const { units, suppliers } = getCache();
    const supplierOptions = suppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div><h3 class="card-title">المواد والخدمات</h3><span class="card-subtitle">إدارة المواد مع وحدات القياس المتعددة</span></div>
                <button class="btn btn-primary btn-sm" id="btn-add-item">${ICONS.plus} إضافة مادة</button>
            </div>
            <div class="form-group"><input type="text" class="input" id="items-search" placeholder="🔍 بحث في المواد..."></div>
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                <select class="select" id="supplier-filter" style="width: auto; min-width: 140px;">
                    <option value="all">كل الموردين</option>
                    ${supplierOptions}
                </select>
                <select class="select" id="type-filter" style="width: auto; min-width: 140px;">
                    <option value="all">كل الأنواع</option>
                    <option value="product">منتج</option>
                    <option value="service">خدمة</option>
                </select>
            </div>
            <div id="low-stock-alert" style="display:none; background:var(--warning-light); border:1px solid var(--warning); border-radius:12px; padding:12px; margin-top:16px; font-weight:700;"></div>
        </div>
        <div id="items-list"></div>`;
    document.getElementById('btn-add-item').addEventListener('click', showAddItemModal);
    document.getElementById('items-search').addEventListener('input', debounce(() => { currentPage = 1; renderFilteredItems(); }, 200));
    document.getElementById('supplier-filter').addEventListener('change', () => { currentPage = 1; renderFilteredItems(); });
    document.getElementById('type-filter').addEventListener('change', () => { currentPage = 1; renderFilteredItems(); });
    renderFilteredItems();
}

function renderFilteredItems() {
    const { items } = getCache();
    const search = document.getElementById('items-search')?.value.toLowerCase() || '';
    const supplierFilter = document.getElementById('supplier-filter')?.value || 'all';
    const typeFilter = document.getElementById('type-filter')?.value || 'all';
    let filtered = items.filter(i => i.name.toLowerCase().includes(search));
    if (supplierFilter !== 'all') filtered = filtered.filter(i => i.supplier_id == supplierFilter);
    if (typeFilter !== 'all') filtered = filtered.filter(i => i.type === typeFilter);
    allFilteredItems = filtered;
    currentPage = 1;
    renderItemsPaginated();
    const lowStockCount = items.filter(i => (i.available || 0) < 5).length;
    const alertDiv = document.getElementById('low-stock-alert');
    if (alertDiv) {
        if (lowStockCount > 0) {
            alertDiv.style.display = 'block';
            alertDiv.innerHTML = `⚠️ يوجد ${lowStockCount} مواد منخفضة المخزون (أقل من 5 وحدات أساسية)`;
        } else {
            alertDiv.style.display = 'none';
        }
    }
}

function renderItemsPaginated() {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const paginated = allFilteredItems.slice(start, end);
    const container = document.getElementById('items-list');
    if (!paginated.length && currentPage === 1) {
        container.innerHTML = emptyState('لا توجد مواد مطابقة', 'أضف مادة جديدة');
        return;
    }
    let html = '<div style="display:grid; gap:16px; grid-template-columns:repeat(auto-fill,minmax(320px,1fr));">';
    paginated.forEach(item => {
        const baseUnitName = item.base_unit?.name || item.base_unit?.abbreviation || 'قطعة';
        const available = item.available || 0;
        const stockStatus = available <= 0 ? 'نفذ' : available < 5 ? 'منخفض' : 'متوفر';
        const stockColor = available <= 0 ? 'var(--danger)' : available < 5 ? 'var(--warning)' : 'var(--success)';
        const subUnits = (item.item_units || []).map(iu => {
            const unitName = iu.unit?.name || iu.unit?.abbreviation || 'وحدة';
            return `${unitName} (x${iu.conversion_factor})`;
        }).join(', ');
        html += `<div class="card card-hover" data-id="${item.id}" style="cursor:pointer;">
            <div style="display:flex; justify-content:space-between;">
                <div>
                    <div style="font-weight:900;">${escapeHtml(item.name)}</div>
                    <div style="font-size:12px; margin-top:4px;">
                        <span style="background:${stockColor}20; color:${stockColor}; padding:2px 8px; border-radius:12px;">${available} ${baseUnitName} (${stockStatus})</span>
                        <span style="background:var(--primary-light); color:var(--primary); padding:2px 8px; border-radius:12px; margin-right:8px;">${formatNumber(item.selling_price || 0)}</span>
                    </div>
                    ${subUnits ? `<div style="font-size:11px; color:var(--text-muted); margin-top:6px;">وحدات فرعية: ${escapeHtml(subUnits)}</div>` : ''}
                    ${item.supplier ? `<div style="font-size:11px; margin-top:4px;">المورد: ${escapeHtml(item.supplier.name)}</div>` : ''}
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-secondary btn-sm edit-item" data-id="${item.id}">${ICONS.edit}</button>
                    <button class="btn btn-danger btn-sm delete-item" data-id="${item.id}">${ICONS.trash}</button>
                </div>
            </div>
        </div>`;
    });
    html += '</div>';
    if (allFilteredItems.length > end) {
        html += `<div class="load-more-container" style="text-align:center; margin-top:20px;">
                    <button class="btn btn-secondary" id="load-more-items">تحميل المزيد (${allFilteredItems.length - end} متبقي)</button>
                 </div>`;
    }
    container.innerHTML = html;
    animateEntry('.card', 60);
    document.getElementById('load-more-items')?.addEventListener('click', () => { currentPage++; renderItemsPaginated(); });
    container.querySelectorAll('.edit-item').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); showEditItemModal(btn.dataset.id); });
    container.querySelectorAll('.delete-item').forEach(btn => btn.onclick = async (e) => {
        e.stopPropagation();
        if (await confirmDialog('حذف المادة؟')) {
            try {
                await apiCall(`/items?id=${btn.dataset.id}`, 'DELETE');
                await refreshCaches();
                renderFilteredItems();
                showToast('تم الحذف', 'success');
            } catch(err) { showToast(err.message, 'error'); }
        }
    });
    container.querySelectorAll('.card[data-id]').forEach(card => card.onclick = (e) => {
        if (e.target.closest('.edit-item') || e.target.closest('.delete-item')) return;
        showItemDetail(card.dataset.id);
    });
}

export function getUnitOptionsForItem(itemId, selectedUnitId = null) {
    const { items, units } = getCache();
    const item = items.find(i => i.id == itemId);
    if (!item) return '<option value="">اختر مادة</option>';
    const baseUnit = units.find(u => u.id == item.base_unit_id) || {};
    const baseName = baseUnit.name || baseUnit.abbreviation || 'قطعة';
    const basePrice = item.selling_price || item.price || 0;
    let opts = `<option value="" data-factor="1" data-base-price="${basePrice}" ${!selectedUnitId ? 'selected' : ''}>${baseName} (أساسية)</option>`;
    (item.item_units || []).forEach(iu => {
        const unit = units.find(u => u.id == iu.unit_id) || {};
        const name = unit.name || unit.abbreviation || 'وحدة';
        opts += `<option value="${iu.unit_id}" data-factor="${iu.conversion_factor}" data-base-price="${basePrice}" ${iu.unit_id == selectedUnitId ? 'selected' : ''}>${name} (x${iu.conversion_factor})</option>`;
    });
    return opts;
}

async function showItemDetail(id) {
    await refreshCaches();
    const { items } = getCache();
    const item = items.find(i => i.id == id);
    if (!item) return;
    const baseUnitName = item.base_unit?.name || item.base_unit?.abbreviation || 'قطعة';
    const subUnitsHtml = (item.item_units || []).map(iu => {
        const unitName = iu.unit?.name || iu.unit?.abbreviation || 'وحدة';
        return `<div style="background:var(--bg-secondary); border-radius:12px; padding:12px; margin-bottom:8px;">
                    <strong>${escapeHtml(unitName)}</strong> : 1 وحدة = ${iu.conversion_factor} ${baseUnitName}
                </div>`;
    }).join('');
    openModal({
        title: escapeHtml(item.name),
        bodyHTML: `<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                        <div><strong>السعر:</strong> ${formatNumber(item.selling_price || item.price)}</div>
                        <div><strong>سعر الشراء:</strong> ${formatNumber(item.purchase_price || 0)}</div>
                        <div><strong>الكمية المتوفرة:</strong> ${formatNumber(item.available)} ${baseUnitName}</div>
                        <div><strong>متوسط التكلفة:</strong> ${formatNumber(item.average_cost)}</div>
                        <div><strong>المورد:</strong> ${item.supplier ? escapeHtml(item.supplier.name) : '-'}</div>
                        <div><strong>النوع:</strong> ${item.type === 'product' ? 'منتج' : 'خدمة'}</div>
                    </div>
                    ${subUnitsHtml ? `<div style="margin-top:16px;"><strong>الوحدات الفرعية:</strong>${subUnitsHtml}</div>` : ''}
                    ${item.description ? `<div style="margin-top:16px;"><strong>الوصف:</strong> ${escapeHtml(item.description)}</div>` : ''}`,
        footerHTML: `<button class="btn btn-secondary" id="close-detail">إغلاق</button>
                     <button class="btn btn-primary" id="edit-from-detail">تعديل</button>
                     <button class="btn btn-success" id="sell-from-detail">بيع</button>
                     <button class="btn btn-warning" id="purchase-from-detail">شراء</button>`
    }).element.querySelectorAll('#edit-from-detail, #sell-from-detail, #purchase-from-detail, #close-detail').forEach(btn => {
        if (btn.id === 'close-detail') btn.onclick = () => btn.closest('.modal-overlay')?.querySelector('.modal-close')?.click();
        if (btn.id === 'edit-from-detail') btn.onclick = () => { btn.closest('.modal-overlay')?.querySelector('.modal-close')?.click(); setTimeout(() => showEditItemModal(id), 200); };
        if (btn.id === 'sell-from-detail') btn.onclick = () => { btn.closest('.modal-overlay')?.querySelector('.modal-close')?.click(); setTimeout(() => import('./invoices.js').then(m => m.showInvoiceModal('sale', { itemId: id })), 200); };
        if (btn.id === 'purchase-from-detail') btn.onclick = () => { btn.closest('.modal-overlay')?.querySelector('.modal-close')?.click(); setTimeout(() => import('./invoices.js').then(m => m.showInvoiceModal('purchase', { itemId: id })), 200); };
    });
}

async function showAddItemModal() {
    await refreshCaches();
    const { units, suppliers } = getCache();
    const unitOptions = units.map(u => `<option value="${u.id}">${escapeHtml(u.name)} (${escapeHtml(u.abbreviation || '-')})</option>`).join('');
    const supplierOptions = suppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    const modal = openModal({
        title: 'إضافة مادة جديدة',
        bodyHTML: `
            <div class="form-group"><label>اسم المادة</label><input type="text" class="input" id="item-name" placeholder="مثال: قلم حبر"></div>
            <div class="form-group"><label>النوع</label><select class="select" id="item-type"><option value="product">منتج (مخزون)</option><option value="service">خدمة (بدون مخزون)</option></select></div>
            <div class="form-group"><label>المورد</label><select class="select" id="item-supplier"><option value="">بدون مورد</option>${supplierOptions}</select></div>
            <div class="form-group"><label>الوحدة الأساسية</label><select class="select" id="item-base-unit">${unitOptions}</select><small class="text-muted">الوحدة التي سيتم التخزين بها</small></div>
            <div class="form-group"><label>سعر البيع (للوحدة الأساسية)</label><input type="number" step="0.01" class="input" id="item-selling-price" placeholder="0.00"></div>
            <div class="form-group"><label>سعر الشراء (للوحدة الأساسية)</label><input type="number" step="0.01" class="input" id="item-purchase-price" placeholder="0.00"></div>
            <div class="form-group"><label>الكمية الافتتاحية (بالوحدة الأساسية)</label><input type="number" step="0.01" class="input" id="item-quantity" placeholder="0"></div>
            <div class="form-group"><label>الوصف</label><textarea class="textarea" id="item-description" placeholder="وصف المادة"></textarea></div>
            <hr>
            <h4>الوحدات الفرعية (اختياري)</h4>
            <div id="sub-units-container">
                <div class="sub-unit-row" style="display:flex; gap:10px; margin-bottom:10px;">
                    <select class="select sub-unit-select" style="flex:2;"><option value="">اختر الوحدة الفرعية</option>${unitOptions}</select>
                    <input type="number" step="0.01" class="input sub-unit-factor" placeholder="عامل التحويل" style="flex:1;">
                    <button class="btn btn-danger btn-sm remove-sub-unit" type="button">×</button>
                </div>
            </div>
            <button class="btn btn-secondary btn-sm" id="add-sub-unit" type="button">${ICONS.plus} إضافة وحدة فرعية</button>
        `,
        footerHTML: `<button class="btn btn-secondary" id="cancel-item">إلغاء</button><button class="btn btn-primary" id="save-item">حفظ</button>`
    });
    const container = modal.element.querySelector('#sub-units-container');
    const addBtn = modal.element.querySelector('#add-sub-unit');
    function addSubUnitRow() {
        const row = document.createElement('div');
        row.className = 'sub-unit-row';
        row.style.display = 'flex';
        row.style.gap = '10px';
        row.style.marginBottom = '10px';
        row.innerHTML = `
            <select class="select sub-unit-select" style="flex:2;">${unitOptions}</select>
            <input type="number" step="0.01" class="input sub-unit-factor" placeholder="عامل التحويل" style="flex:1;">
            <button class="btn btn-danger btn-sm remove-sub-unit" type="button">×</button>
        `;
        row.querySelector('.remove-sub-unit').addEventListener('click', () => row.remove());
        container.appendChild(row);
    }
    addBtn.addEventListener('click', addSubUnitRow);
    const saveBtn = modal.element.querySelector('#save-item');
    const cancelBtn = modal.element.querySelector('#cancel-item');
    saveBtn.onclick = async () => {
        if (saveBtn.disabled) return;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="loader-inline"></span> جاري الحفظ...';
        try {
            const name = modal.element.querySelector('#item-name').value.trim();
            if (!name) throw new Error('اسم المادة مطلوب');
            const type = modal.element.querySelector('#item-type').value;
            const supplier_id = modal.element.querySelector('#item-supplier').value || null;
            const base_unit_id = modal.element.querySelector('#item-base-unit').value;
            if (!base_unit_id) throw new Error('الوحدة الأساسية مطلوبة');
            const selling_price = parseFloat(toEnglishDigits(modal.element.querySelector('#item-selling-price').value)) || 0;
            const purchase_price = parseFloat(toEnglishDigits(modal.element.querySelector('#item-purchase-price').value)) || 0;
            const quantity = parseFloat(toEnglishDigits(modal.element.querySelector('#item-quantity').value)) || 0;
            const description = modal.element.querySelector('#item-description').value;
            const item_units = [];
            const rows = modal.element.querySelectorAll('.sub-unit-row');
            for (const row of rows) {
                const unit_id = row.querySelector('.sub-unit-select').value;
                const factor = parseFloat(toEnglishDigits(row.querySelector('.sub-unit-factor').value));
                if (unit_id && factor && factor > 0) {
                    item_units.push({ unit_id: parseInt(unit_id), conversion_factor: factor });
                }
            }
            await apiCall('/items', 'POST', {
                name, type, supplier_id, base_unit_id, selling_price, purchase_price,
                quantity, description, item_units
            });
            await refreshCaches();
            modal.close();
            showToast('تم إضافة المادة بنجاح', 'success');
            renderFilteredItems();
        } catch (e) {
            showToast(e.message || 'حدث خطأ', 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = `${ICONS.check} حفظ`;
        }
    };
    cancelBtn.onclick = () => modal.close();
}

async function showEditItemModal(id) {
    await refreshCaches();
    const { items, units, suppliers } = getCache();
    const item = items.find(i => i.id == id);
    if (!item) { showToast('المادة غير موجودة', 'error'); return; }
    const unitOptions = units.map(u => `<option value="${u.id}" ${item.base_unit_id == u.id ? 'selected' : ''}>${escapeHtml(u.name)} (${escapeHtml(u.abbreviation || '-')})</option>`).join('');
    const supplierOptions = suppliers.map(s => `<option value="${s.id}" ${item.supplier_id == s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
    let subUnitsHtml = '';
    (item.item_units || []).forEach(iu => {
        subUnitsHtml += `<div class="sub-unit-row" style="display:flex; gap:10px; margin-bottom:10px;">
            <select class="select sub-unit-select" style="flex:2;">${units.map(u => `<option value="${u.id}" ${iu.unit_id == u.id ? 'selected' : ''}>${escapeHtml(u.name)}</option>`).join('')}</select>
            <input type="number" step="0.01" class="input sub-unit-factor" value="${iu.conversion_factor}" placeholder="عامل التحويل" style="flex:1;">
            <button class="btn btn-danger btn-sm remove-sub-unit" type="button">×</button>
        </div>`;
    });
    if (!subUnitsHtml) subUnitsHtml = `<div class="sub-unit-row" style="display:flex; gap:10px;"><select class="select sub-unit-select" style="flex:2;">${units.map(u => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('')}</select><input type="number" step="0.01" class="input sub-unit-factor" placeholder="عامل التحويل" style="flex:1;"><button class="btn btn-danger btn-sm remove-sub-unit" type="button">×</button></div>`;
    const modal = openModal({
        title: `تعديل المادة: ${escapeHtml(item.name)}`,
        bodyHTML: `
            <div class="form-group"><label>اسم المادة</label><input type="text" class="input" id="item-name" value="${escapeHtml(item.name)}"></div>
            <div class="form-group"><label>النوع</label><select class="select" id="item-type"><option value="product" ${item.type === 'product' ? 'selected' : ''}>منتج</option><option value="service" ${item.type === 'service' ? 'selected' : ''}>خدمة</option></select></div>
            <div class="form-group"><label>المورد</label><select class="select" id="item-supplier"><option value="">بدون مورد</option>${supplierOptions}</select></div>
            <div class="form-group"><label>الوحدة الأساسية</label><select class="select" id="item-base-unit">${unitOptions}</select></div>
            <div class="form-group"><label>سعر البيع</label><input type="number" step="0.01" class="input" id="item-selling-price" value="${item.selling_price || 0}"></div>
            <div class="form-group"><label>سعر الشراء</label><input type="number" step="0.01" class="input" id="item-purchase-price" value="${item.purchase_price || 0}"></div>
            <div class="form-group"><label>الكمية الحالية (بالوحدة الأساسية)</label><input type="number" step="0.01" class="input" id="item-quantity" value="${item.quantity || 0}"></div>
            <div class="form-group"><label>الوصف</label><textarea class="textarea" id="item-description">${escapeHtml(item.description || '')}</textarea></div>
            <hr>
            <h4>الوحدات الفرعية</h4>
            <div id="sub-units-container">${subUnitsHtml}</div>
            <button class="btn btn-secondary btn-sm" id="add-sub-unit" type="button">${ICONS.plus} إضافة وحدة فرعية</button>
        `,
        footerHTML: `<button class="btn btn-secondary" id="cancel-item">إلغاء</button><button class="btn btn-primary" id="save-item">حفظ</button>`
    });
    const container = modal.element.querySelector('#sub-units-container');
    const addBtn = modal.element.querySelector('#add-sub-unit');
    function addSubUnitRow() {
        const row = document.createElement('div');
        row.className = 'sub-unit-row';
        row.style.display = 'flex';
        row.style.gap = '10px';
        row.style.marginBottom = '10px';
        row.innerHTML = `
            <select class="select sub-unit-select" style="flex:2;">${units.map(u => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('')}</select>
            <input type="number" step="0.01" class="input sub-unit-factor" placeholder="عامل التحويل" style="flex:1;">
            <button class="btn btn-danger btn-sm remove-sub-unit" type="button">×</button>
        `;
        row.querySelector('.remove-sub-unit').addEventListener('click', () => row.remove());
        container.appendChild(row);
    }
    addBtn.addEventListener('click', addSubUnitRow);
    modal.element.querySelectorAll('.remove-sub-unit').forEach(btn => btn.addEventListener('click', () => btn.closest('.sub-unit-row').remove()));
    const saveBtn = modal.element.querySelector('#save-item');
    const cancelBtn = modal.element.querySelector('#cancel-item');
    saveBtn.onclick = async () => {
        if (saveBtn.disabled) return;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="loader-inline"></span> جاري الحفظ...';
        try {
            const name = modal.element.querySelector('#item-name').value.trim();
            if (!name) throw new Error('اسم المادة مطلوب');
            const type = modal.element.querySelector('#item-type').value;
            const supplier_id = modal.element.querySelector('#item-supplier').value || null;
            const base_unit_id = modal.element.querySelector('#item-base-unit').value;
            const selling_price = parseFloat(toEnglishDigits(modal.element.querySelector('#item-selling-price').value)) || 0;
            const purchase_price = parseFloat(toEnglishDigits(modal.element.querySelector('#item-purchase-price').value)) || 0;
            const quantity = parseFloat(toEnglishDigits(modal.element.querySelector('#item-quantity').value)) || 0;
            const description = modal.element.querySelector('#item-description').value;
            const item_units = [];
            const rows = modal.element.querySelectorAll('.sub-unit-row');
            for (const row of rows) {
                const unit_id = row.querySelector('.sub-unit-select').value;
                const factor = parseFloat(toEnglishDigits(row.querySelector('.sub-unit-factor').value));
                if (unit_id && factor && factor > 0) {
                    item_units.push({ unit_id: parseInt(unit_id), conversion_factor: factor });
                }
            }
            await apiCall('/items', 'PUT', {
                id: parseInt(id), name, type, supplier_id, base_unit_id, selling_price, purchase_price,
                quantity, description, item_units
            });
            await refreshCaches();
            modal.close();
            showToast('تم تعديل المادة بنجاح', 'success');
            renderFilteredItems();
        } catch (e) {
            showToast(e.message || 'حدث خطأ', 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = `${ICONS.check} حفظ`;
        }
    };
    cancelBtn.onclick = () => modal.close();
}

export default loadItems;
