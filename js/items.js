// js/items.js - إدارة المواد مع دعم كامل للوحدات الفرعية والتفاصيل
import { getAll, save, del, getByIndex, invalidate } from './store.js';
import { formatNumber, formatDate, ICONS, renderSkeleton, animateEntry, debounce } from './core.js';
import { showToast, openModal, confirmDialog, showFormModal } from './modal.js';

let filterLowStock = false;
const LOW_STOCK_THRESHOLD = 5;

export async function loadItems() {
  const container = document.getElementById('tab-content');
  const categories = await getAll('categories');
  const catOptions = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div><h3 class="card-title">المواد</h3><span class="card-subtitle">إدارة المخزون والمنتجات</span></div>
        <button class="btn btn-primary btn-sm" id="btn-add-item">${ICONS.plus} إضافة</button>
      </div>
      <div id="low-stock-alert" style="display:none; background:var(--danger-light); border-radius:14px; padding:12px; margin-bottom:16px;"></div>
      <div class="form-group"><input type="text" class="input" id="items-search" placeholder="🔍 البحث في المواد..."></div>
      <div style="display:flex; gap:12px; margin-top:16px;">
        <select class="select" id="filter-category"><option value="all">كل التصنيفات</option>${catOptions}</select>
        <select class="select" id="filter-type"><option value="all">كل الأنواع</option><option value="مخزون">مخزون</option><option value="منتج نهائي">منتج نهائي</option><option value="خدمة">خدمة</option></select>
      </div>
    </div>
    <div id="items-list">${renderSkeleton('table')}</div>`;
  
  document.getElementById('btn-add-item').addEventListener('click', showAddItemModal);
  document.getElementById('items-search').addEventListener('input', debounce(() => renderFilteredItems(), 200));
  document.getElementById('filter-category').addEventListener('change', () => renderFilteredItems());
  document.getElementById('filter-type').addEventListener('change', () => renderFilteredItems());
  
  await renderFilteredItems();
}

async function renderFilteredItems() {
  const container = document.getElementById('items-list');
  let items = await getAll('items');
  const categories = await getAll('categories');
  const units = await getAll('units');
  const itemUnits = await getAll('item_units');
  const invoiceLines = await getAll('invoice_lines');
  const invoices = await getAll('invoices');
  
  // حساب الإحصائيات لكل مادة
  const statsMap = {};
  for (const line of invoiceLines) {
    if (!line.item_id) continue;
    const invoice = invoices.find(inv => inv.id === line.invoice_id);
    if (!invoice) continue;
    const qtyBase = line.quantity_in_base || line.quantity || 0;
    if (!statsMap[line.item_id]) {
      statsMap[line.item_id] = { purchase_qty: 0, sale_qty: 0, purchase_count: 0, sale_count: 0, last_purchase_date: null, last_sale_date: null };
    }
    const stats = statsMap[line.item_id];
    if (invoice.type === 'purchase') {
      stats.purchase_qty += qtyBase;
      stats.purchase_count++;
      if (!stats.last_purchase_date || invoice.date > stats.last_purchase_date) stats.last_purchase_date = invoice.date;
    } else if (invoice.type === 'sale') {
      stats.sale_qty += qtyBase;
      stats.sale_count++;
      if (!stats.last_sale_date || invoice.date > stats.last_sale_date) stats.last_sale_date = invoice.date;
    }
  }
  
  items = items.map(item => ({
    ...item,
    category: categories.find(c => c.id === item.category_id),
    base_unit: units.find(u => u.id === item.base_unit_id),
    item_units: itemUnits.filter(iu => iu.item_id === item.id).map(iu => ({ ...iu, unit: units.find(u => u.id === iu.unit_id) })),
    purchase_qty: statsMap[item.id]?.purchase_qty || 0,
    sale_qty: statsMap[item.id]?.sale_qty || 0,
    purchase_count: statsMap[item.id]?.purchase_count || 0,
    sale_count: statsMap[item.id]?.sale_count || 0,
    last_purchase_date: statsMap[item.id]?.last_purchase_date || null,
    last_sale_date: statsMap[item.id]?.last_sale_date || null,
    available: item.quantity || 0,
    total_value: (item.quantity || 0) * (item.average_cost || 0)
  }));
  
  const q = (document.getElementById('items-search')?.value || '').trim().toLowerCase();
  const categoryFilter = document.getElementById('filter-category')?.value || 'all';
  const typeFilter = document.getElementById('filter-type')?.value || 'all';
  
  let filtered = items.filter(i => i.name.toLowerCase().includes(q));
  if (categoryFilter !== 'all') filtered = filtered.filter(i => i.category_id == categoryFilter);
  if (typeFilter !== 'all') filtered = filtered.filter(i => i.item_type === typeFilter);
  if (filterLowStock) filtered = filtered.filter(i => i.available < LOW_STOCK_THRESHOLD);
  
  const lowStockCount = items.filter(i => i.available < LOW_STOCK_THRESHOLD).length;
  const alertDiv = document.getElementById('low-stock-alert');
  if (alertDiv) {
    if (lowStockCount > 0) {
      alertDiv.style.display = 'flex';
      alertDiv.innerHTML = `<span>⚠️ يوجد <strong>${lowStockCount}</strong> مواد منخفضة المخزون (أقل من ${LOW_STOCK_THRESHOLD})</span> <span style="cursor:pointer;text-decoration:underline;">${filterLowStock ? 'إظهار الكل' : 'عرضها'}</span>`;
      alertDiv.onclick = () => { filterLowStock = !filterLowStock; renderFilteredItems(); };
    } else {
      alertDiv.style.display = 'none';
    }
  }
  
  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state"><h3>لا توجد مواد مطابقة</h3><p>يمكنك إضافة مواد جديدة من الزر أعلاه</p></div>`;
    return;
  }
  
  let html = `<div class="table-wrap"><table class="table items-table"><thead><tr><th>#</th><th>اسم المادة</th><th>الكمية (الوحدة الأساسية)</th><th>سعر البيع</th><th>قيمة المخزون (بالتكلفة)</th></tr></thead><tbody>`;
  filtered.forEach((item, idx) => {
    const baseUnitName = item.base_unit?.name || item.base_unit?.abbreviation || 'قطعة';
    const available = item.available;
    const stockStatus = available <= 0 ? 'نفذ' : available < LOW_STOCK_THRESHOLD ? 'منخفض' : 'متوفر';
    const stockColor = available <= 0 ? 'var(--danger)' : available < LOW_STOCK_THRESHOLD ? 'var(--warning)' : 'var(--success)';
    html += `<tr class="item-row" data-id="${item.id}" style="cursor:pointer;"><td>${idx+1}</td><td style="font-weight:800;">${item.name}</td>
      <td><span style="color:${stockColor}; font-weight:700;">${available}</span> ${baseUnitName} <span style="font-size:10px;">(${stockStatus})</span></td>
      <td>${formatNumber(item.selling_price)}</td><td>${formatNumber(item.total_value)}</td></tr>`;
  });
  html += `</tbody></table></div>`;
  container.innerHTML = html;
  animateEntry('.item-row', 60);
  
  document.querySelectorAll('.item-row').forEach(row => {
    row.addEventListener('click', () => showItemDetail(row.dataset.id));
  });
}

async function showItemDetail(itemId) {
  const items = await getAll('items');
  const item = items.find(i => i.id == parseInt(itemId));
  if (!item) return;
  const categories = await getAll('categories');
  const units = await getAll('units');
  const itemUnits = await getByIndex('item_units', 'item_id', item.id);
  const baseUnit = units.find(u => u.id === item.base_unit_id);
  const baseName = baseUnit?.name || 'قطعة';
  const available = item.quantity || 0;
  const totalValue = available * (item.average_cost || 0);
  const sellingValue = available * (item.selling_price || 0);
  
  const invoiceLines = await getAll('invoice_lines');
  const invoices = await getAll('invoices');
  let purchaseQty = 0, saleQty = 0, purchaseCount = 0, saleCount = 0, lastPurchase = null, lastSale = null;
  for (const line of invoiceLines.filter(l => l.item_id == item.id)) {
    const inv = invoices.find(i => i.id === line.invoice_id);
    if (!inv) continue;
    const qtyBase = line.quantity_in_base || line.quantity || 0;
    if (inv.type === 'purchase') {
      purchaseQty += qtyBase;
      purchaseCount++;
      if (!lastPurchase || inv.date > lastPurchase) lastPurchase = inv.date;
    } else if (inv.type === 'sale') {
      saleQty += qtyBase;
      saleCount++;
      if (!lastSale || inv.date > lastSale) lastSale = inv.date;
    }
  }
  
  let unitsHtml = '';
  if (itemUnits.length) {
    unitsHtml = `<div style="margin-bottom:20px;"><div style="font-weight:800;margin-bottom:12px;font-size:15px;">نظام الوحدات</div>
      <div style="background:var(--primary-light);border:1.5px solid var(--primary);border-radius:12px;padding:12px;margin-bottom:8px;">
        <span style="color:var(--primary);font-weight:800;">الوحدة الأساسية:</span> ${baseName}
      </div>`;
    for (const iu of itemUnits) {
      const unit = units.find(u => u.id === iu.unit_id);
      const unitName = unit?.name || 'وحدة';
      unitsHtml += `<div style="background:var(--bg);border:1.5px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px;">
        <span style="color:var(--primary);font-weight:800;">وحدة فرعية:</span> ${unitName} (1 ${unitName} = ${iu.conversion_factor} ${baseName})
      </div>`;
    }
    unitsHtml += `</div>`;
  }
  
  const modal = openModal({
    title: item.name,
    bodyHTML: `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div class="stat-card" style="margin:0;"><div class="stat-label">الكمية المشتراة</div><div class="stat-value" style="font-size:16px;">${purchaseQty} ${baseName}</div></div>
        <div class="stat-card" style="margin:0;"><div class="stat-label">الكمية المباعة</div><div class="stat-value" style="font-size:16px;">${saleQty} ${baseName}</div></div>
        <div class="stat-card" style="margin:0;border-color:var(--primary);"><div class="stat-label">المتوفرة</div><div class="stat-value text-primary" style="font-size:22px;">${available} ${baseName}</div></div>
        <div class="stat-card" style="margin:0;"><div class="stat-label">سعر الشراء (المتوسط)</div><div class="stat-value" style="font-size:16px;">${formatNumber(item.average_cost)} / ${baseName}</div></div>
        <div class="stat-card" style="margin:0;"><div class="stat-label">سعر الشراء المسجل</div><div class="stat-value" style="font-size:16px;">${formatNumber(item.purchase_price)} / ${baseName}</div></div>
        <div class="stat-card" style="margin:0;"><div class="stat-label">سعر البيع</div><div class="stat-value" style="font-size:16px;">${formatNumber(item.selling_price)} / ${baseName}</div></div>
        <div class="stat-card" style="margin:0; background: var(--primary-light); border: 2px solid var(--primary);">
          <div class="stat-label" style="color: var(--primary-dark);">💰 قيمة المخزون (بالتكلفة)</div>
          <div class="stat-value" style="font-size:20px; color: var(--primary);">${formatNumber(totalValue)}</div>
          <div style="font-size:11px; color: var(--text-muted);">المتوسط المرجح لجميع المشتريات</div>
        </div>
        <div class="stat-card" style="margin:0; background: var(--success-light);">
          <div class="stat-label">💵 قيمة المخزون (بسعر البيع)</div>
          <div class="stat-value" style="font-size:16px;">${formatNumber(sellingValue)}</div>
          <div style="font-size:11px; color: var(--text-muted);">تقديرية لو تم بيع المخزون</div>
        </div>
      </div>
      <div style="background:var(--bg);border-radius:16px;padding:18px;margin-bottom:20px;border:1.5px solid var(--border);">
        <h4 style="margin-bottom:14px;display:flex;align-items:center;gap:10px; font-size:15px;">
          <span style="background:var(--primary);color:#fff;border-radius:8px;padding:4px 10px;font-size:12px;">📋</span>
          ملخص حركات المادة
        </h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px; font-size:13px;">
          <div><span style="color:var(--text-muted);">عدد مرات الشراء:</span> <strong>${purchaseCount}</strong></div>
          <div><span style="color:var(--text-muted);">عدد مرات البيع:</span> <strong>${saleCount}</strong></div>
          <div><span style="color:var(--text-muted);">آخر شراء:</span> <strong>${lastPurchase ? formatDate(lastPurchase) : 'لا يوجد'}</strong></div>
          <div><span style="color:var(--text-muted);">آخر بيع:</span> <strong>${lastSale ? formatDate(lastSale) : 'لا يوجد'}</strong></div>
          <div><span style="color:var(--text-muted);">إجمالي الكمية المشتراة:</span> <strong>${purchaseQty} ${baseName}</strong></div>
          <div><span style="color:var(--text-muted);">إجمالي الكمية المباعة:</span> <strong>${saleQty} ${baseName}</strong></div>
          <div><span style="color:var(--text-muted);">متوسط سعر الشراء (المسجل):</span> <strong>${formatNumber(item.purchase_price)}</strong></div>
          <div><span style="color:var(--text-muted);">متوسط سعر البيع (المسجل):</span> <strong>${formatNumber(item.selling_price)}</strong></div>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:10px;">
          * الإحصائيات أعلاه تعتمد على الفواتير المسجلة وقد تختلف عن الواقع في حال وجود أرصدة افتتاحية.
        </div>
      </div>
      ${unitsHtml}
      <div class="form-label">التصنيف</div>
      <p style="margin-bottom:14px; font-weight:600;">${categories.find(c=>c.id===item.category_id)?.name||'بدون تصنيف'}</p>
      <div class="form-label">نوع المادة</div>
      <p style="margin-bottom:14px; font-weight:600;">${item.item_type || 'مخزون'}</p>
    `,
    footerHTML: `<button class="btn btn-secondary" id="edit-item-btn">${ICONS.edit} تعديل</button>
                 <button class="btn btn-danger" id="delete-item-btn">${ICONS.trash} حذف</button>
                 <button class="btn btn-success" id="sell-item-btn">${ICONS.cart} بيع</button>
                 <button class="btn btn-warning" id="buy-item-btn">${ICONS.download} شراء</button>`
  });
  modal.element.querySelector('#edit-item-btn').onclick = () => { modal.close(); showEditItemModal(item.id); };
  modal.element.querySelector('#delete-item-btn').onclick = async () => {
    modal.close();
    if (!await confirmDialog(`هل أنت متأكد من حذف المادة "${item.name}"؟`)) return;
    try {
      const used = await getByIndex('invoice_lines', 'item_id', item.id);
      if (used && used.length) {
        showToast('لا يمكن حذف المادة لأنها مستخدمة في فواتير', 'error');
        return;
      }
      const itemUnitsList = await getByIndex('item_units', 'item_id', item.id);
      for (const iu of itemUnitsList) await del('item_units', iu.id);
      await del('items', item.id);
      await invalidate('items');
      await invalidate('item_units');
      showToast('تم حذف المادة بنجاح', 'success');
      loadItems();
    } catch (err) {
      showToast('حدث خطأ أثناء الحذف: ' + err.message, 'error');
    }
  };
  modal.element.querySelector('#sell-item-btn').onclick = () => {
    modal.close();
    import('./invoices.js').then(m => m.showInvoiceModal('sale', { itemId: item.id }));
  };
  modal.element.querySelector('#buy-item-btn').onclick = () => {
    modal.close();
    import('./invoices.js').then(m => m.showInvoiceModal('purchase', { itemId: item.id }));
  };
}

async function buildCategoryDatalist() {
  const categories = await getAll('categories');
  let options = '';
  for (const cat of categories) options += `<option value="${cat.name}">${cat.name}</option>`;
  return `<datalist id="category-datalist">${options}</datalist>`;
}

async function buildUnitDatalist() {
  const units = await getAll('units');
  let options = '';
  for (const unit of units) options += `<option value="${unit.name}">${unit.name}</option>`;
  return `<datalist id="unit-datalist">${options}</datalist>`;
}

async function showAddItemModal() {
  const catDatalist = await buildCategoryDatalist();
  const unitDatalist = await buildUnitDatalist();
  const body = `
    <div class="form-group"><label class="form-label">اسم المادة</label><input id="item-name" class="input" placeholder="مثال: حبر طابعة"></div>
    <div class="form-group"><label class="form-label">التصنيف (بحث)</label><input id="item-category" class="input" list="category-datalist" placeholder="ابحث عن تصنيف أو اكتب تصنيفاً جديداً">${catDatalist}</div>
    <div class="form-group"><label class="form-label">نوع المادة</label><select id="item-type" class="select"><option value="مخزون">مخزون</option><option value="منتج نهائي">منتج نهائي</option><option value="خدمة">خدمة</option></select></div>
    <div class="form-group">
      <label class="form-label">الوحدة الأساسية (بحث)</label>
      <div style="display:flex; gap:8px; align-items:center;">
        <input id="item-base-unit" class="input" list="unit-datalist" placeholder="ابحث عن وحدة أو اكتب وحدة جديدة" style="flex:1">
        <button type="button" id="toggle-subunits-btn" class="btn btn-secondary btn-sm" style="width:auto; padding:10px 16px;">${ICONS.plus} وحدات فرعية</button>
      </div>
      ${unitDatalist}
    </div>
    <div id="subunits-section" style="display:none; margin-top:10px; padding:10px; background:var(--bg); border-radius:12px; border:1px solid var(--border);">
      <div class="form-group"><label>الوحدة الفرعية 1</label><div style="display:flex; gap:10px;"><input id="unit2-name" class="input" placeholder="اسم الوحدة (مثال: كرتونة)" style="flex:2"><input id="unit2-factor" class="input" type="number" placeholder="عامل التحويل (مثال: 12)" style="flex:1"></div></div>
      <div class="form-group"><label>الوحدة الفرعية 2</label><div style="display:flex; gap:10px;"><input id="unit3-name" class="input" placeholder="اسم الوحدة (مثال: طرد)" style="flex:2"><input id="unit3-factor" class="input" type="number" placeholder="عامل التحويل (مثال: 10)" style="flex:1"></div></div>
    </div>
    <div class="form-group"><label class="form-label">سعر الشراء (للوحدة الأساسية)</label><input id="item-purchase-price" type="number" class="input" value="0"></div>
    <div class="form-group"><label class="form-label">سعر البيع (للوحدة الأساسية)</label><input id="item-selling-price" type="number" class="input" value="0"></div>
    <div class="form-group"><label class="form-label">الكمية الافتتاحية</label><input id="item-quantity" type="number" class="input" value="0"></div>
  `;
  
  const modal = openModal({
    title: 'إضافة مادة جديدة',
    bodyHTML: body,
    footerHTML: `<button class="btn btn-secondary" id="cancel-add">إلغاء</button><button class="btn btn-primary" id="save-add">حفظ</button>`
  });
  
  const toggleBtn = modal.element.querySelector('#toggle-subunits-btn');
  const subunitsDiv = modal.element.querySelector('#subunits-section');
  toggleBtn.addEventListener('click', () => {
    if (subunitsDiv.style.display === 'none') {
      subunitsDiv.style.display = 'block';
      toggleBtn.innerHTML = `${ICONS.x} إخفاء الوحدات الفرعية`;
    } else {
      subunitsDiv.style.display = 'none';
      toggleBtn.innerHTML = `${ICONS.plus} وحدات فرعية`;
    }
  });
  
  modal.element.querySelector('#save-add').onclick = async () => {
    const name = modal.element.querySelector('#item-name').value.trim();
    if (!name) { showToast('اسم المادة مطلوب', 'error'); return; }
    const existing = await getAll('items');
    if (existing.some(i => i.name.toLowerCase() === name.toLowerCase())) { showToast('توجد مادة بنفس الاسم', 'error'); return; }
    
    // التصنيف
    let categoryId = null;
    const catName = modal.element.querySelector('#item-category').value.trim();
    if (catName) {
      const categories = await getAll('categories');
      let cat = categories.find(c => c.name === catName);
      if (!cat) {
        cat = { name: catName };
        categoryId = await save('categories', cat);
        await invalidate('categories');
      } else categoryId = cat.id;
    }
    
    // الوحدة الأساسية
    let baseUnitId = null;
    const unitName = modal.element.querySelector('#item-base-unit').value.trim();
    if (!unitName) { showToast('الوحدة الأساسية مطلوبة', 'error'); return; }
    const unitsList = await getAll('units');
    let unit = unitsList.find(u => u.name === unitName);
    if (!unit) {
      unit = { name: unitName, abbreviation: unitName };
      baseUnitId = await save('units', unit);
      await invalidate('units');
    } else baseUnitId = unit.id;
    
    const purchasePrice = parseFloat(modal.element.querySelector('#item-purchase-price').value) || 0;
    const newItem = {
      name, category_id: categoryId, item_type: modal.element.querySelector('#item-type').value,
      base_unit_id: baseUnitId, purchase_price: purchasePrice,
      selling_price: parseFloat(modal.element.querySelector('#item-selling-price').value) || 0,
      quantity: parseFloat(modal.element.querySelector('#item-quantity').value) || 0,
      average_cost: purchasePrice
    };
    const itemId = await save('items', newItem);
    
    // الوحدات الفرعية (نأخذها دائماً حتى لو كان القسم مخفياً)
    const unit2Name = modal.element.querySelector('#unit2-name').value.trim();
    const unit2Factor = parseFloat(modal.element.querySelector('#unit2-factor').value);
    const unit3Name = modal.element.querySelector('#unit3-name').value.trim();
    const unit3Factor = parseFloat(modal.element.querySelector('#unit3-factor').value);
    
    const allUnits = await getAll('units');
    async function getOrCreateUnit(name) {
      if (!name) return null;
      let u = allUnits.find(u => u.name === name);
      if (u) return u.id;
      const newU = { name, abbreviation: name };
      const newId = await save('units', newU);
      await invalidate('units');
      return newId;
    }
    
    if (unit2Name && unit2Factor > 0) {
      const unitId = await getOrCreateUnit(unit2Name);
      if (unitId) await save('item_units', { item_id: itemId, unit_id: unitId, conversion_factor: unit2Factor });
    }
    if (unit3Name && unit3Factor > 0) {
      const unitId = await getOrCreateUnit(unit3Name);
      if (unitId) await save('item_units', { item_id: itemId, unit_id: unitId, conversion_factor: unit3Factor });
    }
    
    await invalidate('items');
    await invalidate('item_units');
    modal.close();
    showToast('تمت إضافة المادة', 'success');
    loadItems();
  };
  modal.element.querySelector('#cancel-add').onclick = () => modal.close();
}

async function showEditItemModal(itemId) {
  const items = await getAll('items');
  const item = items.find(i => i.id == itemId);
  if (!item) return;
  const categories = await getAll('categories');
  const units = await getAll('units');
  const existingItemUnits = await getByIndex('item_units', 'item_id', item.id);
  const unit2 = existingItemUnits[0] || {};
  const unit3 = existingItemUnits[1] || {};
  const unit2Name = unit2.unit_id ? (units.find(u=>u.id===unit2.unit_id)?.name || '') : '';
  const unit2Factor = unit2.conversion_factor || '';
  const unit3Name = unit3.unit_id ? (units.find(u=>u.id===unit3.unit_id)?.name || '') : '';
  const unit3Factor = unit3.conversion_factor || '';
  
  const catDatalist = await buildCategoryDatalist();
  const unitDatalist = await buildUnitDatalist();
  const categoryName = categories.find(c => c.id === item.category_id)?.name || '';
  const unitName = units.find(u => u.id === item.base_unit_id)?.name || '';
  const hasSubunits = !!(unit2Name || unit3Name);
  
  const body = `
    <div class="form-group"><label class="form-label">اسم المادة</label><input id="item-name" class="input" value="${item.name}"></div>
    <div class="form-group"><label class="form-label">التصنيف (بحث)</label><input id="item-category" class="input" list="category-datalist" value="${categoryName}" placeholder="ابحث عن تصنيف أو اكتب تصنيفاً جديداً">${catDatalist}</div>
    <div class="form-group"><label class="form-label">نوع المادة</label><select id="item-type" class="select"><option value="مخزون" ${item.item_type==='مخزون'?'selected':''}>مخزون</option><option value="منتج نهائي" ${item.item_type==='منتج نهائي'?'selected':''}>منتج نهائي</option><option value="خدمة" ${item.item_type==='خدمة'?'selected':''}>خدمة</option></select></div>
    <div class="form-group">
      <label class="form-label">الوحدة الأساسية (بحث)</label>
      <div style="display:flex; gap:8px; align-items:center;">
        <input id="item-base-unit" class="input" list="unit-datalist" value="${unitName}" placeholder="ابحث عن وحدة أو اكتب وحدة جديدة" style="flex:1">
        <button type="button" id="toggle-subunits-btn" class="btn btn-secondary btn-sm" style="width:auto; padding:10px 16px;">${hasSubunits ? ICONS.x : ICONS.plus} ${hasSubunits ? 'إخفاء الوحدات الفرعية' : 'وحدات فرعية'}</button>
      </div>
      ${unitDatalist}
    </div>
    <div id="subunits-section" style="display:${hasSubunits ? 'block' : 'none'}; margin-top:10px; padding:10px; background:var(--bg); border-radius:12px; border:1px solid var(--border);">
      <div class="form-group"><label>الوحدة الفرعية 1</label><div style="display:flex; gap:10px;"><input id="unit2-name" class="input" placeholder="اسم الوحدة" value="${unit2Name}" style="flex:2"><input id="unit2-factor" class="input" type="number" placeholder="عامل التحويل" value="${unit2Factor}" style="flex:1"></div></div>
      <div class="form-group"><label>الوحدة الفرعية 2</label><div style="display:flex; gap:10px;"><input id="unit3-name" class="input" placeholder="اسم الوحدة" value="${unit3Name}" style="flex:2"><input id="unit3-factor" class="input" type="number" placeholder="عامل التحويل" value="${unit3Factor}" style="flex:1"></div></div>
    </div>
    <div class="form-group"><label class="form-label">سعر الشراء (للوحدة الأساسية)</label><input id="item-purchase-price" type="number" class="input" value="${item.purchase_price}"></div>
    <div class="form-group"><label class="form-label">سعر البيع (للوحدة الأساسية)</label><input id="item-selling-price" type="number" class="input" value="${item.selling_price}"></div>
    <div class="form-group"><label class="form-label">الكمية الحالية</label><input id="item-quantity" type="number" class="input" value="${item.quantity}"></div>
  `;
  
  const modal = openModal({
    title: 'تعديل المادة',
    bodyHTML: body,
    footerHTML: `<button class="btn btn-secondary" id="cancel-edit">إلغاء</button><button class="btn btn-primary" id="save-edit">حفظ</button>`
  });
  
  const toggleBtn = modal.element.querySelector('#toggle-subunits-btn');
  const subunitsDiv = modal.element.querySelector('#subunits-section');
  toggleBtn.addEventListener('click', () => {
    if (subunitsDiv.style.display === 'none') {
      subunitsDiv.style.display = 'block';
      toggleBtn.innerHTML = `${ICONS.x} إخفاء الوحدات الفرعية`;
    } else {
      subunitsDiv.style.display = 'none';
      toggleBtn.innerHTML = `${ICONS.plus} وحدات فرعية`;
    }
  });
  
  modal.element.querySelector('#save-edit').onclick = async () => {
    const name = modal.element.querySelector('#item-name').value.trim();
    if (!name) { showToast('اسم المادة مطلوب', 'error'); return; }
    
    // التصنيف
    let categoryId = null;
    const catName = modal.element.querySelector('#item-category').value.trim();
    if (catName) {
      const categoriesList = await getAll('categories');
      let cat = categoriesList.find(c => c.name === catName);
      if (!cat) {
        cat = { name: catName };
        categoryId = await save('categories', cat);
        await invalidate('categories');
      } else categoryId = cat.id;
    }
    
    // الوحدة الأساسية
    let baseUnitId = null;
    const unitNameVal = modal.element.querySelector('#item-base-unit').value.trim();
    if (!unitNameVal) { showToast('الوحدة الأساسية مطلوبة', 'error'); return; }
    const unitsList = await getAll('units');
    let unit = unitsList.find(u => u.name === unitNameVal);
    if (!unit) {
      unit = { name: unitNameVal, abbreviation: unitNameVal };
      baseUnitId = await save('units', unit);
      await invalidate('units');
    } else baseUnitId = unit.id;
    
    const updated = { ...item };
    updated.name = name;
    updated.category_id = categoryId;
    updated.item_type = modal.element.querySelector('#item-type').value;
    updated.base_unit_id = baseUnitId;
    updated.purchase_price = parseFloat(modal.element.querySelector('#item-purchase-price').value) || 0;
    updated.selling_price = parseFloat(modal.element.querySelector('#item-selling-price').value) || 0;
    updated.quantity = parseFloat(modal.element.querySelector('#item-quantity').value) || 0;
    updated.average_cost = updated.purchase_price;
    
    await save('items', updated);
    
    // حذف الوحدات الفرعية القديمة وإعادة إضافتها
    const existing = await getByIndex('item_units', 'item_id', item.id);
    for (const e of existing) await del('item_units', e.id);
    
    const unit2Name = modal.element.querySelector('#unit2-name').value.trim();
    const unit2Factor = parseFloat(modal.element.querySelector('#unit2-factor').value);
    const unit3Name = modal.element.querySelector('#unit3-name').value.trim();
    const unit3Factor = parseFloat(modal.element.querySelector('#unit3-factor').value);
    
    const allUnits = await getAll('units');
    async function getOrCreateUnit(name) {
      if (!name) return null;
      let u = allUnits.find(u => u.name === name);
      if (u) return u.id;
      const newU = { name, abbreviation: name };
      const newId = await save('units', newU);
      await invalidate('units');
      return newId;
    }
    
    if (unit2Name && unit2Factor > 0) {
      const unitId = await getOrCreateUnit(unit2Name);
      if (unitId) await save('item_units', { item_id: item.id, unit_id: unitId, conversion_factor: unit2Factor });
    }
    if (unit3Name && unit3Factor > 0) {
      const unitId = await getOrCreateUnit(unit3Name);
      if (unitId) await save('item_units', { item_id: item.id, unit_id: unitId, conversion_factor: unit3Factor });
    }
    
    await invalidate('items');
    await invalidate('item_units');
    modal.close();
    showToast('تم التحديث', 'success');
    loadItems();
  };
  modal.element.querySelector('#cancel-edit').onclick = () => modal.close();
}
