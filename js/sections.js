// js/sections.js — العملاء والموردين والتصنيفات
import { apiCall, formatNumber, ICONS, animateEntry, emptyState } from './utils.js';
import { get as storeGet } from './store.js';
import { showToast, confirmDialog, showFormModal } from './modal.js';
import { currentTab } from './navigation.js';
import { subscribe } from './store.js';

export function getSectionOptions(key) {
  switch (key) {
    case '/customers': return { cacheKey: 'customers', title: 'عميل', titlePlural: 'العملاء', apiBase: '/customers', idField: 'id', nameField: 'name', extraFields: [{ key: 'balance', prefix: 'الرصيد: ' }, { key: 'phone', prefix: '📞 ' }], addFields: [{ id: 'name', label: 'الاسم' }, { id: 'phone', label: 'الهاتف' }, { id: 'address', label: 'العنوان' }], prepareAdd: v => ({ name: v.name, phone: v.phone || null, address: v.address || null }), prepareEdit: (id, v) => ({ id, ...v }) };
    case '/suppliers': return { cacheKey: 'suppliers', title: 'مورد', titlePlural: 'الموردين', apiBase: '/suppliers', idField: 'id', nameField: 'name', extraFields: [{ key: 'balance', prefix: 'الرصيد: ' }, { key: 'phone', prefix: '📞 ' }], addFields: [{ id: 'name', label: 'الاسم' }, { id: 'phone', label: 'الهاتف' }, { id: 'address', label: 'العنوان' }], prepareAdd: v => ({ name: v.name, phone: v.phone || null, address: v.address || null }), prepareEdit: (id, v) => ({ id, ...v }) };
    case '/definitions?type=category': return { cacheKey: 'categories', title: 'تصنيف', titlePlural: 'التصنيفات', apiBase: '/definitions?type=category', idField: 'id', nameField: 'name', extraFields: [], addFields: [{ id: 'name', label: 'اسم التصنيف' }], prepareAdd: v => ({ type: 'category', name: v.name }), prepareEdit: (id, v) => ({ type: 'category', id, name: v.name }) };
    default: return null;
  }
}

export async function loadGenericSection(options) {
  try {
    const data = await apiCall(options.apiBase, 'GET');
    let html = `<div class="card"><div class="card-header"><div><h3 class="card-title">${options.titlePlural || options.title}</h3></div><button class="btn btn-primary btn-sm add-btn" data-type="${options.apiBase}">${ICONS.plus} إضافة</button></div></div>`;
    if (!data.length) html += emptyState(`لا يوجد ${options.titlePlural || options.title}`, 'ابدأ بإضافة أول سجل');
    else data.forEach(item => { html += `<div class="card" data-id="${item.id}"><div><strong>${item.name}</strong> ${options.extraFields.map(f => `<span>${f.prefix}${item[f.key]}</span>`).join(' ')}</div><button class="edit-btn" data-id="${item.id}">${ICONS.edit}</button><button class="delete-btn" data-id="${item.id}">${ICONS.trash}</button></div>`; });
    document.getElementById('tab-content').innerHTML = html;
    animateEntry('.card', 60);
    if (options.cacheKey) { subscribe(options.cacheKey, () => { const tabMap = { customers: 'customers', suppliers: 'suppliers', categories: 'categories' }; if (currentTab === tabMap[options.cacheKey]) loadGenericSection(options); }); }
  } catch (err) { showToast(err.message, 'error'); }
}

document.addEventListener('click', async (e) => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.classList.contains('add-btn')) { const opts = getSectionOptions(t.dataset.type); if (!opts) return; showFormModal({ title: `إضافة ${opts.title} جديد`, fields: opts.addFields, onSave: async (v) => { await apiCall(opts.apiBase, 'POST', opts.prepareAdd(v)); loadGenericSection(opts); } }); }
  else if (t.classList.contains('edit-btn')) { const opts = getSectionOptions(t.dataset.type); if (!opts) return; const id = t.dataset.id; const items = storeGet(opts.cacheKey) || []; const item = items.find(x => x[opts.idField] == id); if (!item) return; const init = {}; opts.addFields.forEach(f => init[f.id] = item[f.id] ?? ''); showFormModal({ title: `تعديل ${opts.title}`, fields: opts.addFields, initialValues: init, onSave: v => apiCall(opts.apiBase, 'PUT', opts.prepareEdit(id, v)), onSuccess: () => loadGenericSection(opts) }); }
  else if (t.classList.contains('delete-btn')) { const opts = getSectionOptions(t.dataset.type); if (!opts) return; const id = t.dataset.id; const items = storeGet(opts.cacheKey) || []; const found = items.find(x => x[opts.idField] == id); if (!await confirmDialog(`حذف ${opts.title} <strong>${found?.[opts.nameField] || ''}</strong>؟`)) return; const delUrl = opts.apiBase.includes('?') ? `${opts.apiBase}&id=${id}` : `${opts.apiBase}?id=${id}`; await apiCall(delUrl, 'DELETE'); loadGenericSection(opts); }
});
