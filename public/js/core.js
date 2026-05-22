// public/js/core.js - النواة الأساسية للتطبيق (مع دعم حقول البحث في الفواتير)
import API from './sql-db.js';

export const initData = 'local_user';
export const apiBase = '';

// أيقونات SVG (كاملة)
export const ICONS = {
  home: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  box: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
  cart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
  download: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  users: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  factory: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22h20"/><path d="M4 22V10l4-2v14"/><path d="M12 22V8l4-2v16"/><path d="M20 22V4l-4 2v16"/></svg>',
  tag: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  wallet: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><path d="M16 10a4 4 0 0 1-4 4"/></svg>',
  dollar: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  fileText: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
  chart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  alert: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  print: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  file: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  scale: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/></svg>',
  send: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>'
};

// دوال مساعدة عامة
export function formatNumber(num) {
  if (num === undefined || num === null || isNaN(num)) return '0';
  const n = Number(num);
  if (Number.isInteger(n)) return n.toLocaleString('en-US');
  return parseFloat(n.toFixed(2)).toLocaleString('en-US');
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function debounce(fn, ms = 300) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

let scrollLockPos = 0;
export function lockScroll() {
  scrollLockPos = window.scrollY || document.documentElement.scrollTop;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollLockPos}px`;
  document.body.style.width = '100%';
  document.body.classList.add('scroll-locked');
}

export function unlockScroll() {
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  document.body.classList.remove('scroll-locked');
  window.scrollTo(0, scrollLockPos);
}

// التخزين المؤقت
const cache = {};
export function invalidateCache(key) { delete cache[key]; }
export function setCache(key, data) { cache[key] = data; }
export function getCache(key) { return cache[key]; }

// دالة apiCall الرئيسية (تربط بين الواجهة و sql-db.js)
export async function apiCall(endpoint, method = 'GET', body = {}, retries = 1) {
  try {
    const [path, queryString] = endpoint.split('?');
    const params = new URLSearchParams(queryString || '');

    if (method === 'GET') {
      if (path === '/customers') return await API.getCustomers();
      if (path === '/suppliers') return await API.getSuppliers();
      if (path === '/definitions') {
        const type = params.get('type');
        if (type === 'category') return await API.getCategories();
        if (type === 'unit') return await API.getUnits();
      }
      if (path === '/items') {
        const items = await API.getItems();
        cache['items'] = items;
        return items;
      }
      if (path === '/invoices') return await API.getInvoices();
      if (path === '/expenses') return await API.getExpenses();
      if (path === '/payments' && params.get('voucher') === '1') return await API.getVouchers();
      if (path === '/summary') return await API.getSummary();
      if (path === '/accounts') return await API.getAccounts();
      if (path === '/verify') return await API.verify();
    } 
    else if (method === 'POST') {
      if (path === '/customers') return await API.addCustomer(body);
      if (path === '/suppliers') return await API.addSupplier(body);
      if (path === '/definitions') {
        if (body.type === 'category') return await API.addCategory(body.name);
        if (body.type === 'unit') return await API.addUnit(body.name, body.abbreviation);
      }
      if (path === '/items') {
        const result = await API.addItem(body);
        invalidateCache('items');
        return result;
      }
      if (path === '/invoices') return await API.createInvoice(body);
      if (path === '/expenses') return await API.addExpense(body);
      if (path === '/payments' && body.voucher === true) return await API.addVoucher(body);
      if (path === '/verify') return await API.verify();
    }
    else if (method === 'PUT') {
      const id = body.id;
      if (!id) throw new Error('معرف مطلوب للتعديل');
      if (path === '/customers') return await API.updateCustomer(id, body);
      if (path === '/suppliers') return await API.updateSupplier(id, body);
      if (path === '/definitions') {
        if (body.type === 'category') return await API.updateCategory(id, body.name);
        if (body.type === 'unit') return await API.updateUnit(id, body.name, body.abbreviation);
      }
      if (path === '/items') {
        const result = await API.updateItem(id, body);
        invalidateCache('items');
        return result;
      }
    }
    else if (method === 'DELETE') {
      const id = params.get('id');
      if (!id) throw new Error('معرف مطلوب للحذف');
      if (path === '/customers') return await API.deleteCustomer(parseInt(id));
      if (path === '/suppliers') return await API.deleteSupplier(parseInt(id));
      if (path === '/definitions') {
        const type = params.get('type');
        if (type === 'category') return await API.deleteCategory(parseInt(id));
        if (type === 'unit') return await API.deleteUnit(parseInt(id));
      }
      if (path === '/items') {
        const result = await API.deleteItem(parseInt(id));
        invalidateCache('items');
        return result;
      }
      if (path === '/invoices') return await API.deleteInvoice(parseInt(id));
      if (path === '/expenses') return await API.deleteExpense(parseInt(id));
      if (path === '/payments' && params.get('voucher') === '1') return await API.deleteVoucher(parseInt(id));
    }
    throw new Error(`API endpoint غير معروف: ${method} ${endpoint}`);
  } catch (err) {
    console.error('apiCall error:', err);
    throw err;
  }
}

// دالة للحصول على خيارات الوحدة لمادة معينة (تستخدم في generateLineRowHtml)
export function getUnitOptionsForItem(itemId, selectedUnitId = null) {
  const items = cache['items'] || [];
  const units = cache['units'] || [];
  const item = items.find(i => i.id == itemId);
  if (!item) return '<option value="">اختر مادة</option>';
  const baseUnit = units.find(u => u.id == item.base_unit_id) || {};
  const baseName = baseUnit.name || baseUnit.abbreviation || 'قطعة';
  let opts = `<option value="" data-factor="1" ${!selectedUnitId ? 'selected' : ''}>${baseName} (أساسية)</option>`;
  (item.item_units || []).forEach(iu => {
    const u = units.find(unit => unit.id == iu.unit_id) || {};
    const name = u.name || u.abbreviation || 'وحدة';
    opts += `<option value="${iu.unit_id}" data-factor="${iu.conversion_factor}" ${iu.unit_id == selectedUnitId ? 'selected' : ''}>${name} (${iu.conversion_factor}x ${baseName})</option>`;
  });
  return opts;
}

// توليد صف بند في الفاتورة (يدعم البحث عن المواد)
export function generateLineRowHtml(lineData = null, isSale, itemsArray = null, unitsArray = null) {
  const items = itemsArray || (cache['items'] || []);
  const selectedItemId = lineData ? lineData.item_id : '';
  const selectedItemName = selectedItemId ? (items.find(i => i.id == selectedItemId)?.name || '') : '';
  const qty = lineData ? lineData.quantity : '';
  const price = lineData ? lineData.unit_price : '';
  const total = lineData ? lineData.total : '';
  const unitId = lineData ? lineData.unit_id : '';
  const itemListId = `item-datalist-${Math.random().toString(36).substring(2, 10)}`;
  const itemOptions = items.map(i => `<option value="${i.name}" data-id="${i.id}">${i.name}</option>`).join('');

  return `
    <div class="line-row">
      <div class="form-group" style="grid-column:1/-1">
        <input type="text" class="input item-search" placeholder="ابحث عن مادة..." autocomplete="off" list="${itemListId}" value="${selectedItemName.replace(/"/g, '&quot;')}">
        <datalist id="${itemListId}">${itemOptions}</datalist>
        <input type="hidden" class="item-id-hidden" value="${selectedItemId}">
      </div>
      <div class="form-group">
        <select class="select unit-select" style="${selectedItemId ? '' : 'display:none;'}">
          ${selectedItemId ? getUnitOptionsForItem(selectedItemId, unitId) : '<option value="">الوحدة</option>'}
        </select>
      </div>
      <div class="form-group"><input type="number" step="any" class="input qty-input" placeholder="الكمية" value="${qty}"></div>
      <div class="form-group"><input type="number" step="0.01" class="input price-input" placeholder="السعر" value="${price}"></div>
      <div class="form-group"><input type="number" step="0.01" class="input total-input" placeholder="الإجمالي" readonly style="background:var(--bg);font-weight:700;" value="${total}"></div>
      <button class="line-remove" title="حذف البند">${ICONS.trash}</button>
    </div>`;
}

export function renderSkeleton(type = 'cards') {
  let html = '';
  switch (type) {
    case 'cards':
      html = Array(3).fill(`<div class="skeleton-card"><div class="skeleton-line w-60"></div><div class="skeleton-line w-80"></div><div class="skeleton-line w-40"></div></div>`).join('');
      break;
    case 'table':
      html = `<div class="skeleton-table"><div class="skeleton-header"><div class="skeleton-line w-25"></div><div class="skeleton-line w-25"></div><div class="skeleton-line w-25"></div><div class="skeleton-line w-25"></div></div>${Array(5).fill(`<div class="skeleton-row"><div class="skeleton-line w-30"></div><div class="skeleton-line w-20"></div><div class="skeleton-line w-15"></div><div class="skeleton-line w-15"></div></div>`).join('')}</div>`;
      break;
    case 'stats':
      html = `<div class="skeleton-stats">${Array(4).fill(`<div class="skeleton-stat"><div class="skeleton-line w-50"></div><div class="skeleton-line w-70" style="height:28px;margin-top:8px;"></div></div>`).join('')}</div>`;
      break;
    case 'list':
      html = Array(4).fill(`<div class="skeleton-list-item"><div class="skeleton-line w-60"></div><div class="skeleton-line w-30"></div></div>`).join('');
      break;
    case 'chart':
      html = `<div class="skeleton-chart"><div class="skeleton-line w-40" style="margin-bottom:16px;"></div><div style="height:200px;background:var(--border);border-radius:8px;animation:pulse 1.5s infinite;"></div></div>`;
      break;
    default:
      html = '<div class="skeleton-card"><div class="skeleton-line w-80"></div></div>';
  }
  return `<div class="skeleton-container">${html}</div>`;
}

export function animateEntry(selector, delay = 0) {
  const elements = document.querySelectorAll(selector);
  elements.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    setTimeout(() => {
      el.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, delay + (i * 80));
  });
}

// تحميل البيانات الأساسية في الخلفية وتخزينها في cache
export async function preloadData() {
  try {
    const [customers, suppliers, categories, units, items, invoices, vouchers] = await Promise.all([
      API.getCustomers().catch(() => []),
      API.getSuppliers().catch(() => []),
      API.getCategories().catch(() => []),
      API.getUnits().catch(() => []),
      API.getItems().catch(() => []),
      API.getInvoices().catch(() => []),
      API.getVouchers().catch(() => [])
    ]);
    cache['customers'] = customers;
    cache['suppliers'] = suppliers;
    cache['categories'] = categories;
    cache['units'] = units;
    cache['items'] = items;
    cache['invoices'] = invoices;
    cache['vouchers'] = vouchers;
  } catch (err) {
    console.warn('فشل تحميل البيانات الأولية', err);
  }
}
