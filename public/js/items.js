// public/js/items.js
import { apiCall, formatNumber, formatDate, debounce, ICONS, getUnitOptionsForItem, renderSkeleton, animateEntry } from './core.js';
import { get as storeGet, set as storeSet } from './store.js';
import { showToast, openModal, confirmDialog, showFormModal } from './modal.js';

let filterLowStock = false;
const LOW_STOCK_THRESHOLD = 5;

function computeSubUnitQuantities(available, baseUnitName, itemUnits) {
  if (!itemUnits || itemUnits.length === 0 || available <= 0) return '';
  const sorted = [...itemUnits].sort((a,b) => (b.conversion_factor||1) - (a.conversion_factor||1));
  let remaining = available;
  const parts = [];
  sorted.forEach(iu => {
    const factor = parseFloat(iu.conversion_factor) || 1;
    if (factor <= 0) return;
    const count = Math.floor(remaining / factor);
    if (count > 0) {
      const unitName = iu.unit?.name || iu.unit?.abbreviation || 'وحدة';
      parts.push(`${unitName}: ${count}`);
      remaining -= count * factor;
    }
  });
  if (remaining > 0) parts.push(`${baseUnitName}: ${remaining}`);
  return parts.join('، ');
}

export function renderFilteredItems() {
  const container = document.getElementById('items-list');
  if (!container) return;
  
  const items = storeGet('items') || [];
  const q = (document.getElementById('items-search')?.value || '').trim().toLowerCase();
  const categoryFilter = document.getElementById('filter-category')?.value || 'all';
  const typeFilter = document.getElementById('filter-type')?.value || 'all';
  
  let filtered = items.filter(i => (i.name || '').toLowerCase().includes(q));
  if (categoryFilter !== 'all') filtered = filtered.filter(i => i.category_id == categoryFilter);
  if (typeFilter !== 'all') filtered = filtered.filter(i => i.item_type === typeFilter);
  if (filterLowStock) filtered = filtered.filter(i => (i.available ?? 0) < LOW_STOCK_THRESHOLD);
  
  const lowStockCount = items.filter(i => (i.available ?? 0) < LOW_STOCK_THRESHOLD).length;
  const alertBar = document.getElementById('low-stock-alert');
  if (alertBar) {
    if (lowStockCount > 0) {
      alertBar.style.display = 'flex';
      alertBar.innerHTML = `<span>⚠️ يوجد <strong>${lowStockCount}</strong> مواد منخفضة المخزون (أقل من ${LOW_STOCK_THRESHOLD})</span> <span style="cursor:pointer;text-decoration:underline;">${filterLowStock ? 'إظهار الكل' : 'عرضها'}</span>`;
      alertBar.onclick = () => { filterLowStock = !filterLowStock; renderFilteredItems(); };
    } else {
      alertBar.style.display = 'none';
    }
  }
  
  if (!filtered.length) {
    return container.innerHTML = `<div class="empty-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
      <h3>لا توجد مواد مطابقة</h3>
      <p>يمكنك إضافة مواد جديدة من الزر أعلاه</p>
    </div>`;
  }

  // جدول بدون عمودي التصنيف والإجراءات
  let html = `
    <div class="table-wrap">
      <table class="table items-table">
        <thead>
          <tr>
            <th>#</th>
            <th>اسم المادة</th>
            <th>الكمية (الوحدة الأساسية)</th>
            <th>سعر البيع</th>
            <th>قيمة المخزون (بالتكلفة)</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  filtered.forEach((item, idx) => {
    const baseUnitName = item.base_unit?.name || item.base_unit?.abbreviation || 'قطعة';
    const available = item.available ?? 0;
    const stockStatus = available <= 0 ? 'نفذ' : available < LOW_STOCK_THRESHOLD ? 'منخفض' : 'متوفر';
    const stockColor = available <= 0 ? 'var(--danger)' : available < LOW_STOCK_THRESHOLD ? 'var(--warning)' : 'var(--success)';
    const sellingPrice = item.selling_price || 0;
    const totalValue = item.total_value ?? (available * (parseFloat(item.average_cost) || 0));
    const hasSubUnits = (item.item_units || []).length > 0;
    
    html += `
      <tr class="item-row" data-id="${item.id}" style="cursor:pointer;">
        <td>${idx + 1}</td>
        <td style="font-weight:800;">
          ${item.name}
          <!-- تم إزالة كلمة "وحدات" بناءً على طلب المستخدم -->
         </td>
        <td>
          <span style="color:${stockColor}; font-weight:700;">${available}</span> ${baseUnitName}
          <span style="font-size:10px; color:${stockColor}; margin-right:4px;">(${stockStatus})</span>
          ${computeSubUnitQuantities(available, baseUnitName, item.item_units || []) ? `<div style="font-size:9px; color:var(--text-muted); margin-top:2px;">${computeSubUnitQuantities(available, baseUnitName, item.item_units || [])}</div>` : ''}
         </td>
        <td><strong>${formatNumber(sellingPrice)}</strong></td>
        <td>${formatNumber(totalValue)}</td>
       </tr>
    `;
  });
  
  html += `
        </tbody>
       </table>
    </div>
  `;
  
  container.innerHTML = html;
  animateEntry('.item-row', 60);

  // ربط أحداث النقر على الصف (إظهار التفاصيل)
  container.querySelectorAll('.item-row').forEach(row => {
    row.addEventListener('click', (e) => {
      const itemId = row.dataset.id;
      if (itemId) showItemDetail(itemId);
    });
  });
}

export async function loadItems() {
  const container = document.getElementById('tab-content');
  
  let categories = storeGet('categories');
  if (!categories) {
    try { categories = await apiCall('/definitions?type=category', 'GET'); } catch (e) {}
  }
  const catOptions = (categories || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">المواد</h3>
          <span class="card-subtitle">إدارة المخزون والمنتجات</span>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-add-item">${ICONS.plus} إضافة</button>
      </div>
      <div id="low-stock-alert" style="display:none; background:var(--danger-light); border:1.5px solid var(--danger); border-radius:14px; padding:12px 16px; margin-bottom:16px; align-items:center; justify-content:space-between; font-size:14px; color:var(--danger); cursor:pointer; font-weight:700; box-shadow: 0 4px 12px -4px var(--danger-glow);"></div>
      <div class="form-group" style="margin-bottom:0;">
        <input type="text" class="input" id="items-search" placeholder="🔍 البحث في المواد...">
      </div>
      <div style="display:flex; gap:12px; margin-top:16px; flex-wrap:wrap;">
        <select class="select" id="filter-category" style="width:auto; min-width:140px;">
          <option value="all">كل التصنيفات</option>
          ${catOptions}
        </select>
        <select class="select" id="filter-type" style="width:auto; min-width:140px;">
          <option value="all">كل الأنواع</option>
          <option value="مخزون">مخزون</option>
          <option value="منتج نهائي">منتج نهائي</option>
          <option value="خدمة">خدمة</option>
        </select>
      </div>
    </div>
    <div id="items-list">
      ${renderSkeleton('table')}
    </div>
  `;
  
  document.getElementById('btn-add-item').addEventListener('click', showAddItemModal);
  document.getElementById('items-search').addEventListener('input', debounce(renderFilteredItems, 200));
  document.getElementById('filter-category').addEventListener('change', renderFilteredItems);
  document.getElementById('filter-type').addEventListener('change', renderFilteredItems);
  
  filterLowStock = false;
  
  try {
    await apiCall('/items', 'GET');
    renderFilteredItems();
  } catch (err) {
    document.getElementById('items-list').innerHTML = `<div class="empty-state"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg><h3>عذراً، حدث خطأ</h3><p>${err.message}</p></div>`;
    showToast(err.message, 'error');
  }
}

export function showItemDetail(itemId) {
  const items = storeGet('items') || [];
  const item = items.find(i => i.id == itemId);
  if (!item) return;

  const baseUnit = item.base_unit || {};
  const baseUnitName = baseUnit.name || baseUnit.abbreviation || 'قطعة';
  const itemUnits = item.item_units || [];

  let unitsHtml = '';
  if (itemUnits.length > 0) {
    unitsHtml = `
      <div style="margin-bottom:20px;">
        <div style="font-weight:800;margin-bottom:12px;color:var(--text-secondary); font-size:15px;">نظام الوحدات</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <!-- الوحدة الأساسية - تم تغيير اللون إلى primary -->
          <div style="background:var(--primary-light);border:1.5px solid var(--primary);border-radius:12px;padding:12px 16px;">
            <span style="color:var(--primary);font-weight:800;">الوحدة الأساسية:</span>
            <span style="font-weight:700;"> ${baseUnitName}</span>
          </div>`;
    
    itemUnits.forEach((iu, idx) => {
      const unit = iu.unit || {};
      const unitName = unit.name || unit.abbreviation || `وحدة ${idx + 2}`;
      unitsHtml += `
          <div style="background:var(--bg);border:1.5px solid var(--border);border-radius:12px;padding:12px 16px;">
            <span style="color:var(--primary);font-weight:800;">وحدة فرعية:</span>
            <span style="font-weight:700;"> ${unitName}</span>
            <span style="color:var(--text-muted); font-size:13px;"> (1 ${unitName} = ${iu.conversion_factor} ${baseUnitName})</span>
          </div>`;
    });
    unitsHtml += `</div></div>`;
  }

  const available = item.available ?? 0;
  const costValue = available * (parseFloat(item.average_cost) || 0);
  const sellingValue = available * (parseFloat(item.selling_price) || 0);
  const costDisplay = item.average_cost > 0 ? formatNumber(costValue) : 'غير محددة';
  const sellDisplay = item.selling_price > 0 ? formatNumber(sellingValue) : 'غير محددة';

  const purchaseQty = item.purchase_qty ?? 0;
  const saleQty = item.sale_qty ?? 0;
  const avgCost = parseFloat(item.average_cost) || 0;
  const purchasePrice = parseFloat(item.purchase_price) || 0;
  const sellingPrice = parseFloat(item.selling_price) || 0;

  const modal = openModal({
    title: item.name,
    bodyHTML: `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div class="stat-card" style="margin:0;padding:14px;">
          <div class="stat-label">الكمية المشتراة</div>
          <div class="stat-value" style="font-size:16px;">${purchaseQty} ${baseUnitName}</div>
        </div>
        <div class="stat-card" style="margin:0;padding:14px;">
          <div class="stat-label">الكمية المباعة</div>
          <div class="stat-value" style="font-size:16px;">${saleQty} ${baseUnitName}</div>
        </div>
        <div class="stat-card" style="margin:0;padding:14px;border-color:var(--primary);">
          <div class="stat-label">المتوفرة</div>
          <div class="stat-value text-primary" style="font-size:22px;">${available} ${baseUnitName}</div>
        </div>
        <div class="stat-card" style="margin:0;padding:14px;">
          <div class="stat-label">سعر الشراء (المتوسط)</div>
          <div class="stat-value" style="font-size:16px;">${formatNumber(avgCost)} / ${baseUnitName}</div>
        </div>
        <div class="stat-card" style="margin:0;padding:14px;">
          <div class="stat-label">سعر الشراء المسجل</div>
          <div class="stat-value" style="font-size:16px;">${formatNumber(purchasePrice)} / ${baseUnitName}</div>
        </div>
        <div class="stat-card" style="margin:0;padding:14px;">
          <div class="stat-label">سعر البيع</div>
          <div class="stat-value" style="font-size:16px;">${formatNumber(sellingPrice)} / ${baseUnitName}</div>
        </div>
        <div class="stat-card" style="margin:0;padding:14px; background: var(--primary-light); border: 2px solid var(--primary);">
          <div class="stat-label" style="color: var(--primary-dark);">💰 قيمة المخزون (بالتكلفة)</div>
          <div class="stat-value" style="font-size:20px; color: var(--primary);">${costDisplay}</div>
          <div style="font-size:11px; color: var(--text-muted);">المتوسط المرجح لجميع المشتريات</div>
        </div>
        <div class="stat-card" style="margin:0;padding:14px; background: var(--success-light);">
          <div class="stat-label">💵 قيمة المخزون (بسعر البيع)</div>
          <div class="stat-value" style="font-size:16px;">${sellDisplay}</div>
          <div style="font-size:11px; color: var(--text-muted);">تقديرية لو تم بيع المخزون</div>
        </div>
      </div>

      <div style="background:var(--bg);border-radius:16px;padding:18px;margin-bottom:20px;border:1.5px solid var(--border);">
        <h4 style="margin-bottom:14px;display:flex;align-items:center;gap:10px; font-size:15px;">
          <span style="background:var(--primary);color:#fff;border-radius:8px;padding:4px 10px;font-size:12px;">📋</span>
          ملخص حركات المادة
        </h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px; font-size:13px;">
          <div><span style="color:var(--text-muted);">عدد مرات الشراء:</span> <strong>${item.purchase_count ?? 0}</strong></div>
          <div><span style="color:var(--text-muted);">عدد مرات البيع:</span> <strong>${item.sale_count ?? 0}</strong></div>
          <div><span style="color:var(--text-muted);">آخر شراء:</span> <strong>${item.last_purchase_date ? formatDate(item.last_purchase_date) : 'لا يوجد'}</strong></div>
          <div><span style="color:var(--text-muted);">آخر بيع:</span> <strong>${item.last_sale_date ? formatDate(item.last_sale_date) : 'لا يوجد'}</strong></div>
          <div><span style="color:var(--text-muted);">إجمالي الكمية المشتراة:</span> <strong>${purchaseQty} ${baseUnitName}</strong></div>
          <div><span style="color:var(--text-muted);">إجمالي الكمية المباعة:</span> <strong>${saleQty} ${baseUnitName}</strong></div>
          <div><span style="color:var(--text-muted);">متوسط سعر الشراء (المسجل):</span> <strong>${formatNumber(purchasePrice)}</strong></div>
          <div><span style="color:var(--text-muted);">متوسط سعر البيع (المسجل):</span> <strong>${formatNumber(sellingPrice)}</strong></div>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:10px; font-weight:500;">
          * الإحصائيات أعلاه تعتمد على الفواتير المسجلة وقد تختلف عن الواقع في حال وجود أرصدة افتتاحية.
        </div>
      </div>

      ${unitsHtml}
      <div class="form-label">التصنيف</div>
      <p style="margin-bottom:14px; font-weight:600;">${item.category?.name || 'بدون تصنيف'}</p>
      <div class="form-label">نوع المادة</div>
      <p style="margin-bottom:14px; font-weight:600;">${item.item_type || 'مخزون'}</p>
    `,
    footerHTML: `
      <button class="btn btn-secondary" id="edit-item-btn">${ICONS.edit} تعديل</button>
      <button class="btn btn-danger" id="delete-item-btn">${ICONS.trash} حذف</button>
      <button class="btn btn-success" id="sell-item-btn">${ICONS.cart} بيع</button>
      <button class="btn btn-warning" id="buy-item-btn">${ICONS.download} شراء</button>
    `
  });

  modal.element.querySelector('#edit-item-btn').onclick = () => {
    modal.close();
    setTimeout(() => showEditItemModal(itemId), 250);
  };
  modal.element.querySelector('#delete-item-btn').onclick = () => {
    modal.close();
    setTimeout(async () => {
      if (await confirmDialog(`هل أنت متأكد من حذف المادة <strong>${item.name}</strong>؟`)) {
        try {
          await apiCall(`/items?id=${itemId}`, 'DELETE');
          showToast('تم الحذف بنجاح', 'success');
          loadItems();
        } catch (e) {
          showToast(e.message, 'error');
        }
      }
    }, 250);
  };
  modal.element.querySelector('#sell-item-btn').onclick = () => {
    modal.close();
    setTimeout(() => {
      import('./invoices.js').then(m => m.showInvoiceModal('sale', { itemId: itemId }));
    }, 250);
  };
  modal.element.querySelector('#buy-item-btn').onclick = () => {
    modal.close();
    setTimeout(() => {
      import('./invoices.js').then(m => m.showInvoiceModal('purchase', { itemId: itemId }));
    }, 250);
  };
}

async function showAddItemModal() {
  let categories = storeGet('categories');
  if (!categories) {
    try {
      categories = await apiCall('/definitions?type=category', 'GET');
    } catch (e) {
      showToast('فشل تحميل التصنيفات', 'error');
      return;
    }
  }
  const catOpts = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  const body = `
    <div class="form-group"><label class="form-label">اسم المادة</label><input class="input" id="fm-name" type="text" placeholder="مثال: حبر طابعة"></div>
    <div class="form-group"><label class="form-label">التصنيف</label><select class="select" id="fm-category_id"><option value="">بدون تصنيف</option>${catOpts}</select></div>
    <div class="form-group"><label class="form-label" style="font-size:12px;color:var(--text-muted);">أو أضف تصنيف جديد</label><div style="display:flex;gap:10px;"><input class="input" id="fm-new-category" type="text" placeholder="اسم التصنيف..." style="flex:1;"><button class="btn btn-secondary" id="btn-quick-cat" type="button" style="width:auto;padding:0 16px;">${ICONS.plus}</button></div></div>
    <div class="form-group"><label class="form-label">نوع المادة</label><select class="select" id="fm-item_type"><option value="مخزون">مخزون</option><option value="منتج نهائي">منتج نهائي</option><option value="خدمة">خدمة</option></select></div>

    <div class="form-group">
      <label class="form-label">الوحدة الأساسية</label>
      <div style="display:flex;gap:10px;align-items:center;">
        <input class="input" id="fm-base_unit_name" type="text" placeholder="مثال: قطعة" value="قطعة" style="flex:1;">
        <button class="btn btn-secondary" id="btn-toggle-units" type="button" style="width:auto;padding:10px 16px;" title="إضافة وحدات فرعية">${ICONS.plus}</button>
      </div>
    </div>

    <div id="extra-units" style="display:none;">
      <div class="form-group" style="background:var(--bg);border-radius:14px;padding:14px;border:1.5px solid var(--border);margin-bottom:14px;">
        <label class="form-label">الوحدة الفرعية 1 <span style="color:var(--text-muted);font-size:12px;">(تستند على الوحدة الأساسية)</span></label>
        <div style="display:flex;gap:10px;align-items:flex-end;">
          <div style="flex:1;"><input class="input" id="fm-unit2-name" type="text" placeholder="اسم الوحدة مثال: كرتونة"></div>
          <div style="width:130px;"><label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">عامل التحويل</label><input class="input" id="fm-unit2-factor" type="number" step="any" min="1" placeholder="مثال: 12" style="width:100%;"></div>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:8px;">1 <span class="sub-unit-name">وحدة فرعية 1</span> = <strong class="factor-display">؟</strong> <span class="base-unit-name">قطعة</span></div>
      </div>

      <div class="form-group" style="background:var(--bg);border-radius:14px;padding:14px;border:1.5px solid var(--border);">
        <label class="form-label">الوحدة الفرعية 2 <span style="color:var(--text-muted);font-size:12px;">(تستند على الوحدة الأساسية)</span></label>
        <div style="display:flex;gap:10px;align-items:flex-end;">
          <div style="flex:1;"><input class="input" id="fm-unit3-name" type="text" placeholder="اسم الوحدة مثال: طرد"></div>
          <div style="width:130px;"><label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">عامل التحويل</label><input class="input" id="fm-unit3-factor" type="number" step="any" min="1" placeholder="مثال: 10" style="width:100%;"></div>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:8px;">1 <span class="sub-unit-name">وحدة فرعية 2</span> = <strong class="factor-display">؟</strong> <span class="base-unit-name">قطعة</span></div>
      </div>
    </div>

    <div class="form-group" style="background:var(--bg);border-radius:14px;padding:14px;border:1.5px solid var(--border);">
      <label class="form-label">الكمية الافتتاحية</label>
      <div style="display:flex;gap:10px;align-items:flex-end;">
        <div style="flex:1;"><input class="input" id="fm-quantity" type="number" step="any" placeholder="0"></div>
        <div style="width:160px;"><select class="select" id="fm-qty-unit"><option value="base">الوحدة الأساسية</option><option value="u2">الوحدة الفرعية 1</option><option value="u3">الوحدة الفرعية 2</option></select></div>
      </div>
      <div id="qty-converted" style="font-size:12px;color:var(--text-muted);margin-top:8px;display:none;">= <strong id="qty-base-val">0</strong> <span class="base-unit-name">قطعة</span></div>
    </div>

    <div class="form-group"><label class="form-label">سعر الشراء <span style="color:var(--text-muted);font-size:12px;">(للوحدة الأساسية)</span></label><input class="input" id="fm-purchase_price" type="number" placeholder="0.00"></div>
    <div class="form-group"><label class="form-label">سعر البيع <span style="color:var(--text-muted);font-size:12px;">(للوحدة الأساسية)</span></label><input class="input" id="fm-selling_price" type="number" placeholder="0.00"></div>
  `;

  const modal = openModal({
    title: 'إضافة مادة جديدة',
    bodyHTML: body,
    footerHTML: `<button class="btn btn-secondary" id="fm-cancel">إلغاء</button><button class="btn btn-primary" id="fm-save">${ICONS.check} حفظ</button>`
  });

  const baseNameInput = modal.element.querySelector('#fm-base_unit_name');
  const extraUnitsDiv = modal.element.querySelector('#extra-units');
  const toggleBtn = modal.element.querySelector('#btn-toggle-units');

  toggleBtn.onclick = () => {
    const isHidden = extraUnitsDiv.style.display === 'none';
    extraUnitsDiv.style.display = isHidden ? 'block' : 'none';
    toggleBtn.innerHTML = isHidden ? ICONS.x : ICONS.plus;
    toggleBtn.title = isHidden ? 'إخفاء الوحدات الفرعية' : 'إضافة وحدات فرعية';
  };

  const updateUnitLabels = () => {
    const baseName = baseNameInput.value.trim() || 'الوحدة الأساسية';
    modal.element.querySelectorAll('.base-unit-name').forEach(el => el.textContent = baseName);
    const u2Name = modal.element.querySelector('#fm-unit2-name').value.trim();
    const u3Name = modal.element.querySelector('#fm-unit3-name').value.trim();
    const subs = modal.element.querySelectorAll('.sub-unit-name');
    const facts = modal.element.querySelectorAll('.factor-display');
    if (subs[0]) subs[0].textContent = u2Name || 'وحدة فرعية 1';
    if (subs[1]) subs[1].textContent = u3Name || 'وحدة فرعية 2';
    const f2 = modal.element.querySelector('#fm-unit2-factor').value;
    const f3 = modal.element.querySelector('#fm-unit3-factor').value;
    if (facts[0]) facts[0].textContent = f2 || '؟';
    if (facts[1]) facts[1].textContent = f3 || '؟';
  };

  baseNameInput.addEventListener('input', updateUnitLabels);
  modal.element.querySelector('#fm-unit2-name').addEventListener('input', updateUnitLabels);
  modal.element.querySelector('#fm-unit3-name').addEventListener('input', updateUnitLabels);
  modal.element.querySelector('#fm-unit2-factor').addEventListener('input', updateUnitLabels);
  modal.element.querySelector('#fm-unit3-factor').addEventListener('input', updateUnitLabels);

  const qtyInput = modal.element.querySelector('#fm-quantity');
  const qtyUnitSel = modal.element.querySelector('#fm-qty-unit');
  const qtyConvertedDiv = modal.element.querySelector('#qty-converted');
  const qtyBaseVal = modal.element.querySelector('#qty-base-val');

  const updateQty = () => {
    const qty = parseFloat(qtyInput.value) || 0;
    const unit = qtyUnitSel.value;
    const f2 = parseFloat(modal.element.querySelector('#fm-unit2-factor').value) || 1;
    const f3 = parseFloat(modal.element.querySelector('#fm-unit3-factor').value) || 1;
    let baseQty = qty;
    if (unit === 'u2') baseQty = qty * f2;
    else if (unit === 'u3') baseQty = qty * f3;
    if (qty > 0 && unit !== 'base') {
      qtyConvertedDiv.style.display = 'block';
      qtyBaseVal.textContent = baseQty;
    } else {
      qtyConvertedDiv.style.display = 'none';
    }
  };
  qtyInput.addEventListener('input', updateQty);
  qtyUnitSel.addEventListener('change', updateQty);
  modal.element.querySelector('#fm-unit2-factor').addEventListener('input', updateQty);
  modal.element.querySelector('#fm-unit3-factor').addEventListener('input', updateQty);

  modal.element.querySelector('#btn-quick-cat').onclick = async () => {
    const input = modal.element.querySelector('#fm-new-category');
    const select = modal.element.querySelector('#fm-category_id');
    const name = input.value.trim();
    if (!name) return showToast('أدخل اسم التصنيف أولاً', 'warning');
    const cats = storeGet('categories') || [];
    if (cats.some(x => x.name.toLowerCase() === name.toLowerCase())) return showToast('التصنيف موجود مسبقاً', 'warning');
    try {
      const res = await apiCall(`/definitions?type=category`, 'POST', { type: 'category', name });
      const newId = res?.id || res?.data?.id;
      if (!newId) throw new Error('خطأ في الاستجابة');
      storeSet('categories', [...cats, { id: newId, name }]);
      const o = document.createElement('option');
      o.value = newId; o.textContent = name;
      select.appendChild(o);
      select.value = newId;
      input.value = '';
      showToast('تم إضافة التصنيف واختياره', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  };

  modal.element.querySelector('#fm-cancel').onclick = () => modal.close();

  async function getOrCreateUnit(name) {
    if (!name) return null;
    let units = storeGet('units') || [];
    const existing = units.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const res = await apiCall('/definitions?type=unit', 'POST', { type: 'unit', name, abbreviation: name });
    const newId = res?.id || res?.data?.id;
    if (newId) storeSet('units', [...units, { id: newId, name, abbreviation: name }]);
    return newId;
  }

  const saveBtn = modal.element.querySelector('#fm-save');
  saveBtn.onclick = async () => {
    if (saveBtn.disabled) return;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="loader-inline"></span> جاري الحفظ...`;

    try {
      const baseUnitName = baseNameInput.value.trim();
      if (!baseUnitName) throw new Error('اسم الوحدة الأساسية مطلوب');
      const baseUnitId = await getOrCreateUnit(baseUnitName);
      if (!baseUnitId) throw new Error('فشل إنشاء الوحدة الأساسية');

      const u2Name = modal.element.querySelector('#fm-unit2-name').value.trim();
      const u2Factor = parseFloat(modal.element.querySelector('#fm-unit2-factor').value);
      const u3Name = modal.element.querySelector('#fm-unit3-name').value.trim();
      const u3Factor = parseFloat(modal.element.querySelector('#fm-unit3-factor').value);

      let unit2Id = null, unit3Id = null;
      if (u2Name) { unit2Id = await getOrCreateUnit(u2Name); if (!unit2Id) throw new Error('فشل إنشاء الوحدة الفرعية 1'); }
      if (u3Name) { unit3Id = await getOrCreateUnit(u3Name); if (!unit3Id) throw new Error('فشل إنشاء الوحدة الفرعية 2'); }

      const itemUnits = [];
      if (unit2Id && u2Factor > 0) itemUnits.push({ unit_id: unit2Id, conversion_factor: u2Factor });
      if (unit3Id && u3Factor > 0) itemUnits.push({ unit_id: unit3Id, conversion_factor: u3Factor });

      const qtyEntered = parseFloat(qtyInput.value) || 0;
      const qtyUnit = qtyUnitSel.value;
      let quantity = qtyEntered;
      if (qtyUnit === 'u2' && u2Factor > 0) quantity = qtyEntered * u2Factor;
      else if (qtyUnit === 'u3' && u3Factor > 0) quantity = qtyEntered * u3Factor;

      const values = {
        name: modal.element.querySelector('#fm-name').value.trim(),
        category_id: modal.element.querySelector('#fm-category_id').value || null,
        item_type: modal.element.querySelector('#fm-item_type').value,
        purchase_price: parseFloat(modal.element.querySelector('#fm-purchase_price').value) || 0,
        selling_price: parseFloat(modal.element.querySelector('#fm-selling_price').value) || 0,
        quantity: quantity,
        base_unit_id: baseUnitId,
        item_units: itemUnits
      };

      if (!values.name) throw new Error('اسم المادة مطلوب');
      const currentItems = storeGet('items') || [];
      if (currentItems.some(i => i.name.toLowerCase() === values.name.toLowerCase())) throw new Error('توجد مادة بنفس الاسم');

      await apiCall('/items', 'POST', values);
      modal.close();
      showToast('تم الحفظ بنجاح', 'success');
      loadItems();
    } catch (e) {
      showToast(e.message, 'error');
      saveBtn.disabled = false;
      saveBtn.innerHTML = `${ICONS.check} حفظ`;
    }
  };
}

async function showEditItemModal(itemId) {
  const items = storeGet('items') || [];
  let categories = storeGet('categories');
  if (!categories) {
    try { categories = await apiCall('/definitions?type=category', 'GET'); } catch (e) { showToast('فشل تحميل التصنيفات', 'error'); return; }
  }
  const it = items.find(i => i.id === itemId);
  if (!it) return;

  const catOpts = categories.map(c => `<option value="${c.id}" ${c.id === it.category_id ? 'selected' : ''}>${c.name}</option>`).join('');
  const baseUnitName = it.base_unit?.name || it.base_unit?.abbreviation || 'قطعة';
  const iu = it.item_units || [];
  const iu1 = iu[0] || {};
  const iu2 = iu[1] || {};
  const u1Name = iu1.unit?.name || '';
  const u1Factor = iu1.conversion_factor || '';
  const u2Name = iu2.unit?.name || '';
  const u2Factor = iu2.conversion_factor || '';
  const hasExtraUnits = !!(u1Name || u2Name);

  const body = `
    <div class="form-group"><label class="form-label">اسم المادة</label><input class="input" id="fm-name" type="text" value="${it.name || ''}"></div>
    <div class="form-group"><label class="form-label">التصنيف</label><select class="select" id="fm-category_id"><option value="">بدون تصنيف</option>${catOpts}</select></div>
    <div class="form-group"><label class="form-label" style="font-size:12px;color:var(--text-muted);">أو أضف تصنيف جديد</label><div style="display:flex;gap:10px;"><input class="input" id="fm-new-category" type="text" placeholder="اسم التصنيف..." style="flex:1;"><button class="btn btn-secondary" id="btn-quick-cat" type="button" style="width:auto;padding:0 16px;">${ICONS.plus}</button></div></div>
    <div class="form-group"><label class="form-label">نوع المادة</label><select class="select" id="fm-item_type"><option value="مخزون" ${it.item_type === 'مخزون' ? 'selected' : ''}>مخزون</option><option value="منتج نهائي" ${it.item_type === 'منتج نهائي' ? 'selected' : ''}>منتج نهائي</option><option value="خدمة" ${it.item_type === 'خدمة' ? 'selected' : ''}>خدمة</option></select></div>

    <div class="form-group">
      <label class="form-label">الوحدة الأساسية</label>
      <div style="display:flex;gap:10px;align-items:center;">
        <input class="input" id="fm-base_unit_name" type="text" value="${baseUnitName}" style="flex:1;">
        <button class="btn btn-secondary" id="btn-toggle-units" type="button" style="width:auto;padding:10px 16px;" title="إضافة وحدات فرعية">${hasExtraUnits ? ICONS.x : ICONS.plus}</button>
      </div>
    </div>

    <div id="extra-units" style="display:${hasExtraUnits ? 'block' : 'none'};">
      <div class="form-group" style="background:var(--bg);border-radius:14px;padding:14px;border:1.5px solid var(--border);margin-bottom:14px;">
        <label class="form-label">الوحدة الفرعية 1 <span style="color:var(--text-muted);font-size:12px;">(تستند على الوحدة الأساسية)</span></label>
        <div style="display:flex;gap:10px;align-items:flex-end;">
          <div style="flex:1;"><input class="input" id="fm-unit2-name" type="text" placeholder="اسم الوحدة مثال: كرتونة" value="${u1Name}"></div>
          <div style="width:130px;"><label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">عامل التحويل</label><input class="input" id="fm-unit2-factor" type="number" step="any" min="1" placeholder="مثال: 12" value="${u1Factor}" style="width:100%;"></div>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:8px;">1 <span class="sub-unit-name">${u1Name || 'وحدة فرعية 1'}</span> = <strong class="factor-display">${u1Factor || '؟'}</strong> <span class="base-unit-name">${baseUnitName}</span></div>
      </div>

      <div class="form-group" style="background:var(--bg);border-radius:14px;padding:14px;border:1.5px solid var(--border);">
        <label class="form-label">الوحدة الفرعية 2 <span style="color:var(--text-muted);font-size:12px;">(تستند على الوحدة الأساسية)</span></label>
        <div style="display:flex;gap:10px;align-items:flex-end;">
          <div style="flex:1;"><input class="input" id="fm-unit3-name" type="text" placeholder="اسم الوحدة مثال: طرد" value="${u2Name}"></div>
          <div style="width:130px;"><label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">عامل التحويل</label><input class="input" id="fm-unit3-factor" type="number" step="any" min="1" placeholder="مثال: 10" value="${u2Factor}" style="width:100%;"></div>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:8px;">1 <span class="sub-unit-name">${u2Name || 'وحدة فرعية 2'}</span> = <strong class="factor-display">${u2Factor || '؟'}</strong> <span class="base-unit-name">${baseUnitName}</span></div>
      </div>
    </div>

    <div class="form-group" style="background:var(--bg);border-radius:14px;padding:14px;border:1.5px solid var(--border);">
      <label class="form-label">الكمية الافتتاحية</label>
      <div style="display:flex;gap:10px;align-items:flex-end;">
        <div style="flex:1;"><input class="input" id="fm-quantity" type="number" step="any" value="${it.quantity || 0}"></div>
        <div style="width:160px;"><select class="select" id="fm-qty-unit"><option value="base">الوحدة الأساسية</option><option value="u2">الوحدة الفرعية 1</option><option value="u3">الوحدة الفرعية 2</option></select></div>
      </div>
      <div id="qty-converted" style="font-size:12px;color:var(--text-muted);margin-top:8px;display:none;">= <strong id="qty-base-val">0</strong> <span class="base-unit-name">${baseUnitName}</span></div>
    </div>

    <div class="form-group"><label class="form-label">سعر الشراء <span style="color:var(--text-muted);font-size:12px;">(للوحدة الأساسية)</span></label><input class="input" id="fm-purchase_price" type="number" value="${it.purchase_price || 0}"></div>
    <div class="form-group"><label class="form-label">سعر البيع <span style="color:var(--text-muted);font-size:12px;">(للوحدة الأساسية)</span></label><input class="input" id="fm-selling_price" type="number" value="${it.selling_price || 0}"></div>
  `;

  const modal = openModal({
    title: 'تعديل المادة',
    bodyHTML: body,
    footerHTML: `<button class="btn btn-secondary" id="fm-cancel">إلغاء</button><button class="btn btn-primary" id="fm-save">${ICONS.check} حفظ</button>`
  });

  const baseNameInput = modal.element.querySelector('#fm-base_unit_name');
  const extraUnitsDiv = modal.element.querySelector('#extra-units');
  const toggleBtn = modal.element.querySelector('#btn-toggle-units');

  toggleBtn.onclick = () => {
    const isHidden = extraUnitsDiv.style.display === 'none';
    extraUnitsDiv.style.display = isHidden ? 'block' : 'none';
    toggleBtn.innerHTML = isHidden ? ICONS.x : ICONS.plus;
    toggleBtn.title = isHidden ? 'إخفاء الوحدات الفرعية' : 'إضافة وحدات فرعية';
  };

  const updateUnitLabels = () => {
    const baseName = baseNameInput.value.trim() || 'الوحدة الأساسية';
    modal.element.querySelectorAll('.base-unit-name').forEach(el => el.textContent = baseName);
    const u2Name = modal.element.querySelector('#fm-unit2-name').value.trim();
    const u3Name = modal.element.querySelector('#fm-unit3-name').value.trim();
    const subs = modal.element.querySelectorAll('.sub-unit-name');
    const facts = modal.element.querySelectorAll('.factor-display');
    if (subs[0]) subs[0].textContent = u2Name || 'وحدة فرعية 1';
    if (subs[1]) subs[1].textContent = u3Name || 'وحدة فرعية 2';
    const f2 = modal.element.querySelector('#fm-unit2-factor').value;
    const f3 = modal.element.querySelector('#fm-unit3-factor').value;
    if (facts[0]) facts[0].textContent = f2 || '؟';
    if (facts[1]) facts[1].textContent = f3 || '؟';
  };

  baseNameInput.addEventListener('input', updateUnitLabels);
  modal.element.querySelector('#fm-unit2-name').addEventListener('input', updateUnitLabels);
  modal.element.querySelector('#fm-unit3-name').addEventListener('input', updateUnitLabels);
  modal.element.querySelector('#fm-unit2-factor').addEventListener('input', updateUnitLabels);
  modal.element.querySelector('#fm-unit3-factor').addEventListener('input', updateUnitLabels);

  const qtyInput = modal.element.querySelector('#fm-quantity');
  const qtyUnitSel = modal.element.querySelector('#fm-qty-unit');
  const qtyConvertedDiv = modal.element.querySelector('#qty-converted');
  const qtyBaseVal = modal.element.querySelector('#qty-base-val');

  const updateQty = () => {
    const qty = parseFloat(qtyInput.value) || 0;
    const unit = qtyUnitSel.value;
    const f2 = parseFloat(modal.element.querySelector('#fm-unit2-factor').value) || 1;
    const f3 = parseFloat(modal.element.querySelector('#fm-unit3-factor').value) || 1;
    let baseQty = qty;
    if (unit === 'u2') baseQty = qty * f2;
    else if (unit === 'u3') baseQty = qty * f3;
    if (qty > 0 && unit !== 'base') {
      qtyConvertedDiv.style.display = 'block';
      qtyBaseVal.textContent = baseQty;
    } else {
      qtyConvertedDiv.style.display = 'none';
    }
  };
  qtyInput.addEventListener('input', updateQty);
  qtyUnitSel.addEventListener('change', updateQty);
  modal.element.querySelector('#fm-unit2-factor').addEventListener('input', updateQty);
  modal.element.querySelector('#fm-unit3-factor').addEventListener('input', updateQty);

  modal.element.querySelector('#btn-quick-cat').onclick = async () => {
    const input = modal.element.querySelector('#fm-new-category');
    const select = modal.element.querySelector('#fm-category_id');
    const name = input.value.trim();
    if (!name) return showToast('أدخل اسم التصنيف أولاً', 'warning');
    const cats = storeGet('categories') || [];
    if (cats.some(x => x.name.toLowerCase() === name.toLowerCase())) return showToast('التصنيف موجود مسبقاً', 'warning');
    try {
      const res = await apiCall(`/definitions?type=category`, 'POST', { type: 'category', name });
      const newId = res?.id || res?.data?.id;
      if (!newId) throw new Error('خطأ في الاستجابة');
      storeSet('categories', [...cats, { id: newId, name }]);
      const o = document.createElement('option');
      o.value = newId; o.textContent = name;
      select.appendChild(o);
      select.value = newId;
      input.value = '';
      showToast('تم إضافة التصنيف واختياره', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  };

  modal.element.querySelector('#fm-cancel').onclick = () => modal.close();

  async function getOrCreateUnit(name) {
    if (!name) return null;
    let units = storeGet('units') || [];
    const existing = units.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const res = await apiCall('/definitions?type=unit', 'POST', { type: 'unit', name, abbreviation: name });
    const newId = res?.id || res?.data?.id;
    if (newId) storeSet('units', [...units, { id: newId, name, abbreviation: name }]);
    return newId;
  }

  const saveBtn = modal.element.querySelector('#fm-save');
  saveBtn.onclick = async () => {
    if (saveBtn.disabled) return;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="loader-inline"></span> جاري الحفظ...`;

    try {
      const baseUnitName = baseNameInput.value.trim();
      if (!baseUnitName) throw new Error('اسم الوحدة الأساسية مطلوب');
      const baseUnitId = await getOrCreateUnit(baseUnitName);
      if (!baseUnitId) throw new Error('فشل إنشاء الوحدة الأساسية');

      const u2Name = modal.element.querySelector('#fm-unit2-name').value.trim();
      const u2Factor = parseFloat(modal.element.querySelector('#fm-unit2-factor').value);
      const u3Name = modal.element.querySelector('#fm-unit3-name').value.trim();
      const u3Factor = parseFloat(modal.element.querySelector('#fm-unit3-factor').value);

      let unit2Id = null, unit3Id = null;
      if (u2Name) { unit2Id = await getOrCreateUnit(u2Name); if (!unit2Id) throw new Error('فشل إنشاء الوحدة الفرعية 1'); }
      if (u3Name) { unit3Id = await getOrCreateUnit(u3Name); if (!unit3Id) throw new Error('فشل إنشاء الوحدة الفرعية 2'); }

      const itemUnits = [];
      if (unit2Id && u2Factor > 0) itemUnits.push({ unit_id: unit2Id, conversion_factor: u2Factor });
      if (unit3Id && u3Factor > 0) itemUnits.push({ unit_id: unit3Id, conversion_factor: u3Factor });

      const qtyEntered = parseFloat(qtyInput.value) || 0;
      const qtyUnit = qtyUnitSel.value;
      let quantity = qtyEntered;
      if (qtyUnit === 'u2' && u2Factor > 0) quantity = qtyEntered * u2Factor;
      else if (qtyUnit === 'u3' && u3Factor > 0) quantity = qtyEntered * u3Factor;

      const values = {
        name: modal.element.querySelector('#fm-name').value.trim(),
        category_id: modal.element.querySelector('#fm-category_id').value || null,
        item_type: modal.element.querySelector('#fm-item_type').value,
        purchase_price: parseFloat(modal.element.querySelector('#fm-purchase_price').value) || 0,
        selling_price: parseFloat(modal.element.querySelector('#fm-selling_price').value) || 0,
        quantity: quantity,
        base_unit_id: baseUnitId,
        item_units: itemUnits
      };

      await apiCall('/items', 'PUT', { id: itemId, ...values });
      modal.close();
      showToast('تم الحفظ بنجاح', 'success');
      loadItems();
    } catch (e) {
      showToast(e.message, 'error');
      saveBtn.disabled = false;
      saveBtn.innerHTML = `${ICONS.check} حفظ`;
    }
  };
}

window.showItemDetail = showItemDetail;
