// public/js/sections.js
import { apiCall, formatNumber, ICONS, animateEntry } from './core.js';
import { get as storeGet, set as storeSet } from './store.js';
import { showToast, openModal, confirmDialog, showFormModal } from './modal.js';
import { currentTab } from './navigation.js';
import { subscribe } from './store.js';

export function getSectionOptions(key) {
  switch (key) {
    case '/customers':
      return {
        cacheKey: 'customers',
        title: 'عميل',
        titlePlural: 'العملاء',
        apiBase: '/customers',
        idField: 'id',
        nameField: 'name',
        extraFields: [
          { key: 'balance', prefix: 'الرصيد: ' },
          { key: 'phone', prefix: '📞 ' }
        ],
        addFields: [
          { id: 'name', label: 'الاسم', placeholder: 'اسم العميل' },
          { id: 'phone', label: 'الهاتف', placeholder: 'رقم الهاتف' },
          { id: 'address', label: 'العنوان', placeholder: 'العنوان' }
        ],
        editFields: [
          { id: 'name', label: 'الاسم' },
          { id: 'phone', label: 'الهاتف' },
          { id: 'address', label: 'العنوان' }
        ],
        prepareAdd: v => ({ name: v.name, phone: v.phone || null, address: v.address || null }),
        prepareEdit: (id, v) => ({ id, ...v })
      };
    case '/suppliers':
      return {
        cacheKey: 'suppliers',
        title: 'مورد',
        titlePlural: 'الموردين',
        apiBase: '/suppliers',
        idField: 'id',
        nameField: 'name',
        extraFields: [
          { key: 'balance', prefix: 'الرصيد: ' },
          { key: 'phone', prefix: '📞 ' }
        ],
        addFields: [
          { id: 'name', label: 'الاسم', placeholder: 'اسم المورد' },
          { id: 'phone', label: 'الهاتف', placeholder: 'رقم الهاتف' },
          { id: 'address', label: 'العنوان', placeholder: 'العنوان' }
        ],
        editFields: [
          { id: 'name', label: 'الاسم' },
          { id: 'phone', label: 'الهاتف' },
          { id: 'address', label: 'العنوان' }
        ],
        prepareAdd: v => ({ name: v.name, phone: v.phone || null, address: v.address || null }),
        prepareEdit: (id, v) => ({ id, ...v })
      };
    case '/definitions?type=category':
      return {
        cacheKey: 'categories',
        title: 'تصنيف',
        titlePlural: 'التصنيفات',
        apiBase: '/definitions?type=category',
        idField: 'id',
        nameField: 'name',
        extraFields: [],
        addFields: [{ id: 'name', label: 'اسم التصنيف', placeholder: 'اسم التصنيف' }],
        editFields: [{ id: 'name', label: 'اسم التصنيف' }],
        prepareAdd: v => ({ type: 'category', name: v.name }),
        prepareEdit: (id, v) => ({ type: 'category', id, name: v.name })
      };
    default:
      return null;
  }
}

export function buildGenericItemHtml(item, opts) {
  const info = opts.extraFields
    .map(f => {
      const val = item[f.key];
      if (val === undefined || val === null) return '';
      return `<span style="color:var(--text-muted);font-size:13px;background:var(--bg);padding:3px 10px;border-radius:8px; font-weight:600;">${f.prefix || ''}${val}</span>`;
    })
    .filter(Boolean)
    .join(' ');

  return `
    <div class="card card-hover" style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;">
        <div style="min-width:0;">
          <div style="font-weight:900;margin-bottom:8px;font-size:16px;">${item[opts.nameField]}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">${info}</div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0;">
          <button class="btn btn-secondary btn-sm edit-btn" data-id="${item[opts.idField]}" data-type="${opts.apiBase}">${ICONS.edit}</button>
          <button class="btn btn-danger btn-sm delete-btn" data-id="${item[opts.idField]}" data-type="${opts.apiBase}">${ICONS.trash}</button>
        </div>
      </div>
    </div>`;
}

export async function loadGenericSection(options) {
  try {
    const data = await apiCall(options.apiBase, 'GET');

    let html = `<div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">${options.titlePlural || options.title}</h3>
        </div>
        <button class="btn btn-primary btn-sm add-btn" data-type="${options.apiBase}">${ICONS.plus} إضافة</button>
      </div>
    </div>`;

    if (!data || !data.length) {
      html += emptyState(`لا يوجد ${options.titlePlural || options.title}`, 'ابدأ بإضافة أول سجل');
    } else {
      data.forEach(item => {
        html += buildGenericItemHtml(item, options);
      });
    }

    document.getElementById('tab-content').innerHTML = html;
    animateEntry('.card', 60);

    if (options.cacheKey) {
      subscribe(options.cacheKey, () => {
        const tabMap = { customers: 'customers', suppliers: 'suppliers', categories: 'categories' };
        if (currentTab === tabMap[options.cacheKey]) {
          loadGenericSection(options);
        }
      });
    }
  } catch (err) { showToast(err.message, 'error'); }
}

export async function loadUnitsSection() {
  try {
    await Promise.all([
      apiCall('/definitions?type=unit', 'GET'),
      apiCall('/items', 'GET')
    ]);
    
    const units = storeGet('units') || [];
    const items = storeGet('items') || [];

    let html = `<div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">وحدات القياس</h3>
          <span class="card-subtitle">إدارة وحدات القياس المستخدمة في المواد</span>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-add-unit">${ICONS.plus} إضافة وحدة</button>
      </div>
    </div>`;

    if (!units.length) {
      html += emptyState('لا توجد وحدات مسجلة', 'أضف وحدات القياس المستخدمة في عملك');
    } else {
      html += '<div class="table-wrap"><table class="table"><thead><tr><th>الوحدة</th><th>الاختصار</th><th>الإجراءات</th></tr></thead><tbody>';
      units.forEach(unit => {
        html += `<tr>
          <td style="font-weight:800;">${unit.name}</td>
          <td><span style="background:var(--primary-light);color:var(--primary);padding:3px 12px;border-radius:8px;font-size:12px; font-weight:700;">${unit.abbreviation || '-'}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm edit-unit-btn" data-id="${unit.id}">${ICONS.edit}</button>
            <button class="btn btn-danger btn-sm delete-unit-btn" data-id="${unit.id}">${ICONS.trash}</button>
          </td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    }

    document.getElementById('tab-content').innerHTML = html;

    document.getElementById('btn-add-unit')?.addEventListener('click', showAddUnitModal);
    document.querySelectorAll('.edit-unit-btn').forEach(btn => {
      btn.addEventListener('click', e => showEditUnitModal(e.target.closest('button').dataset.id));
    });
    document.querySelectorAll('.delete-unit-btn').forEach(btn => {
      btn.addEventListener('click', e => deleteUnit(e.target.closest('button').dataset.id));
    });

  } catch (err) { showToast(err.message, 'error'); }
}

export function showAddUnitModal() {
  showFormModal({
    title: 'إضافة وحدة قياس جديدة',
    fields: [
      { id: 'name', label: 'اسم الوحدة', placeholder: 'مثال: قطعة، كيلو، لتر' },
      { id: 'abbreviation', label: 'الاختصار', placeholder: 'مثال: pc, kg, L' }
    ],
    onSave: async (values) => {
      if (!values.name?.trim()) throw new Error('اسم الوحدة مطلوب');
      const units = storeGet('units') || [];
      if (units.some(u => u.name.toLowerCase() === values.name.trim().toLowerCase())) {
        throw new Error('توجد وحدة بنفس الاسم');
      }
      return apiCall('/definitions?type=unit', 'POST', {
        type: 'unit',
        name: values.name.trim(),
        abbreviation: values.abbreviation || null
      });
    },
    onSuccess: () => loadUnitsSection()
  });
}

export function showEditUnitModal(unitId) {
  const units = storeGet('units') || [];
  const unit = units.find(u => u.id == unitId);
  if (!unit) return;

  showFormModal({
    title: 'تعديل وحدة القياس',
    fields: [
      { id: 'name', label: 'اسم الوحدة' },
      { id: 'abbreviation', label: 'الاختصار' }
    ],
    initialValues: { name: unit.name, abbreviation: unit.abbreviation || '' },
    onSave: async (values) => {
      if (!values.name?.trim()) throw new Error('اسم الوحدة مطلوب');
      return apiCall('/definitions?type=unit', 'PUT', {
        type: 'unit',
        id: unitId,
        name: values.name.trim(),
        abbreviation: values.abbreviation || null
      });
    },
    onSuccess: () => loadUnitsSection()
  });
}

export async function deleteUnit(unitId) {
  const units = storeGet('units') || [];
  const items = storeGet('items') || [];
  const unit = units.find(u => u.id == unitId);
  if (!unit) return;

  const usedInItems = [];
  items.forEach(item => {
    if (item.base_unit_id == unitId) usedInItems.push(item.name);
    else if (item.item_units && Array.isArray(item.item_units)) {
      item.item_units.forEach(iu => { if (iu.unit_id == unitId) usedInItems.push(item.name); });
    }
  });

  if (usedInItems.length > 0) {
    const uniqueItems = [...new Set(usedInItems)].slice(0, 3);
    const more = usedInItems.length > 3 ? ` و${usedInItems.length - 3} أخرى` : '';
    showToast(`لا يمكن حذف "${unit.name}" لأنها مستخدمة في: ${uniqueItems.join('، ')}${more}`, 'error');
    return;
  }

  if (!await confirmDialog(`هل أنت متأكد من حذف الوحدة <strong>${unit.name}</strong>؟`)) return;

  try {
    await apiCall(`/definitions?type=unit&id=${unitId}`, 'DELETE');
    showToast('تم الحذف بنجاح', 'success');
    loadUnitsSection();
  } catch (e) { showToast(e.message, 'error'); }
}

function emptyState(title, subtitle) {
  return `<div class="empty-state">
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
    <h3>${title}</h3>
    <p>${subtitle}</p>
  </div>`;
}

document.addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;

  if (t.classList.contains('add-btn')) {
    const opts = getSectionOptions(t.dataset.type);
    if (!opts) return;

    showFormModal({
      title: `إضافة ${opts.title} جديد`,
      fields: opts.addFields,
      onSave: async (values) => {
        const items = storeGet(opts.cacheKey) || [];
        if (values.name?.trim() && items.some(x => x.name?.toLowerCase() === values.name.trim().toLowerCase())) {
          throw new Error(`يوجد ${opts.title} بنفس الاسم`);
        }
        return apiCall(opts.apiBase, 'POST', opts.prepareAdd(values));
      },
      onSuccess: () => loadGenericSection(opts)
    });

  } else if (t.classList.contains('edit-btn')) {
    const opts = getSectionOptions(t.dataset.type);
    if (!opts) return;
    const id = t.dataset.id;
    const items = storeGet(opts.cacheKey) || [];
    const item = items.find(x => x[opts.idField] == id);
    if (!item) return;

    const init = {};
    opts.editFields.forEach(f => (init[f.id] = item[f.id] ?? ''));

    showFormModal({
      title: `تعديل ${opts.title}`,
      fields: opts.editFields,
      initialValues: init,
      onSave: v => apiCall(opts.apiBase, 'PUT', opts.prepareEdit(id, v)),
      onSuccess: () => loadGenericSection(opts)
    });

  } else if (t.classList.contains('delete-btn')) {
    const opts = getSectionOptions(t.dataset.type);
    if (!opts) return;
    const id = t.dataset.id;
    const items = storeGet(opts.cacheKey) || [];
    const found = items.find(x => x[opts.idField] == id);

    if (!await confirmDialog(`هل أنت متأكد من حذف ${opts.title} <strong>${found?.[opts.nameField] || ''}</strong>؟`)) return;

    try {
      const delUrl = opts.apiBase.includes('?') ? `${opts.apiBase}&id=${id}` : `${opts.apiBase}?id=${id}`;
      await apiCall(delUrl, 'DELETE');
      showToast('تم الحذف بنجاح', 'success');
      loadGenericSection(opts);
    } catch (err) { showToast(err.message, 'error'); }
  }
});


