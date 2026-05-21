// js/core.js - utilities, icons, local API, helpers, inventory reverse functions
import { getAll, get, save, del, getByIndex, invalidate } from './store.js';
import { showToast } from './modal.js';

export const ICONS = {
  home: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  box: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
  cart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
  download: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  users: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  factory: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22h20"/><path d="M4 22V10l4-2v14"/><path d="M12 22V8l4-2v16"/><path d="M20 22V4l-4 2v16"/></svg>',
  tag: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  wallet: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><path d="M16 10a4 4 0 0 1-4 4"/></svg>',
  dollar: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  fileText: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
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
  send: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  scale: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/></svg>'
};

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
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function lockScroll() { document.body.style.overflow = 'hidden'; }
export function unlockScroll() { document.body.style.overflow = ''; }

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

export function renderSkeleton(type = 'cards') {
  let html = '';
  switch(type) {
    case 'cards':
      html = '<div class="stats-grid">' + Array(4).fill('<div class="stat-card"><div class="skeleton-line w-60"></div><div class="skeleton-line w-80" style="height:32px; margin-top:8px;"></div></div>').join('') + '</div>';
      break;
    case 'table':
      html = '<div class="table-wrap"><div class="skeleton-header">' + Array(4).fill('<div class="skeleton-line w-25"></div>').join('') + '</div>' + Array(5).fill('<div class="skeleton-row">' + Array(4).fill('<div class="skeleton-line"></div>').join('') + '</div>').join('') + '</div>';
      break;
    default:
      html = '<div class="card"><div class="skeleton-line w-80"></div></div>';
  }
  return `<div class="skeleton-container">${html}</div>`;
}

// Local API handler - replaces old apiCall
export async function apiCall(endpoint, method = 'GET', body = {}) {
  const url = new URL(endpoint, 'http://localhost');
  const path = url.pathname;
  const query = Object.fromEntries(url.searchParams.entries());
  
  let store = null;
  if (path === '/customers') store = 'customers';
  else if (path === '/suppliers') store = 'suppliers';
  else if (path === '/items') store = 'items';
  else if (path === '/invoices') store = 'invoices';
  else if (path === '/payments') store = query.voucher === '1' ? 'vouchers' : 'payments';
  else if (path === '/expenses') store = 'expenses';
  else if (path === '/accounts') store = 'accounts';
  else if (path === '/definitions') store = query.type === 'category' ? 'categories' : (query.type === 'unit' ? 'units' : null);

  if (method === 'GET') {
    if (store) {
      let data = await getAll(store);
      if (store === 'items') {
        const categories = await getAll('categories');
        const units = await getAll('units');
        const itemUnits = await getAll('item_units');
        data = data.map(item => ({
          ...item,
          category: categories.find(c => c.id === item.category_id),
          base_unit: units.find(u => u.id === item.base_unit_id),
          item_units: itemUnits.filter(iu => iu.item_id === item.id).map(iu => ({ ...iu, unit: units.find(u => u.id === iu.unit_id) }))
        }));
      }
      if (store === 'invoices') {
        const customers = await getAll('customers');
        const suppliers = await getAll('suppliers');
        const lines = await getAll('invoice_lines');
        const itemsAll = await getAll('items');
        const unitsAll = await getAll('units');
        data = data.map(inv => ({
          ...inv,
          customer: customers.find(c => c.id === inv.customer_id),
          supplier: suppliers.find(s => s.id === inv.supplier_id),
          invoice_lines: lines.filter(l => l.invoice_id === inv.id).map(l => ({
            ...l,
            item: itemsAll.find(i => i.id === l.item_id),
            unit: unitsAll.find(u => u.id === l.unit_id)
          }))
        }));
      }
      if (store === 'vouchers') {
        const customers = await getAll('customers');
        const suppliers = await getAll('suppliers');
        data = data.map(v => ({ ...v, customer: customers.find(c => c.id === v.customer_id), supplier: suppliers.find(s => s.id === v.supplier_id) }));
      }
      return data;
    } else if (path === '/summary') {
      const invoices = await getAll('invoices');
      const payments = await getAll('payments');
      const expenses = await getAll('expenses');
      const customers = await getAll('customers');
      const suppliers = await getAll('suppliers');
      const vouchers = await getAll('vouchers');
      const totalSales = invoices.filter(i => i.type === 'sale').reduce((s,i)=>s+(i.total||0),0);
      const totalPurchases = invoices.filter(i => i.type === 'purchase').reduce((s,i)=>s+(i.total||0),0);
      const totalExpenses = expenses.reduce((s,e)=>s+(e.amount||0),0);
      const cashBalance = vouchers.reduce((s,v)=> s + (v.type === 'receipt' ? v.amount : -v.amount), 0);
      const receivables = customers.reduce((s,c)=>s+(c.balance||0),0);
      const payables = suppliers.reduce((s,supp)=>s+(supp.balance||0),0);
      return { net_profit: totalSales - totalPurchases - totalExpenses, cash_balance: cashBalance, receivables, payables, total_sales: totalSales, total_purchases: totalPurchases, total_expenses: totalExpenses };
    } else if (path === '/verify') {
      return { verified: true };
    }
  } else if (method === 'POST') {
    if (store) {
      const newItem = { ...body, id: undefined };
      const id = await save(store, newItem);
      await invalidate(store);
      return { ...newItem, id };
    } else if (path === '/definitions') {
      const storeName = body.type === 'category' ? 'categories' : 'units';
      const newItem = { name: body.name, abbreviation: body.abbreviation || null };
      const id = await save(storeName, newItem);
      await invalidate(storeName);
      return { ...newItem, id };
    }
  } else if (method === 'PUT') {
    if (store) {
      await save(store, body);
      await invalidate(store);
      return body;
    }
  } else if (method === 'DELETE') {
    if (store && query.id) {
      await del(store, parseInt(query.id));
      await invalidate(store);
      return { success: true };
    }
  }
  return null;
}

export async function getUnitOptionsForItem(itemId, selectedUnitId = null) {
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

export function generateLineRowHtml(lineData = null, isSale) {
  const selectedItemId = lineData ? lineData.item_id : '';
  const qty = lineData ? lineData.quantity : '';
  const price = lineData ? lineData.unit_price : '';
  const total = lineData ? lineData.total : '';
  const unitId = lineData ? lineData.unit_id : '';
  return `<div class="line-row" data-item-id="${selectedItemId}">
    <div class="form-group" style="grid-column:1/-1"><select class="select item-select"><option value="">اختر مادة</option></select></div>
    <div class="form-group"><select class="select unit-select" style="${selectedItemId ? '' : 'display:none;'}"></select></div>
    <div class="form-group"><input type="number" step="any" class="input qty-input" placeholder="الكمية" value="${qty}"></div>
    <div class="form-group"><input type="number" step="0.01" class="input price-input" placeholder="السعر" value="${price}"></div>
    <div class="form-group"><input type="number" step="0.01" class="input total-input" placeholder="الإجمالي" readonly value="${total}"></div>
    <button class="line-remove" title="حذف البند">${ICONS.trash}</button>
  </div>`;
}

export async function computeInventoryAfterPurchase(itemId, qtyBase, unitCost) {
  const items = await getAll('items');
  const item = items.find(i => i.id == itemId);
  if (!item) return;
  const oldQty = parseFloat(item.quantity) || 0;
  const oldAvg = parseFloat(item.average_cost) || 0;
  const newQty = oldQty + qtyBase;
  const newAvg = (oldQty * oldAvg + qtyBase * unitCost) / newQty;
  item.quantity = newQty;
  item.average_cost = newAvg;
  await save('items', item);
  await invalidate('items');
}

export async function computeInventoryAfterSale(itemId, qtyBase) {
  const items = await getAll('items');
  const item = items.find(i => i.id == itemId);
  if (!item) return;
  const oldQty = parseFloat(item.quantity) || 0;
  const newQty = Math.max(0, oldQty - qtyBase);
  item.quantity = newQty;
  // لا نغير متوسط التكلفة عند البيع (يبقى كما هو للمخزون المتبقي)
  await save('items', item);
  await invalidate('items');
}

// دوال عكس تأثير الفواتير (عند الحذف)
export async function reverseInventoryAfterPurchase(itemId, qtyBase, unitCost) {
  const items = await getAll('items');
  const item = items.find(i => i.id == itemId);
  if (!item) return;
  const oldQty = parseFloat(item.quantity) || 0;
  const oldAvg = parseFloat(item.average_cost) || 0;
  // حذف عملية شراء: ننقص الكمية ونعيد حساب متوسط التكلفة
  const newQty = Math.max(0, oldQty - qtyBase);
  if (newQty === 0) {
    item.quantity = 0;
    item.average_cost = 0;
  } else {
    // نحتاج إلى معرفة متوسط التكلفة قبل عملية الشراء هذه.
    // في النظام الفعلي، يصعب استرجاعه، لذلك سنستخدم طريقة تقريبية:
    // نعكس المعادلة: newAvg = (oldQty*oldAvg - qtyBase*unitCost) / newQty
    const newAvg = (oldQty * oldAvg - qtyBase * unitCost) / newQty;
    item.average_cost = newAvg > 0 ? newAvg : 0;
    item.quantity = newQty;
  }
  await save('items', item);
  await invalidate('items');
}

export async function reverseInventoryAfterSale(itemId, qtyBase) {
  const items = await getAll('items');
  const item = items.find(i => i.id == itemId);
  if (!item) return;
  const oldQty = parseFloat(item.quantity) || 0;
  const newQty = oldQty + qtyBase; // إعادة الكمية المباعة
  item.quantity = newQty;
  // لا نغير متوسط التكلفة (يبقى كما هو لأنه كان صحيحاً)
  await save('items', item);
  await invalidate('items');
}

export async function updateCustomerBalance(customerId, change) {
  const customers = await getAll('customers');
  const cust = customers.find(c => c.id == customerId);
  if (cust) {
    cust.balance = (cust.balance || 0) + change;
    await save('customers', cust);
    await invalidate('customers');
  }
}

export async function updateSupplierBalance(supplierId, change) {
  const suppliers = await getAll('suppliers');
  const supp = suppliers.find(s => s.id == supplierId);
  if (supp) {
    supp.balance = (supp.balance || 0) + change;
    await save('suppliers', supp);
    await invalidate('suppliers');
  }
}
