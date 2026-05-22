// public/js/expenses.js
import { apiCall, formatNumber, formatDate, ICONS, animateEntry } from './core.js';
import { showToast, confirmDialog, showFormModal } from './modal.js';

function emptyState(title, subtitle) {
  return `<div class="empty-state">
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
    <h3>${title}</h3>
    <p>${subtitle}</p>
  </div>`;
}

export async function loadExpenses() {
  try {
    const expenses = await apiCall('/expenses', 'GET');
    let html = `<div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">المصاريف</h3>
          <span class="card-subtitle">تتبع المصاريف التشغيلية</span>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-add-expense">${ICONS.plus} إضافة</button>
      </div>
    </div>`;

    if (!expenses.length) {
      html += emptyState('لا توجد مصاريف مسجلة', 'سجل أول مصروف باستخدام الزر أعلاه');
    } else {
      expenses.forEach(ex => {
        html += `<div class="card" style="border-right:4px solid var(--danger); margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-weight:900;font-size:22px;color:var(--danger);">
                ${formatNumber(ex.amount)}
              </div>
              <div style="font-size:13px;color:var(--text-muted);margin-top:4px; font-weight:500;">
                ${formatDate(ex.expense_date)}
              </div>
            </div>
            <button class="btn btn-ghost btn-sm" data-delete-expense="${ex.id}">${ICONS.trash}</button>
          </div>
          ${ex.description ? `<div style="margin-top:12px;font-size:14px;color:var(--text-secondary); font-weight:500;">${ex.description}</div>` : ''}
        </div>`;
      });
    }

    document.getElementById('tab-content').innerHTML = html;
    animateEntry('.card', 60);

    document.getElementById('btn-add-expense')?.addEventListener('click', showAddExpenseModal);

    document.querySelectorAll('[data-delete-expense]').forEach(btn => {
      btn.addEventListener('click', () => deleteExpense(btn.dataset.deleteExpense));
    });

  } catch (err) { showToast(err.message, 'error'); }
}

function showAddExpenseModal() {
  showFormModal({
    title: 'إضافة مصروف جديد',
    fields: [
      { id: 'amount', label: 'المبلغ', type: 'number', placeholder: '0.00' },
      { id: 'expense_date', label: 'التاريخ', type: 'date' },
      { id: 'description', label: 'الوصف', type: 'textarea', placeholder: 'وصف المصروف...' }
    ],
    initialValues: { expense_date: new Date().toISOString().split('T')[0] },
    onSave: values => apiCall('/expenses', 'POST', {
      amount: parseFloat(values.amount),
      expense_date: values.expense_date,
      description: values.description
    }),
    onSuccess: () => loadExpenses()
  });
}

async function deleteExpense(id) {
  if (!await confirmDialog('هل أنت متأكد من حذف هذا المصروف؟')) return;
  try {
    await apiCall(`/expenses?id=${id}`, 'DELETE');
    showToast('تم الحذف بنجاح', 'success');
    loadExpenses();
  } catch (e) { showToast(e.message, 'error'); }
}

