// js/accounts.js - إدارة الحسابات المحاسبية (شجرة الحسابات)
import { getAll, save, del, invalidate } from './store.js';
import { showToast, showFormModal, confirmDialog } from './modal.js';
import { ICONS, animateEntry } from './core.js';

export async function loadAccounts() {
  const accounts = await getAll('accounts');
  let html = `<div class="card">
      <div class="card-header">
        <div><h3 class="card-title">الحسابات المحاسبية</h3><span class="card-subtitle">إدارة شجرة الحسابات</span></div>
        <button class="btn btn-primary btn-sm" id="btn-add-account">${ICONS.plus} إضافة حساب</button>
      </div>
    </div>`;
  if (!accounts.length) {
    html += `<div class="empty-state"><h3>لا توجد حسابات</h3><p>أضف حساباً جديداً للبدء</p></div>`;
  } else {
    html += `<div class="table-wrap"><table class="table"><thead><tr><th>اسم الحساب</th><th>النوع</th><th>الرصيد</th><th>الإجراءات</th></tr></thead><tbody>`;
    for (const acc of accounts) {
      const typeMap = { asset: 'أصل', liability: 'خصم', income: 'إيراد', expense: 'مصروف', equity: 'حقوق ملكية' };
      html += `<tr>
        <td style="font-weight:800;">${acc.name}</td>
        <td><span style="background:var(--primary-light);padding:3px 12px;border-radius:20px;">${typeMap[acc.type] || acc.type}</span></td>
        <td>${acc.balance || 0}</td>
        <td><button class="btn btn-secondary btn-sm edit-account" data-id="${acc.id}">${ICONS.edit}</button> <button class="btn btn-danger btn-sm delete-account" data-id="${acc.id}">${ICONS.trash}</button></td>
      </tr>`;
    }
    html += `</tbody></table></div>`;
  }
  document.getElementById('tab-content').innerHTML = html;
  animateEntry('.card, .table', 80);
  document.getElementById('btn-add-account')?.addEventListener('click', showAddAccountModal);
  document.querySelectorAll('.edit-account').forEach(btn => btn.addEventListener('click', () => showEditAccountModal(btn.dataset.id)));
  document.querySelectorAll('.delete-account').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.id;
    const accountsList = await getAll('accounts');
    const account = accountsList.find(a => a.id == id);
    if (!account) return;
    if (['الصندوق', 'المبيعات', 'المشتريات', 'المخزون', 'مصاريف عامة', 'رأس المال'].includes(account.name)) {
      showToast('لا يمكن حذف الحسابات الأساسية للنظام', 'error');
      return;
    }
    if (await confirmDialog(`حذف الحساب "${account.name}"؟`)) {
      await del('accounts', parseInt(id));
      await invalidate('accounts');
      showToast('تم الحذف', 'success');
      loadAccounts();
    }
  }));
}

async function showAddAccountModal() {
  showFormModal({
    title: 'إضافة حساب جديد',
    fields: [
      { id: 'name', label: 'اسم الحساب', placeholder: 'مثال: إيرادات خدمات' },
      { id: 'type', label: 'النوع', type: 'select', options: `<option value="asset">أصل (Asset)</option><option value="liability">خصم (Liability)</option><option value="income">إيراد (Income)</option><option value="expense">مصروف (Expense)</option><option value="equity">حقوق ملكية (Equity)</option>` }
    ],
    onSave: async (values) => {
      if (!values.name.trim()) throw new Error('اسم الحساب مطلوب');
      const existing = await getAll('accounts');
      if (existing.some(a => a.name.toLowerCase() === values.name.trim().toLowerCase())) throw new Error('حساب بنفس الاسم موجود');
      const newAccount = { name: values.name.trim(), type: values.type, balance: 0 };
      await save('accounts', newAccount);
      await invalidate('accounts');
      return newAccount;
    },
    onSuccess: () => loadAccounts()
  });
}

async function showEditAccountModal(id) {
  const accounts = await getAll('accounts');
  const account = accounts.find(a => a.id == id);
  if (!account) return;
  if (['الصندوق', 'المبيعات', 'المشتريات', 'المخزون', 'مصاريف عامة', 'رأس المال'].includes(account.name)) {
    showToast('لا يمكن تعديل الحسابات الأساسية للنظام', 'error');
    return;
  }
  showFormModal({
    title: 'تعديل الحساب',
    fields: [
      { id: 'name', label: 'اسم الحساب' },
      { id: 'type', label: 'النوع', type: 'select', options: `<option value="asset" ${account.type==='asset'?'selected':''}>أصل</option><option value="liability" ${account.type==='liability'?'selected':''}>خصم</option><option value="income" ${account.type==='income'?'selected':''}>إيراد</option><option value="expense" ${account.type==='expense'?'selected':''}>مصروف</option><option value="equity" ${account.type==='equity'?'selected':''}>حقوق ملكية</option>` }
    ],
    initialValues: { name: account.name, type: account.type },
    onSave: async (values) => {
      const updated = { ...account, name: values.name.trim(), type: values.type };
      await save('accounts', updated);
      await invalidate('accounts');
      return updated;
    },
    onSuccess: () => loadAccounts()
  });
}
