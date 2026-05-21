// js/invoices.js - فواتير البيع والشراء مع دعم الوحدات الفرعية
import { getAll, save, del, getByIndex, invalidate } from './store.js';
import { formatNumber, formatDate, ICONS, computeInventoryAfterPurchase, computeInventoryAfterSale, reverseInventoryAfterPurchase, reverseInventoryAfterSale, updateCustomerBalance, updateSupplierBalance, animateEntry } from './core.js';
import { showToast, openModal, confirmDialog } from './modal.js';
import { currentTab, navigateTo } from './navigation.js';

// دالة لجلب خيارات الوحدات لمادة معينة (نسخة احتياطية داخل الملف)
async function getUnitOptionsForItem(itemId, selectedUnitId = null) {
  const items = await getAll('items');
  const units = await getAll('units');
  const item = items.find(i => i.id == itemId);
  if (!item) return '<option value="">اختر مادة</option>';
  const baseUnit = units.find(u => u.id == item.base_unit_id);
  const baseName = baseUnit?.name || baseUnit?.abbreviation || 'قطعة';
  let opts = `<option value="" data-factor="1" ${!selectedUnitId ? 'selected' : ''}>${baseName} (أساسية)</option>`;
  const itemUnits = await getByIndex('item_units', 'item_id', item.id);
  for (const iu of itemUnits) {
    const u = units.find(u => u.id == iu.unit_id);
    const name = u?.name || u?.abbreviation || 'وحدة';
    opts += `<option value="${iu.unit_id}" data-factor="${iu.conversion_factor}" ${iu.unit_id == selectedUnitId ? 'selected' : ''}>${name} (${iu.conversion_factor}x ${baseName})</option>`;
  }
  return opts;
}

export async function loadInvoices() {
  const container = document.getElementById('tab-content');
  container.innerHTML = `
    <div class="card">
      <div class="card-header"><div><h3 class="card-title">الفواتير</h3><span class="card-subtitle">سجل الفواتير والحركات المالية</span></div></div>
      <div class="filter-bar"><button class="filter-pill active" data-filter="all">الكل</button><button class="filter-pill" data-filter="sale">مبيعات</button><button class="filter-pill" data-filter="purchase">مشتريات</button></div>
      <div class="form-group"><input type="text" class="input" id="invoice-search" placeholder="🔍 البحث في الفواتير..."></div>
    </div>
    <div id="invoices-list"></div>`;
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      this.classList.add('active');
      renderFilteredInvoices();
    });
  });
  document.getElementById('invoice-search').addEventListener('input', debounce(renderFilteredInvoices, 200));
  await renderFilteredInvoices();
}

async function renderFilteredInvoices() {
  const container = document.getElementById('invoices-list');
  let invoices = await getAll('invoices');
  const customers = await getAll('customers');
  const suppliers = await getAll('suppliers');
  const lines = await getAll('invoice_lines');
  const items = await getAll('items');
  const units = await getAll('units');
  invoices = invoices.map(inv => ({
    ...inv,
    customer: customers.find(c => c.id === inv.customer_id),
    supplier: suppliers.find(s => s.id === inv.supplier_id),
    invoice_lines: lines.filter(l => l.invoice_id === inv.id).map(l => ({ ...l, item: items.find(i => i.id === l.item_id), unit: units.find(u => u.id === l.unit_id) }))
  }));
  const filter = document.querySelector('.filter-pill.active')?.dataset.filter || 'all';
  const q = (document.getElementById('invoice-search')?.value || '').trim().toLowerCase();
  let filtered = invoices;
  if (filter !== 'all') filtered = filtered.filter(inv => inv.type === filter);
  if (q) filtered = filtered.filter(inv => (inv.reference || '').includes(q) || (inv.customer?.name || '').includes(q) || (inv.supplier?.name || '').includes(q) || String(inv.total).includes(q));
  if (!filtered.length) { container.innerHTML = `<div class="empty-state"><h3>لا توجد فواتير مطابقة</h3></div>`; return; }
  let html = '';
  for (const inv of filtered) {
    const typeLabel = inv.type === 'sale' ? 'بيع' : 'شراء';
    const entity = inv.customer?.name || inv.supplier?.name || 'نقدي';
    const paid = (await getByIndex('payments', 'invoice_id', inv.id)).reduce((s,p)=>s+(p.amount||0),0);
    const balance = inv.total - paid;
    html += `<div class="card card-hover invoice-rich-card" data-id="${inv.id}" style="cursor:pointer; margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between;">
        <div><span style="background:${inv.type==='sale'?'var(--success-light)':'var(--warning-light)'};padding:4px 14px;border-radius:20px;">${typeLabel}</span> ${inv.reference ? `<strong>فاتورة ${inv.reference}</strong>` : ''}<br><small>${formatDate(inv.date)} · ${entity}</small></div>
        <div style="text-align:left;"><div style="font-size:22px;font-weight:900;">${formatNumber(inv.total)}</div><div>المتبقي: ${formatNumber(balance)}</div></div>
      </div>
    </div>`;
  }
  container.innerHTML = html;
  animateEntry('.invoice-rich-card', 60);
  document.querySelectorAll('.invoice-rich-card').forEach(card => {
    card.addEventListener('click', () => showInvoiceDetailModal(parseInt(card.dataset.id)));
  });
}

export async function showInvoiceModal(type, options = {}) {
  const customers = await getAll('customers');
  const suppliers = await getAll('suppliers');
  const itemsAll = await getAll('items');
  const isSale = type === 'sale';
  const entLabel = isSale ? 'العميل' : 'المورد';
  const mode = options.mode || 'create';
  const invData = options.invoiceData || {};
  const invLines = invData.invoice_lines || [];

  const entityDatalistId = `entity-datalist-${Date.now()}`;
  let entityList = '';
  if (isSale) {
    entityList = customers.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  } else {
    entityList = suppliers.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
  }
  entityList = `<option value="نقدي">نقدي</option>${entityList}`;

  // دالة إنشاء سطر فارغ (مع حقل بحث المادة وقائمة الوحدات)
  const createEmptyLineHtml = (itemName = '', itemId = '', qty = '', price = '', total = '', unitId = '', factor = 1) => {
    const datalistId = `items-datalist-${Date.now()}-${Math.random()}`;
    const itemsOptions = itemsAll.map(i => `<option value="${i.name}">${i.name}</option>`).join('');
    return `
      <div class="line-row" data-item-id="${itemId}" data-unit-id="${unitId}" data-factor="${factor}">
        <div class="form-group" style="grid-column:1/-1">
          <input type="text" class="input item-search" list="${datalistId}" placeholder="ابحث عن مادة..." value="${itemName}">
          <datalist id="${datalistId}">${itemsOptions}</datalist>
          <input type="hidden" class="item-id-hidden" value="${itemId}">
        </div>
        <div class="form-group"><select class="select unit-select"></select></div>
        <div class="form-group"><input type="number" step="any" class="input qty-input" placeholder="الكمية" value="${qty}"></div>
        <div class="form-group"><input type="number" step="0.01" class="input price-input" placeholder="السعر" value="${price}"></div>
        <div class="form-group"><input type="number" step="0.01" class="input total-input" placeholder="الإجمالي" readonly value="${total}"></div>
        <button class="line-remove" title="حذف البند">${ICONS.trash}</button>
      </div>`;
  };

  let linesHtml = '';
  if (mode === 'edit' && invLines.length) {
    for (const line of invLines) {
      const item = itemsAll.find(i => i.id == line.item_id);
      const itemName = item ? item.name : '';
      linesHtml += createEmptyLineHtml(itemName, line.item_id, line.quantity, line.unit_price, line.total, line.unit_id, line.conversion_factor);
    }
  } else {
    linesHtml = createEmptyLineHtml();
  }

  const body = `
    <input type="hidden" id="inv-type" value="${type}">
    <input type="hidden" id="inv-id" value="${mode === 'edit' ? invData.id : ''}">
    <div class="invoice-lines" id="inv-lines">${linesHtml}</div>
    <button class="btn btn-secondary btn-sm" id="btn-add-line" style="width:auto;margin-bottom:20px;">${ICONS.plus} إضافة بند</button>
    <div class="form-group"><label class="form-label">${entLabel}</label>
      <input type="text" class="input" id="inv-entity-search" list="${entityDatalistId}" placeholder="ابحث عن ${entLabel} أو اكتب 'نقدي'" value="${mode === 'edit' ? (invData.customer?.name || invData.supplier?.name || '') : ''}">
      <datalist id="${entityDatalistId}">${entityList}</datalist>
      <input type="hidden" id="inv-entity-id" value="${mode === 'edit' ? (invData.customer_id || invData.supplier_id || '') : ''}">
    </div>
    <div class="form-group"><label class="form-label">التاريخ</label><input type="date" class="input" id="inv-date" value="${mode === 'edit' ? invData.date : new Date().toISOString().split('T')[0]}"></div>
    <div class="form-group"><label class="form-label">الرقم المرجعي</label><input type="text" class="input" id="inv-ref" value="${invData.reference || ''}"></div>
    <div class="form-group"><label class="form-label">ملاحظات</label><textarea class="textarea" id="inv-notes">${invData.notes || ''}</textarea></div>
    <div style="background:var(--bg);border-radius:16px;padding:20px;display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      <div><label class="form-label">المبلغ المدفوع</label><input type="number" step="0.01" class="input" id="inv-paid" value="${mode === 'edit' ? (invData.paid || 0) : '0'}"></div>
      <div><label class="form-label">الإجمالي</label><div id="inv-grand-total" style="font-size:24px;font-weight:900;">${mode === 'edit' ? formatNumber(invData.total || 0) : '0.00'}</div></div>
    </div>`;

  const modal = openModal({
    title: mode === 'edit' ? `تعديل فاتورة ${isSale ? 'مبيعات' : 'مشتريات'}` : `فاتورة ${isSale ? 'مبيعات' : 'مشتريات'}`,
    bodyHTML: body,
    footerHTML: `<button class="btn btn-secondary" id="inv-cancel">إلغاء</button><button class="btn btn-primary" id="inv-save">${ICONS.check} حفظ</button>`
  });

  const container = modal.element;
  const paidInput = container.querySelector('#inv-paid');
  let paidManuallyEdited = false;
  paidInput.addEventListener('input', () => { paidManuallyEdited = true; });

  const updateGrandTotal = () => {
    let total = 0;
    container.querySelectorAll('.total-input').forEach(inp => total += parseFloat(inp.value) || 0);
    container.querySelector('#inv-grand-total').textContent = formatNumber(total);
    if (mode === 'create' && !paidManuallyEdited) paidInput.value = total.toFixed(2);
  };

  async function updateUnitSelect(row, itemId, selectedUnitId = null) {
    const unitSelect = row.querySelector('.unit-select');
    if (!unitSelect) return;
    const opts = await getUnitOptionsForItem(itemId, selectedUnitId);
    unitSelect.innerHTML = opts;
    unitSelect.style.display = 'block';
    const priceInput = row.querySelector('.price-input');
    const selectedOption = unitSelect.selectedOptions[0];
    if (selectedOption) {
      const factor = parseFloat(selectedOption.dataset.factor || 1);
      const basePrice = parseFloat(priceInput.dataset.basePrice || priceInput.value || 0);
      priceInput.value = (basePrice * factor).toFixed(2);
      row.dataset.factor = factor;
      row.dataset.unitId = selectedOption.value;
    }
    calcRow(row);
  }

  async function autoFillFromSearch(searchInput, priceEl, unitSelectEl, hiddenIdEl) {
    const itemName = searchInput.value.trim();
    if (!itemName) {
      priceEl.value = '';
      if (unitSelectEl) { unitSelectEl.innerHTML = '<option value="">اختر مادة</option>'; unitSelectEl.style.display = 'none'; }
      if (hiddenIdEl) hiddenIdEl.value = '';
      return;
    }
    const itemsAll = await getAll('items');
    const item = itemsAll.find(i => i.name === itemName);
    if (!item) {
      showToast('المادة غير موجودة، اختر من القائمة', 'warning');
      searchInput.value = '';
      priceEl.value = '';
      if (unitSelectEl) unitSelectEl.style.display = 'none';
      if (hiddenIdEl) hiddenIdEl.value = '';
      return;
    }
    const basePrice = isSale ? (item.selling_price || 0) : (item.purchase_price || 0);
    priceEl.value = basePrice;
    priceEl.dataset.basePrice = basePrice;
    if (unitSelectEl) {
      await updateUnitSelect(searchInput.closest('.line-row'), item.id);
    }
    if (hiddenIdEl) hiddenIdEl.value = item.id;
    const row = searchInput.closest('.line-row');
    const qtyInput = row.querySelector('.qty-input');
    const totalInput = row.querySelector('.total-input');
    if (qtyInput && totalInput) {
      const qty = parseFloat(qtyInput.value) || 0;
      const price = parseFloat(priceEl.value) || 0;
      totalInput.value = (qty * price).toFixed(2);
    }
    updateGrandTotal();
  }

  function calcRow(row) {
    const qty = parseFloat(row.querySelector('.qty-input')?.value) || 0;
    const price = parseFloat(row.querySelector('.price-input')?.value) || 0;
    row.querySelector('.total-input').value = (qty * price).toFixed(2);
    updateGrandTotal();
  }

  async function handleUnitChange(row) {
    const unitSel = row.querySelector('.unit-select');
    const priceEl = row.querySelector('.price-input');
    if (!unitSel || !priceEl) return;
    const selectedOption = unitSel.selectedOptions[0];
    if (!selectedOption) return;
    const factor = parseFloat(selectedOption.dataset.factor || 1);
    const basePrice = parseFloat(priceEl.dataset.basePrice || priceEl.value || 0);
    const newPrice = basePrice * factor;
    priceEl.value = newPrice.toFixed(2);
    row.dataset.factor = factor;
    row.dataset.unitId = selectedOption.value;
    calcRow(row);
  }

  // إضافة سطر جديد
  container.querySelector('#btn-add-line').addEventListener('click', async () => {
    const linesContainer = container.querySelector('#inv-lines');
    const nl = document.createElement('div');
    nl.innerHTML = createEmptyLineHtml();
    linesContainer.appendChild(nl.firstElementChild);
    const newRow = linesContainer.lastElementChild;
    const searchInput = newRow.querySelector('.item-search');
    const hiddenId = newRow.querySelector('.item-id-hidden');
    const priceInput = newRow.querySelector('.price-input');
    const unitSelect = newRow.querySelector('.unit-select');
    searchInput.addEventListener('change', () => autoFillFromSearch(searchInput, priceInput, unitSelect, hiddenId));
    searchInput.addEventListener('input', debounce(() => autoFillFromSearch(searchInput, priceInput, unitSelect, hiddenId), 300));
    newRow.querySelector('.qty-input').addEventListener('input', () => calcRow(newRow));
    newRow.querySelector('.price-input').addEventListener('input', () => calcRow(newRow));
    unitSelect?.addEventListener('change', () => handleUnitChange(newRow));
    newRow.querySelector('.line-remove').addEventListener('click', () => {
      if (linesContainer.querySelectorAll('.line-row').length > 1) { newRow.remove(); updateGrandTotal(); }
    });
  });

  // إذا كان هناك itemId محدد مسبقاً (من شاشة المواد)
  if (options.itemId) {
    const linesContainer = container.querySelector('#inv-lines');
    const item = itemsAll.find(i => i.id == options.itemId);
    if (item) {
      const defaultRow = linesContainer.querySelector('.line-row');
      if (defaultRow && !defaultRow.querySelector('.item-id-hidden')?.value) defaultRow.remove();
      const nl = document.createElement('div');
      nl.innerHTML = createEmptyLineHtml(item.name, item.id, '1', isSale ? item.selling_price : item.purchase_price, isSale ? item.selling_price : item.purchase_price);
      linesContainer.appendChild(nl.firstElementChild);
      const newRow = linesContainer.lastElementChild;
      const searchInput = newRow.querySelector('.item-search');
      const hiddenId = newRow.querySelector('.item-id-hidden');
      const priceInput = newRow.querySelector('.price-input');
      const unitSelect = newRow.querySelector('.unit-select');
      await updateUnitSelect(newRow, item.id);
      searchInput.addEventListener('change', () => autoFillFromSearch(searchInput, priceInput, unitSelect, hiddenId));
      newRow.querySelector('.qty-input').addEventListener('input', () => calcRow(newRow));
      newRow.querySelector('.price-input').addEventListener('input', () => calcRow(newRow));
      unitSelect?.addEventListener('change', () => handleUnitChange(newRow));
      newRow.querySelector('.line-remove').addEventListener('click', () => {
        if (linesContainer.querySelectorAll('.line-row').length > 1) { newRow.remove(); updateGrandTotal(); }
      });
      updateGrandTotal();
    }
  }

  // ربط الأحداث للسطور الموجودة (في وضع التعديل)
  for (const row of container.querySelectorAll('.line-row')) {
    const searchInput = row.querySelector('.item-search');
    const hiddenId = row.querySelector('.item-id-hidden');
    const priceInput = row.querySelector('.price-input');
    const unitSelect = row.querySelector('.unit-select');
    if (searchInput) {
      if (hiddenId.value) {
        await updateUnitSelect(row, hiddenId.value, row.dataset.unitId);
      }
      searchInput.addEventListener('change', () => autoFillFromSearch(searchInput, priceInput, unitSelect, hiddenId));
      searchInput.addEventListener('input', debounce(() => autoFillFromSearch(searchInput, priceInput, unitSelect, hiddenId), 300));
    }
    row.querySelector('.qty-input')?.addEventListener('input', () => calcRow(row));
    row.querySelector('.price-input')?.addEventListener('input', () => calcRow(row));
    unitSelect?.addEventListener('change', () => handleUnitChange(row));
  }

  modal.element.querySelector('#inv-cancel').onclick = () => modal.close();

  modal.element.querySelector('#inv-save').onclick = async () => {
    const btn = container.querySelector('#inv-save');
    if (btn.disabled) return;
    const lines = [];
    const rows = container.querySelectorAll('.line-row');
    let dupCheck = new Set();
    for (const row of rows) {
      const hiddenId = row.querySelector('.item-id-hidden');
      const itemId = hiddenId?.value || null;
      if (itemId) {
        if (dupCheck.has(itemId)) { showToast('لا يمكن تكرار نفس المادة', 'error'); return; }
        dupCheck.add(itemId);
      }
      const unitSel = row.querySelector('.unit-select');
      const unitId = unitSel?.value || null;
      const factor = parseFloat(unitSel?.selectedOptions[0]?.dataset.factor || 1);
      const qty = parseFloat(row.querySelector('.qty-input')?.value) || 0;
      const price = parseFloat(row.querySelector('.price-input')?.value) || 0;
      const total = parseFloat(row.querySelector('.total-input')?.value) || 0;
      const basePrice = factor !== 0 ? price / factor : price;
      if (itemId && qty > 0) {
        lines.push({ item_id: itemId, unit_id: unitId || null, quantity: qty, unit_price: parseFloat(basePrice.toFixed(2)), conversion_factor: factor, total: total });
      }
    }
    if (!lines.length) { showToast('أضف بنداً واحداً على الأقل', 'error'); return; }

    // معالجة العميل/المورد
    const entitySearch = container.querySelector('#inv-entity-search').value.trim();
    const entityHidden = container.querySelector('#inv-entity-id');
    let customer_id = null, supplier_id = null;
    if (entitySearch === 'نقدي') {
      customer_id = null; supplier_id = null;
    } else {
      if (isSale) {
        const cust = customers.find(c => c.name === entitySearch);
        if (cust) { customer_id = cust.id; entityHidden.value = cust.id; }
        else { showToast('العميل غير موجود', 'error'); return; }
      } else {
        const supp = suppliers.find(s => s.name === entitySearch);
        if (supp) { supplier_id = supp.id; entityHidden.value = supp.id; }
        else { showToast('المورد غير موجود', 'error'); return; }
      }
    }

    const date = container.querySelector('#inv-date').value;
    const reference = container.querySelector('#inv-ref').value.trim();
    const notes = container.querySelector('#inv-notes').value.trim();
    const totalAmount = lines.reduce((s,l)=>s+l.total,0);
    const paidAmount = parseFloat(paidInput.value) || 0;
    const isCash = (customer_id === null && supplier_id === null);
    if (isCash && Math.abs(paidAmount - totalAmount) > 0.01) { showToast('الفاتورة النقدية تتطلب دفع كامل المبلغ', 'error'); return; }

    btn.disabled = true; btn.innerHTML = '<span class="loader-inline"></span> جاري الحفظ...';
    try {
      if (mode === 'edit') {
        await deleteInvoiceLogic(invData.id, true);
      }
      const newInvoice = { type, customer_id, supplier_id, date, reference, notes, total: totalAmount, status: 'posted' };
      const invId = await save('invoices', newInvoice);
      for (const line of lines) {
        const baseQty = line.quantity * (line.conversion_factor||1);
        const lineData = { invoice_id: invId, item_id: line.item_id, unit_id: line.unit_id, quantity: line.quantity, unit_price: line.unit_price, total: line.total, conversion_factor: line.conversion_factor, quantity_in_base: baseQty };
        await save('invoice_lines', lineData);
        if (type === 'purchase') {
          await computeInventoryAfterPurchase(line.item_id, baseQty, line.unit_price);
        } else if (type === 'sale') {
          await computeInventoryAfterSale(line.item_id, baseQty);
        }
      }
      if (paidAmount > 0) { await save('payments', { invoice_id: invId, customer_id, supplier_id, amount: paidAmount, payment_date: date, notes: 'دفعة تلقائية من الفاتورة' }); }
      if (type === 'sale' && customer_id) await updateCustomerBalance(customer_id, totalAmount - paidAmount);
      else if (type === 'purchase' && supplier_id) await updateSupplierBalance(supplier_id, totalAmount - paidAmount);
      await invalidate('invoices'); await invalidate('items'); await invalidate('customers'); await invalidate('suppliers');
      modal.close(); showToast('تم حفظ الفاتورة بنجاح', 'success');
      if (currentTab === 'items') { const { loadItems } = await import('./items.js'); loadItems(); } else navigateTo('invoices');
    } catch (err) { showToast(err.message, 'error'); btn.disabled = false; btn.innerHTML = `${ICONS.check} حفظ الفاتورة`; }
  };
}

export async function showInvoiceDetailModal(invoiceId) {
  // ... (نفس الكود السابق) للحفاظ على الطول، يمكن تركه بدون تغيير
  const invoices = await getAll('invoices');
  const invoice = invoices.find(i => i.id == invoiceId);
  if (!invoice) return;
  const customers = await getAll('customers');
  const suppliers = await getAll('suppliers');
  const lines = await getAll('invoice_lines');
  const items = await getAll('items');
  const units = await getAll('units');
  const invoiceLines = lines.filter(l => l.invoice_id === invoiceId).map(l => ({ ...l, item: items.find(i=>i.id===l.item_id), unit: units.find(u=>u.id===l.unit_id) }));
  const payments = await getByIndex('payments', 'invoice_id', invoiceId);
  const paid = payments.reduce((s,p)=>s+(p.amount||0),0);
  const balance = invoice.total - paid;
  const typeLabel = invoice.type === 'sale' ? 'مبيعات' : 'مشتريات';
  const entity = invoice.customer_id ? customers.find(c=>c.id===invoice.customer_id) : suppliers.find(s=>s.id===invoice.supplier_id);
  const entityName = entity?.name || 'نقدي';
  let linesHtml = '<div class="table-wrap"><table class="table"><thead><tr><th>المادة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>';
  for (const l of invoiceLines) {
    const unitDisplay = l.unit?.abbreviation || l.unit?.name || '';
    const qtyDisplay = l.conversion_factor && l.conversion_factor > 1 ? `${l.quantity} ${unitDisplay} (${l.quantity * l.conversion_factor} ${l.item?.base_unit?.name||'قطعة'})` : `${l.quantity} ${unitDisplay}`;
    linesHtml += `<tr><td style="font-weight:800;">${l.item?.name||'-'}</td><td style="font-weight:600;">${qtyDisplay}</td><td class="num">${formatNumber(l.unit_price)}</td><td class="num" style="font-weight:800;">${formatNumber(l.total)}</td></tr>`;
  }
  linesHtml += '</tbody></table></div>';
  const modal = openModal({
    title: `فاتورة ${typeLabel} ${invoice.reference || ''}`,
    bodyHTML: `<div><strong>التاريخ:</strong> ${formatDate(invoice.date)}</div><div><strong>الجهة:</strong> ${entityName}</div>${linesHtml}<div style="margin-top:16px;"><strong>الإجمالي:</strong> ${formatNumber(invoice.total)}<br><strong>المدفوع:</strong> ${formatNumber(paid)}<br><strong>المتبقي:</strong> ${formatNumber(balance)}</div>${invoice.notes?`<div><strong>ملاحظات:</strong> ${invoice.notes}</div>`:''}</div>`,
    footerHTML: `<button class="btn btn-secondary" id="detail-close">إغلاق</button><button class="btn btn-primary" id="detail-print">طباعة</button><button class="btn btn-success" id="detail-save-html">حفظ HTML</button><button class="btn btn-warning" id="detail-edit">تعديل</button><button class="btn btn-danger" id="detail-delete">حذف</button>`
  });
  modal.element.querySelector('#detail-close').onclick = () => modal.close();
  modal.element.querySelector('#detail-print').onclick = () => { modal.close(); printInvoiceWithFormat(invoice); };
  modal.element.querySelector('#detail-save-html').onclick = () => { modal.close(); saveInvoiceAsHtml(invoice); };
  modal.element.querySelector('#detail-edit').onclick = () => { modal.close(); showInvoiceModal(invoice.type, { mode: 'edit', invoiceData: invoice }); };
  modal.element.querySelector('#detail-delete').onclick = async () => { modal.close(); if (await confirmDialog('هل أنت متأكد من حذف الفاتورة؟ سيتم التراجع عن جميع التأثيرات المالية.')) { await deleteInvoiceLogic(invoice.id); showToast('تم الحذف', 'success'); loadInvoices(); } };
}

async function deleteInvoiceLogic(invoiceId, skipUi = false) {
  const invoice = (await getAll('invoices')).find(i => i.id == invoiceId);
  if (!invoice) return;
  const lines = await getByIndex('invoice_lines', 'invoice_id', invoiceId);
  const payments = await getByIndex('payments', 'invoice_id', invoiceId);
  for (const line of lines) {
    const baseQty = line.quantity_in_base || line.quantity || 0;
    if (invoice.type === 'purchase') {
      await reverseInventoryAfterPurchase(line.item_id, baseQty, line.unit_price);
    } else if (invoice.type === 'sale') {
      await reverseInventoryAfterSale(line.item_id, baseQty);
    }
  }
  const totalPaid = payments.reduce((s,p)=>s+(p.amount||0),0);
  if (invoice.type === 'sale' && invoice.customer_id) {
    await updateCustomerBalance(invoice.customer_id, -(invoice.total - totalPaid));
  } else if (invoice.type === 'purchase' && invoice.supplier_id) {
    await updateSupplierBalance(invoice.supplier_id, -(invoice.total - totalPaid));
  }
  for (const p of payments) await del('payments', p.id);
  for (const l of lines) await del('invoice_lines', l.id);
  await del('invoices', invoiceId);
  await invalidate('invoices'); await invalidate('items'); await invalidate('customers'); await invalidate('suppliers');
  if (!skipUi) showToast('تم الحذف', 'success');
}

function debounce(fn, ms) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

function printInvoiceWithFormat(invoice) {
  const formatModal = openModal({
    title: 'اختيار تنسيق الطباعة',
    bodyHTML: `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
      <div class="format-option" data-format="a4"><div style="font-size:44px;">📄</div><div>A4 رسمية</div></div>
      <div class="format-option" data-format="thermal"><div style="font-size:44px;">🧾</div><div>حرارية 80mm</div></div>
    </div><div style="margin-top:16px;"><label><input type="checkbox" id="preview-check" checked> عرض معاينة قبل الطباعة</label></div>`,
    footerHTML: `<button class="btn btn-secondary" id="format-cancel">إلغاء</button><button class="btn btn-primary" id="format-confirm">متابعة</button>`
  });
  let selectedFormat = 'thermal';
  formatModal.element.querySelectorAll('.format-option').forEach(opt => {
    opt.addEventListener('click', () => { selectedFormat = opt.dataset.format; formatModal.element.querySelectorAll('.format-option').forEach(o => o.style.border = 'none'); opt.style.border = '2px solid var(--primary)'; });
  });
  formatModal.element.querySelector('[data-format="thermal"]').style.border = '2px solid var(--primary)';
  formatModal.element.querySelector('#format-cancel').onclick = () => formatModal.close();
  formatModal.element.querySelector('#format-confirm').onclick = () => {
    const withPreview = formatModal.element.querySelector('#preview-check').checked;
    formatModal.close();
    generateInvoiceHtml(invoice, { format: selectedFormat, preview: withPreview });
  };
}

async function generateInvoiceHtml(invoice, options) {
  const customers = await getAll('customers');
  const suppliers = await getAll('suppliers');
  const lines = await getAll('invoice_lines');
  const items = await getAll('items');
  const units = await getAll('units');
  const invoiceLines = lines.filter(l => l.invoice_id === invoice.id).map(l => ({ ...l, item: items.find(i=>i.id===l.item_id), unit: units.find(u=>u.id===l.unit_id) }));
  const payments = await getByIndex('payments', 'invoice_id', invoice.id);
  const paid = payments.reduce((s,p)=>s+(p.amount||0),0);
  const balance = invoice.total - paid;
  const entity = invoice.customer_id ? customers.find(c=>c.id===invoice.customer_id) : suppliers.find(s=>s.id===invoice.supplier_id);
  const now = new Date();
  const timeStr = now.toLocaleTimeString('ar');
  const dateStr = formatDate(invoice.date);
  const typeLabel = invoice.type === 'sale' ? 'فاتورة بيع' : 'فاتورة شراء';
  const entityLabel = invoice.type === 'sale' ? 'العميل' : 'المورد';
  const safeEntityName = entity?.name || 'نقدي';
  const safeEntityPhone = entity?.phone || '';
  const barcode = `*${invoice.id}*`;
  const isThermal = options.format === 'thermal';
  const html = `<!DOCTYPE html>
  <html dir="rtl" lang="ar">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=${isThermal ? '80mm' : '100%'}, initial-scale=1"><title>${typeLabel} ${invoice.reference || invoice.id}</title>
  <style>
    body { font-family: 'Tajawal', system-ui; padding: ${isThermal ? '4mm' : '20px'}; margin: 0; background: white; }
    .invoice { max-width: ${isThermal ? '80mm' : '800px'}; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin-bottom: 20px; }
    .shop { font-size: ${isThermal ? '16px' : '24px'}; font-weight: 900; color: #4f46e5; }
    .type { background: ${invoice.type === 'sale' ? '#10b981' : '#f59e0b'}; color: white; display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin: 8px 0; }
    .info-row { display: flex; justify-content: space-between; margin: 6px 0; font-size: ${isThermal ? '10px' : '14px'}; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: center; font-size: ${isThermal ? '9px' : '12px'}; }
    th { background: #f2f2f2; }
    .totals { margin-top: 16px; padding-top: 8px; border-top: 2px solid #000; }
    .footer { text-align: center; font-size: ${isThermal ? '8px' : '10px'}; color: gray; margin-top: 20px; }
    .barcode { text-align: center; font-family: monospace; font-size: 20px; margin: 10px 0; letter-spacing: 2px; }
    @media print { body { margin: 0; padding: 0; } }
  </style>
  </head>
  <body>
  <div class="invoice">
    <div class="header"><div class="shop">الراجحي للمحاسبة</div><div class="shop-sub">ALRAJEHI ACCOUNTING</div><div class="type">${typeLabel}</div></div>
    <div class="info-row"><span>رقم الفاتورة:</span><strong>${invoice.reference || invoice.id}</strong></div>
    <div class="info-row"><span>التاريخ:</span><strong>${dateStr} ${timeStr}</strong></div>
    <div class="info-row"><span>${entityLabel}:</span><strong>${safeEntityName} ${safeEntityPhone ? `(${safeEntityPhone})` : ''}</strong></div>
    <table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>
    ${invoiceLines.map(l => `<tr><td style="font-weight:800;">${l.item?.name || '-'}</td><td style="font-weight:600;">${l.quantity} ${l.unit?.abbreviation || ''} ${l.conversion_factor && l.conversion_factor > 1 ? `(= ${l.quantity * l.conversion_factor} ${l.item?.base_unit?.name||'قطعة'})` : ''}</td><td class="num">${formatNumber(l.unit_price)}</td><td class="num" style="font-weight:800;">${formatNumber(l.total)}</td></tr>`).join('')}
    </tbody></table>
    <div class="totals"><div class="info-row"><span>الإجمالي:</span><strong>${formatNumber(invoice.total)}</strong></div>
    <div class="info-row"><span>المدفوع:</span><strong>${formatNumber(paid)}</strong></div>
    <div class="info-row"><span>المتبقي:</span><strong style="color:${balance>0?'red':'green'}">${formatNumber(balance)}</strong></div></div>
    <div class="barcode">${barcode}</div>
    <div class="footer">شكراً لتعاملكم - الراجحي للمحاسبة</div>
  </div>
  </body>
  </html>`;
  if (options.preview) {
    const previewModal = openModal({ title: 'معاينة الفاتورة', bodyHTML: `<iframe srcdoc="${html.replace(/"/g, '&quot;')}" style="width:100%; height:500px; border:none;"></iframe>`, footerHTML: `<button class="btn btn-primary" id="preview-print">طباعة</button><button class="btn btn-secondary" id="preview-close">إغلاق</button>` });
    previewModal.element.querySelector('#preview-print').onclick = () => { previewModal.close(); setTimeout(() => { const win = window.open(); win.document.write(html); win.document.close(); win.print(); }, 100); };
    previewModal.element.querySelector('#preview-close').onclick = () => previewModal.close();
  } else {
    const win = window.open(); win.document.write(html); win.document.close(); win.print();
  }
}

function saveInvoiceAsHtml(invoice) {
  generateInvoiceHtml(invoice, { format: 'a4', preview: false });
  showToast('تم فتح الفاتورة في نافذة جديدة يمكنك حفظها', 'success');
}
