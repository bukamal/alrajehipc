// js/expenses.js — المصاريف (Offline)
import { apiCall, formatNumber, formatDate, ICONS, animateEntry, emptyState } from './utils.js';
import { showToast, confirmDialog, showFormModal } from './modal.js';

export async function loadExpenses() {
  try {
    const expenses = await apiCall('/expenses', 'GET');
    let html = `<div class="card"><div class="card-header"><div><h3 class="card-title">المصاريف</h3><span class="card-subtitle">تتبع المصاريف التشغيلية</span></div><button class="btn btn-primary btn-sm" id="btn-add-expense">${ICONS.plus} إضافة</button></div></div>`;
    if (!expenses.length) { html += emptyState('لا توجد مصاريف مسجلة', 'سجل أول مصروف باستخدام الزر أعلاه'); }
    else {
      expenses.forEach(ex => { html += `<div class="card" style="border-right:4px solid var(--danger); margin-bottom:14px;"><div style="display:flex; justify-content:space-between;"><div><div style="font-weight:900; font-size:22px; color:var(--danger);">${formatNumber(ex.amount)}</div><div style="font-size:13px;">${formatDate(ex.expense_date)}</div></div><button class="btn btn-ghost btn-sm" data-delete-expense="${ex.id}">${ICONS.trash}</button></div>${ex.notes ? `<div style="margin-top:12px;">${ex.notes}</div>` : ''}</div>`; });
    }
    document.getElementById('tab-content').innerHTML = html;
    animateEntry('.card', 60);
    document.getElementById('btn-add-expense')?.addEventListener('click', showAddExpenseModal);
    document.querySelectorAll('[data-delete-expense]').forEach(btn => { btn.addEventListener('click', () => deleteExpense(btn.dataset.deleteExpense)); });
  } catch (err) { showToast(err.message, 'error'); }
}

function showAddExpenseModal() {
  showFormModal({ title: 'إضافة مصروف جديد', fields: [{ id: 'amount', label: 'المبلغ', type: 'number' }, { id: 'expense_date', label: 'التاريخ', type: 'date' }, { id: 'description', label: 'الوصف', type: 'textarea' }], initialValues: { expense_date: new Date().toISOString().split('T')[0] }, onSave: values => apiCall('/expenses', 'POST', { amount: parseFloat(values.amount), expense_date: values.expense_date, notes: values.description }), onSuccess: () => loadExpenses() });
}

async function deleteExpense(id) {
  if (!await confirmDialog('هل أنت متأكد من حذف هذا المصروف؟')) return;
  try { await apiCall(`/expenses?id=${id}`, 'DELETE'); showToast('تم الحذف', 'success'); loadExpenses(); } catch (e) { showToast(e.message, 'error'); }
}
