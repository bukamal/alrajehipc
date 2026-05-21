// js/sections.js - إدارة العملاء، الموردين، التصنيفات (بدون وحدات)
import { formatNumber, ICONS, animateEntry } from './core.js';
import { getAll, save, del, getByIndex, invalidate } from './store.js';
import { showToast, openModal, confirmDialog, showFormModal } from './modal.js';

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
        prepareAdd: v => ({ name: v.name, phone: v.phone || null, address: v.address || null, balance: 0 }),
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
          { id: 'name', label: 'اسم المورد', placeholder: 'اسم المورد' },
          { id: 'phone', label: 'رقم الجوال', placeholder: 'رقم الهاتف' },
          { id: 'contact_person', label: 'جهة الاتصال', placeholder: 'اسم جهة الاتصال' }
        ],
        editFields: [
          { id: 'name', label: 'اسم المورد' },
          { id: 'phone', label: 'رقم الجوال' },
          { id: 'contact_person', label: 'جهة الاتصال' }
        ],
        prepareAdd: v => ({ name: v.name, phone: v.phone || null, contact_person: v.contact_person || null, balance: 0 }),
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
        prepareAdd: v => ({ name: v.name }),
        prepareEdit: (id, v) => ({ id, name: v.name })
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
      return `<span style="color:var(--text-muted);font-size:13px;background:var(--bg);padding:3px 10px;border-radius:8px;">${f.prefix || ''}${val}</span>`;
    })
    .filter(Boolean)
    .join(' ');
  return `
    <div class="card card-hover" data-id="${item[opts.idField]}" data-type="${opts.apiBase}" style="margin-bottom:14px; cursor:pointer;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:14px;">
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
    let data = await getAll(options.cacheKey);
    let html = `<div class="card">
      <div class="card-header">
        <div><h3 class="card-title">${options.titlePlural || options.title}</h3></div>
        <button class="btn btn-primary btn-sm add-btn" data-type="${options.apiBase}">${ICONS.plus} إضافة</button>
      </div>
    </div>`;
    if (!data || !data.length) {
      html += `<div class="empty-state"><h3>لا يوجد ${options.titlePlural || options.title}</h3><p>ابدأ بإضافة أول سجل</p></div>`;
    } else {
      data.forEach(item => { html += buildGenericItemHtml(item, options); });
    }
    document.getElementById('tab-content').innerHTML = html;
    animateEntry('.card', 60);
    document.querySelectorAll('.card-hover').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.edit-btn') || e.target.closest('.delete-btn')) return;
        const id = card.dataset.id;
        const type = card.dataset.type;
        showItemDetail(id, type, options);
      });
    });
  } catch (err) { showToast(err.message, 'error'); }
}

async function showItemDetail(id, apiBase, options) {
  const items = await getAll(options.cacheKey);
  const item = items.find(i => i.id == id);
  if (!item) return;
  let details = `<div><strong>الاسم:</strong> ${item.name}</div>`;
  if (item.phone) details += `<div><strong>الهاتف:</strong> ${item.phone}</div>`;
  if (item.address) details += `<div><strong>العنوان:</strong> ${item.address}</div>`;
  if (item.contact_person) details += `<div><strong>جهة الاتصال:</strong> ${item.contact_person}</div>`;
  if (item.balance !== undefined) details += `<div><strong>الرصيد الحالي:</strong> ${formatNumber(item.balance)}</div>`;
  const modal = openModal({
    title: `تفاصيل ${options.title}`,
    bodyHTML: details,
    footerHTML: `<button class="btn btn-secondary" id="detail-close">إغلاق</button><button class="btn btn-primary" id="detail-edit">تعديل</button>`
  });
  modal.element.querySelector('#detail-close').onclick = () => modal.close();
  modal.element.querySelector('#detail-edit').onclick = () => {
    modal.close();
    showEditForm(id, options);
  };
}

async function showEditForm(id, options) {
  const items = await getAll(options.cacheKey);
  const item = items.find(i => i.id == id);
  if (!item) return;
  const initial = {};
  options.editFields.forEach(f => { initial[f.id] = item[f.id] || ''; });
  showFormModal({
    title: `تعديل ${options.title}`,
    fields: options.editFields,
    initialValues: initial,
    onSave: async (values) => {
      const updated = { ...item, ...values };
      await save(options.cacheKey, updated);
      await invalidate(options.cacheKey);
      return updated;
    },
    onSuccess: () => loadGenericSection(options)
  });
}

// مراقبة الأحداث العامة للأزرار (add, edit, delete)
document.addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  
  // زر إضافة جديد
  if (t.classList.contains('add-btn')) {
    e.preventDefault();
    const opts = getSectionOptions(t.dataset.type);
    if (!opts) return;
    
    showFormModal({
      title: `إضافة ${opts.title} جديد`,
      fields: opts.addFields,
      onSave: async (values) => {
        // التحقق من وجود نفس الاسم
        const existing = await getAll(opts.cacheKey);
        if (existing.some(x => x.name?.toLowerCase() === values.name?.trim().toLowerCase())) {
          throw new Error(`يوجد ${opts.title} بنفس الاسم`);
        }
        const newItem = opts.prepareAdd(values);
        await save(opts.cacheKey, newItem);
        await invalidate(opts.cacheKey);
        return newItem;
      },
      onSuccess: () => {
        // إعادة تحميل القسم بعد الحفظ الناجح
        loadGenericSection(opts);
      }
    });
  }
  
  // زر تعديل
  else if (t.classList.contains('edit-btn')) {
    e.stopPropagation();
    const opts = getSectionOptions(t.dataset.type);
    if (!opts) return;
    const id = t.dataset.id;
    showEditForm(id, opts);
  }
  
  // زر حذف
  else if (t.classList.contains('delete-btn')) {
    e.stopPropagation();
    const opts = getSectionOptions(t.dataset.type);
    if (!opts) return;
    const id = t.dataset.id;
    const items = await getAll(opts.cacheKey);
    const found = items.find(x => x.id == id);
    if (!await confirmDialog(`هل أنت متأكد من حذف ${opts.title} <strong>${found?.name || ''}</strong>؟`)) return;
    
    // التحقق من القيود
    if (opts.cacheKey === 'customers') {
      const invoices = await getByIndex('invoices', 'customer_id', id);
      if (invoices.length) { showToast('لا يمكن حذف العميل لارتباطه بفواتير', 'error'); return; }
      const payments = await getByIndex('payments', 'customer_id', id);
      if (payments.length) { showToast('لا يمكن حذف العميل لارتباطه بدفعات', 'error'); return; }
    } else if (opts.cacheKey === 'suppliers') {
      const invoices = await getByIndex('invoices', 'supplier_id', id);
      if (invoices.length) { showToast('لا يمكن حذف المورد لارتباطه بفواتير', 'error'); return; }
      const payments = await getByIndex('payments', 'supplier_id', id);
      if (payments.length) { showToast('لا يمكن حذف المورد لارتباطه بدفعات', 'error'); return; }
    } else if (opts.cacheKey === 'categories') {
      const items = await getByIndex('items', 'category_id', id);
      if (items.length) { showToast('لا يمكن حذف التصنيف لاستخدامه في مواد', 'error'); return; }
    }
    
    await del(opts.cacheKey, id);
    await invalidate(opts.cacheKey);
    showToast('تم الحذف بنجاح', 'success');
    loadGenericSection(opts);
  }
});
