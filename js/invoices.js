// js/invoices.js - إدارة الفواتير (مبيعات ومشتريات) مع دعم الوحدات
import { apiCall, refreshCaches, getCache } from './db.js';
import { formatNumber, formatDate, ICONS, animateEntry, emptyState, toEnglishDigits, escapeHtml, showToast, openModal, confirmDialog } from './utils.js';
import { getUnitOptionsForItem } from './items.js';

let currentPage = 1;
const pageSize = 20;
let allFilteredInvoices = [];

export async function loadInvoices() {
    const container = document.getElementById('tab-content');
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div><h3 class="card-title">الفواتير</h3><span class="card-subtitle">سجل فواتير المبيعات والمشتريات</span></div>
                <button class="btn btn-primary btn-sm" id="btn-new-invoice">${ICONS.plus} فاتورة جديدة</button>
            </div>
            <div class="filter-bar">
                <button class="filter-pill active" data-filter="all">الكل</button>
                <button class="filter-pill" data-filter="sale">مبيعات</button>
                <button class="filter-pill" data-filter="purchase">مشتريات</button>
            </div>
            <div class="form-group"><input type="text" class="input" id="invoices-search" placeholder="🔍 بحث بالعميل/المورد أو رقم الفاتورة..."></div>
        </div>
        <div id="invoices-list"></div>`;
    document.getElementById('btn-new-invoice').addEventListener('click', () => showInvoiceModal());
    document.getElementById('invoices-search').addEventListener('input', () => { currentPage = 1; renderFilteredInvoices(); });
    document.querySelectorAll('.filter-pill').forEach(pill => {
        pill.addEventListener('click', function() {
            document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            currentPage = 1;
            renderFilteredInvoices();
        });
    });
    await refreshCaches();
    renderFilteredInvoices();
}

function renderFilteredInvoices() {
    const { invoices } = getCache();
    const filter = document.querySelector('.filter-pill.active')?.dataset.filter || 'all';
    const search = document.getElementById('invoices-search')?.value.toLowerCase() || '';
    let filtered = invoices.filter(i => filter === 'all' || i.type === filter);
    filtered = filtered.filter(i => 
        (i.customer?.name || '').toLowerCase().includes(search) ||
        (i.supplier?.name || '').toLowerCase().includes(search) ||
        i.id.toString().includes(search) ||
        formatNumber(i.total_amount).includes(search)
    );
    allFilteredInvoices = filtered;
    currentPage = 1;
    renderInvoicesPaginated();
}

function renderInvoicesPaginated() {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const paginated = allFilteredInvoices.slice(start, end);
    const container = document.getElementById('invoices-list');
    if (!paginated.length && currentPage === 1) {
        container.innerHTML = emptyState('لا توجد فواتير', 'أنشئ فاتورة جديدة');
        return;
    }
    let html = '';
    paginated.forEach(inv => {
        const typeLabel = inv.type === 'sale' ? 'بيع' : 'شراء';
        const entity = inv.customer?.name || inv.supplier?.name || 'نقدي';
        const balance = inv.balance || 0;
        const statusColor = balance <= 0 ? 'var(--success)' : 'var(--danger)';
        html += `<div class="card card-hover" data-id="${inv.id}" style="cursor:pointer; margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between;">
                <div>
                    <div style="font-weight:900;">فاتورة ${typeLabel} #${inv.id}</div>
                    <div style="font-size:13px;">📅 ${formatDate(inv.invoice_date)}</div>
                    <div style="font-size:13px;">👤 ${escapeHtml(entity)}</div>
                </div>
                <div style="text-align:left;">
                    <div style="font-size:20px; font-weight:900;">${formatNumber(inv.total_amount)}</div>
                    <div style="font-size:12px;">مدفوع: ${formatNumber(inv.paid || 0)}</div>
                    <div style="font-size:12px; color:${statusColor};">المتبقي: ${formatNumber(balance)}</div>
                </div>
            </div>
            ${inv.notes ? `<div style="margin-top:8px; font-size:12px; color:var(--text-muted);">ملاحظات: ${escapeHtml(inv.notes)}</div>` : ''}
        </div>`;
    });
    if (allFilteredInvoices.length > end) {
        html += `<div class="load-more-container" style="text-align:center; margin-top:20px;">
                    <button class="btn btn-secondary" id="load-more-invoices">تحميل المزيد (${allFilteredInvoices.length - end} متبقي)</button>
                 </div>`;
    }
    container.innerHTML = html;
    animateEntry('.card', 60);
    document.getElementById('load-more-invoices')?.addEventListener('click', () => { currentPage++; renderInvoicesPaginated(); });
    container.querySelectorAll('.card[data-id]').forEach(card => card.onclick = () => showInvoiceDetail(card.dataset.id));
}

export async function showInvoiceModal(initialType = 'sale', initialData = {}) {
    await refreshCaches();
    const { customers, suppliers, items, units } = getCache();
    const isSale = initialType === 'sale';
    const entityList = isSale ? customers : suppliers;
    const entityLabel = isSale ? 'العميل' : 'المورد';
    const entityOptions = `<option value="cash">نقدي (بدون ${entityLabel})</option>` + 
        entityList.map(e => `<option value="${e.id}" ${initialData.customerId == e.id || initialData.supplierId == e.id ? 'selected' : ''}>${escapeHtml(e.name)}</option>`).join('');
    let linesHtml = '';
    const existingLines = initialData.lines || [];
    if (existingLines.length) {
        existingLines.forEach(line => {
            linesHtml += generateLineRowHtml(line, isSale, items, units);
        });
    } else {
        linesHtml = generateLineRowHtml(null, isSale, items, units);
    }
    const modal = openModal({
        title: `${initialData.id ? 'تعديل' : 'فاتورة جديدة'} ${isSale ? 'مبيعات' : 'مشتريات'}`,
        bodyHTML: `
            <input type="hidden" id="invoice-id" value="${initialData.id || ''}">
            <input type="hidden" id="invoice-type" value="${isSale ? 'sale' : 'purchase'}">
            <div class="invoice-lines" id="invoice-lines">${linesHtml}</div>
            <button class="btn btn-secondary btn-sm" id="add-line-btn" style="width:auto; margin-bottom:20px;">${ICONS.plus} إضافة بند</button>
            <div class="form-group"><label class="form-label">${entityLabel}</label><select class="select" id="invoice-entity">${entityOptions}</select></div>
            <div class="form-group"><label class="form-label">التاريخ</label><input type="date" class="input" id="invoice-date" value="${initialData.invoice_date || new Date().toISOString().slice(0,10)}"></div>
            <div class="form-group"><label class="form-label">ملاحظات</label><textarea class="textarea" id="invoice-notes">${escapeHtml(initialData.notes || '')}</textarea></div>
            <div style="background:var(--bg-secondary); border-radius:16px; padding:20px; display:flex; justify-content:space-between;">
                <div><label class="form-label">المبلغ المدفوع</label><input type="number" step="0.01" class="input" id="paid-amount" value="${initialData.paid_amount || 0}" style="width:150px;"></div>
                <div><label class="form-label">الإجمالي</label><div id="grand-total" style="font-size:24px; font-weight:900; color:var(--primary);">${formatNumber(initialData.total_amount || 0)}</div></div>
            </div>
        `,
        footerHTML: `<button class="btn btn-secondary" id="cancel-invoice">إلغاء</button><button class="btn btn-primary" id="save-invoice">${ICONS.check} حفظ الفاتورة</button>`
    });
    const containerEl = modal.element;
    const linesContainer = containerEl.querySelector('#invoice-lines');
    const addLineBtn = containerEl.querySelector('#add-line-btn');
    const grandTotalSpan = containerEl.querySelector('#grand-total');
    const paidInput = containerEl.querySelector('#paid-amount');
    let paidManuallyEdited = false;
    paidInput.addEventListener('input', () => { paidManuallyEdited = true; });
    
    function updateGrandTotal() {
        let total = 0;
        containerEl.querySelectorAll('.total-input').forEach(inp => total += parseFloat(inp.value) || 0);
        grandTotalSpan.textContent = formatNumber(total);
        if (!initialData.id && !paidManuallyEdited) {
            paidInput.value = total.toFixed(2);
        }
        return total;
    }
    
    function generateLineRowHtml(line, isSale, itemsList, unitsList) {
        const selectedItemId = line?.item_id || '';
        const selectedUnitId = line?.unit_id || '';
        const qty = line?.quantity || '';
        const price = line?.unit_price || '';
        const total = line?.total || '';
        const itemOptions = itemsList.map(i => `<option value="${i.id}" data-price="${isSale ? i.selling_price : i.purchase_price}" ${i.id == selectedItemId ? 'selected' : ''}>${escapeHtml(i.name)}</option>`).join('');
        return `<div class="line-row" style="background:var(--bg); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:12px; position:relative;">
            <div class="form-group" style="grid-column:1/-1"><select class="select item-select">${itemOptions}</select></div>
            <div class="form-group"><select class="select unit-select" style="${selectedItemId ? '' : 'display:none;'}">${selectedItemId ? getUnitOptionsForItem(selectedItemId, selectedUnitId) : '<option value="">اختر الوحدة</option>'}</select></div>
            <div class="form-group"><input type="number" step="any" class="input qty-input" placeholder="الكمية" value="${qty}"></div>
            <div class="form-group"><input type="number" step="0.01" class="input price-input" placeholder="السعر" value="${price}"></div>
            <div class="form-group"><input type="number" step="0.01" class="input total-input" placeholder="الإجمالي" readonly style="background:var(--bg);font-weight:700;" value="${total}"></div>
            <button class="line-remove" style="position:absolute; top:-8px; left:-8px; width:28px; height:28px; border-radius:50%; background:var(--danger); color:white; border:none;">×</button>
        </div>`;
    }
    
    function attachLineEvents(row) {
        const itemSelect = row.querySelector('.item-select');
        const unitSelect = row.querySelector('.unit-select');
        const priceInput = row.querySelector('.price-input');
        const qtyInput = row.querySelector('.qty-input');
        const totalInput = row.querySelector('.total-input');
        itemSelect.addEventListener('change', () => {
            const itemId = itemSelect.value;
            if (!itemId) { unitSelect.style.display = 'none'; priceInput.value = ''; updateGrandTotal(); return; }
            const selectedOption = itemSelect.options[itemSelect.selectedIndex];
            const basePrice = selectedOption.dataset.price;
            priceInput.value = basePrice;
            unitSelect.innerHTML = getUnitOptionsForItem(itemId, '');
            unitSelect.style.display = 'block';
            const factor = parseFloat(unitSelect.selectedOptions[0]?.dataset.factor || 1);
            priceInput.value = (parseFloat(basePrice) * factor).toFixed(2);
            updateTotal();
        });
        unitSelect.addEventListener('change', () => {
            const factor = parseFloat(unitSelect.selectedOptions[0]?.dataset.factor || 1);
            const basePrice = parseFloat(unitSelect.selectedOptions[0]?.dataset.basePrice || 0);
            priceInput.value = (basePrice * factor).toFixed(2);
            updateTotal();
        });
        qtyInput.addEventListener('input', updateTotal);
        priceInput.addEventListener('input', updateTotal);
        function updateTotal() {
            const qty = parseFloat(qtyInput.value) || 0;
            const price = parseFloat(priceInput.value) || 0;
            totalInput.value = (qty * price).toFixed(2);
            updateGrandTotal();
        }
        row.querySelector('.line-remove').addEventListener('click', () => {
            if (linesContainer.querySelectorAll('.line-row').length > 1) {
                row.remove();
                updateGrandTotal();
            } else {
                showToast('لا يمكن حذف البند الأخير، أضف بنداً آخر أولاً', 'warning');
            }
        });
    }
    
    containerEl.querySelectorAll('.line-row').forEach(row => attachLineEvents(row));
    addLineBtn.addEventListener('click', () => {
        const newRow = document.createElement('div');
        newRow.innerHTML = generateLineRowHtml(null, isSale, items, units);
        linesContainer.appendChild(newRow);
        attachLineEvents(newRow);
        const newItemSelect = newRow.querySelector('.item-select');
        if (newItemSelect) newItemSelect.dispatchEvent(new Event('change'));
    });
    if (initialData.itemId) {
        const firstRow = linesContainer.querySelector('.line-row');
        if (firstRow) {
            const itemSelect = firstRow.querySelector('.item-select');
            if (itemSelect) {
                itemSelect.value = initialData.itemId;
                itemSelect.dispatchEvent(new Event('change'));
                firstRow.querySelector('.qty-input').value = 1;
                firstRow.querySelector('.qty-input').dispatchEvent(new Event('input'));
            }
        }
    }
    containerEl.querySelector('#cancel-invoice').onclick = () => modal.close();
    containerEl.querySelector('#save-invoice').onclick = async () => {
        const saveBtn = containerEl.querySelector('#save-invoice');
        if (saveBtn.disabled) return;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="loader-inline"></span> جاري الحفظ...';
        try {
            const lines = [];
            const rows = containerEl.querySelectorAll('.line-row');
            for (const row of rows) {
                const itemId = row.querySelector('.item-select').value;
                const unitId = row.querySelector('.unit-select').value || null;
                const unitSelectEl = row.querySelector('.unit-select');
                const factor = parseFloat(unitSelectEl.selectedOptions[0]?.dataset.factor || 1);
                const quantity = parseFloat(row.querySelector('.qty-input').value) || 0;
                const unitPrice = parseFloat(row.querySelector('.price-input').value) || 0;
                const total = parseFloat(row.querySelector('.total-input').value) || 0;
                const baseUnitPrice = factor !== 0 ? unitPrice / factor : unitPrice;
                if (itemId && quantity > 0) {
                    lines.push({
                        item_id: parseInt(itemId),
                        unit_id: unitId,
                        quantity: quantity,
                        unit_price: baseUnitPrice,
                        conversion_factor: factor,
                        total: total
                    });
                }
            }
            if (lines.length === 0) throw new Error('أضف بنداً واحداً على الأقل');
            const entityVal = containerEl.querySelector('#invoice-entity').value;
            const isCash = entityVal === 'cash';
            const customer_id = isSale && !isCash ? parseInt(entityVal) : null;
            const supplier_id = !isSale && !isCash ? parseInt(entityVal) : null;
            const invoice_date = containerEl.querySelector('#invoice-date').value;
            const notes = containerEl.querySelector('#invoice-notes').value;
            const total_amount = parseFloat(grandTotalSpan.textContent.replace(/[^0-9.-]/g, '')) || 0;
            const paid_amount = parseFloat(paidInput.value) || 0;
            if (isCash && Math.abs(paid_amount - total_amount) > 0.01) {
                throw new Error('الفاتورة النقدية تتطلب دفع كامل المبلغ فوراً');
            }
            const payload = {
                type: isSale ? 'sale' : 'purchase',
                customer_id,
                supplier_id,
                invoice_date,
                total_amount,
                notes,
                lines,
                paid_amount
            };
            const invoiceId = containerEl.querySelector('#invoice-id').value;
            if (invoiceId) {
                await apiCall('/invoices', 'PUT', { id: parseInt(invoiceId), ...payload });
            } else {
                await apiCall('/invoices', 'POST', payload);
            }
            modal.close();
            showToast('تم حفظ الفاتورة بنجاح', 'success');
            await refreshCaches();
            loadInvoices();
        } catch (err) {
            showToast(err.message, 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = `${ICONS.check} حفظ الفاتورة`;
        }
    };
}

async function showInvoiceDetail(id) {
    await refreshCaches();
    const { invoices, units } = getCache();
    const invoice = invoices.find(i => i.id == id);
    if (!invoice) return;
    const typeLabel = invoice.type === 'sale' ? 'مبيعات' : 'مشتريات';
    const entity = invoice.customer?.name || invoice.supplier?.name || 'نقدي';
    const balance = invoice.balance || 0;
    let linesHtml = '<div class="table-wrap"><table class="table"><thead><tr><th>المادة</th><th>الكمية</th><th>الوحدة</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>';
    for (const line of invoice.lines || []) {
        const unit = units.find(u => u.id == line.unit_id);
        const unitName = unit?.name || unit?.abbreviation || 'قطعة';
        linesHtml += `<tr>
            <td>${escapeHtml(line.item?.name || '-')}</td>
            <td>${line.quantity}</td>
            <td>${unitName}</td>
            <td>${formatNumber(line.unit_price)}</td>
            <td>${formatNumber(line.total)}</td>
        </tr>`;
    }
    linesHtml += '</tbody></table></div>';
    const modal = openModal({
        title: `فاتورة ${typeLabel} #${invoice.id}`,
        bodyHTML: `
            <div><strong>التاريخ:</strong> ${formatDate(invoice.invoice_date)}</div>
            <div><strong>${invoice.type === 'sale' ? 'العميل' : 'المورد'}:</strong> ${escapeHtml(entity)}</div>
            <div><strong>الإجمالي:</strong> ${formatNumber(invoice.total_amount)}</div>
            <div><strong>المدفوع:</strong> ${formatNumber(invoice.paid || 0)}</div>
            <div><strong>المتبقي:</strong> <span style="color:${balance > 0 ? 'var(--danger)' : 'var(--success)'}">${formatNumber(balance)}</span></div>
            ${invoice.notes ? `<div><strong>ملاحظات:</strong> ${escapeHtml(invoice.notes)}</div>` : ''}
            <hr>${linesHtml}
        `,
        footerHTML: `<button class="btn btn-secondary" id="close-detail">إغلاق</button>
                     <button class="btn btn-primary" id="print-invoice">🖨️ طباعة</button>
                     <button class="btn btn-warning" id="edit-invoice">تعديل</button>
                     <button class="btn btn-danger" id="delete-invoice">حذف</button>
                     <button class="btn btn-success" id="add-payment">إضافة دفعة</button>`
    });
    modal.element.querySelector('#close-detail').onclick = () => modal.close();
    modal.element.querySelector('#print-invoice').onclick = () => { modal.close(); printInvoice(invoice); };
    modal.element.querySelector('#edit-invoice').onclick = () => { modal.close(); showInvoiceModal(invoice.type, { id: invoice.id, ...invoice }); };
    modal.element.querySelector('#delete-invoice').onclick = async () => {
        modal.close();
        if (await confirmDialog('هل أنت متأكد من حذف هذه الفاتورة؟')) {
            try {
                await apiCall(`/invoices?id=${invoice.id}`, 'DELETE');
                showToast('تم الحذف', 'success');
                await refreshCaches();
                loadInvoices();
            } catch(err) { showToast(err.message, 'error'); }
        }
    };
    modal.element.querySelector('#add-payment').onclick = () => {
        modal.close();
        import('./vouchers.js').then(m => m.showAddVoucherModal({
            type: invoice.type === 'sale' ? 'receipt' : 'payment',
            customer_id: invoice.customer_id,
            supplier_id: invoice.supplier_id,
            invoice_id: invoice.id
        }));
    };
}

function printInvoice(invoice) {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) { showToast('الرجاء السماح بالنوافذ المنبثقة', 'warning'); return; }
    const now = new Date().toLocaleString('ar-EG');
    const typeLabel = invoice.type === 'sale' ? 'فاتورة بيع' : 'فاتورة شراء';
    const entity = invoice.customer?.name || invoice.supplier?.name || 'نقدي';
    let rows = '';
    for (const line of invoice.lines || []) {
        rows += `<tr><td>${escapeHtml(line.item?.name || '-')}</td><td>${line.quantity}</td><td>${formatNumber(line.unit_price)}</td><td>${formatNumber(line.total)}</td></tr>`;
    }
    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>فاتورة #${invoice.id}</title>
    <style>body{font-family:'Tajawal',sans-serif;padding:20px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ddd;padding:8px;text-align:right;}th{background:#f2f2f2;}</style>
    </head><body><h2>${typeLabel}</h2><p><strong>رقم الفاتورة:</strong> ${invoice.id}</p><p><strong>التاريخ:</strong> ${formatDate(invoice.invoice_date)}</p><p><strong>${invoice.type === 'sale' ? 'العميل' : 'المورد'}:</strong> ${escapeHtml(entity)}</p>
    <table><thead><tr><th>المادة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table>
    <h3>الإجمالي: ${formatNumber(invoice.total_amount)}</h3><h3>المدفوع: ${formatNumber(invoice.paid || 0)}</h3><h3>المتبقي: ${formatNumber(invoice.balance || 0)}</h3>
    <p>تمت الطباعة: ${now}</p></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}

export default showInvoiceModal;
