// public/js/payments.js
// إدارة الدفعات: عرض، إضافة، حذف

import { apiCall, formatNumber, formatDate, ICONS } from './core.js';
import { get as storeGet } from './store.js';
import { showToast, confirmDialog, openModal } from './modal.js';

/**
 * دالة لعرض حالة فارغة عند عدم وجود بيانات
 */
function emptyState(title, subtitle) {
  return `<div class="empty-state">
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
    <h3>${title}</h3>
    <p>${subtitle}</p>
  </div>`;
}

/**
 * تحميل قائمة الدفعات وعرضها
 */
export async function loadPayments() {
  try {
    // جلب جميع البيانات المطلوبة في وقت واحد
    const [payments, invoices, customers, suppliers] = await Promise.all([
      apiCall('/payments', 'GET'),
      apiCall('/invoices', 'GET'),
      apiCall('/customers', 'GET'),
      apiCall('/suppliers', 'GET')
    ]);

    let html = `<div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">الدفعات</h3>
          <span class="card-subtitle">سجل المقبوضات والمدفوعات</span>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-add-pmt">${ICONS.plus} إضافة</button>
      </div>
    </div>`;

    if (!payments.length) {
      html += emptyState('لا توجد دفعات مسجلة', 'سجل أول دفعة باستخدام الزر أعلاه');
    } else {
      payments.forEach(p => {
        const isIn = !!p.customer_id;
        html += `
          <div class="card" style="border-right:3px solid ${isIn ? 'var(--success)' : 'var(--danger)'};">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-weight:900;font-size:20px;color:${isIn ? 'var(--success)' : 'var(--danger)'};">
                  ${isIn ? '+' : '-'} ${formatNumber(p.amount)}
                </div>
                <div style="font-size:13px;color:var(--text-muted);margin-top:2px;">
                  ${formatDate(p.payment_date)}
                </div>
              </div>
              <button class="btn btn-ghost btn-sm" data-delete-payment="${p.id}">${ICONS.trash}</button>
            </div>
            <div style="margin-top:10px;font-size:13px;color:var(--text-secondary);line-height:1.6;">
              ${p.customer?.name ? `<span style="color:var(--success);font-weight:700;">▲ عميل: ${p.customer.name}</span>` : ''}
              ${p.supplier?.name ? `<span style="color:var(--danger);font-weight:700;">▼ مورد: ${p.supplier.name}</span>` : ''}
              ${p.invoice ? `· فاتورة: ${p.invoice.type === 'sale' ? 'بيع' : 'شراء'} ${p.invoice.reference || ''}` : ''}
              ${p.notes ? `<div style="margin-top:4px;color:var(--text-muted);">${p.notes}</div>` : ''}
            </div>
          </div>`;
      });
    }

    document.getElementById('tab-content').innerHTML = html;

    document.getElementById('btn-add-pmt')?.addEventListener('click', () => showAddPaymentModal(customers, suppliers, invoices));

    document.querySelectorAll('[data-delete-payment]').forEach(btn => {
      btn.addEventListener('click', () => deletePayment(btn.dataset.deletePayment));
    });

  } catch (err) { showToast(err.message, 'error'); }
}

/**
 * عرض نافذة إضافة دفعة جديدة
 */
function showAddPaymentModal(customers, suppliers, invoices) {
  const body = `
    <div class="form-group">
      <label class="form-label">النوع</label>
      <select class="select" id="pmt-type">
        <option value="customer">مقبوضات من عميل</option>
        <option value="supplier">مدفوعات إلى مورد</option>
      </select>
    </div>
    <div class="form-group" id="pmt-cust-block">
      <label class="form-label">العميل</label>
      <select class="select" id="pmt-customer">
        <option value="">اختر عميل</option>
        ${customers.map(c => `<option value="${c.id}">${c.name} (${formatNumber(c.balance)})</option>`).join('')}
      </select>
    </div>
    <div class="form-group" id="pmt-supp-block" style="display:none">
      <label class="form-label">المورد</label>
      <select class="select" id="pmt-supplier">
        <option value="">اختر مورد</option>
        ${suppliers.map(s => `<option value="${s.id}">${s.name} (${formatNumber(s.balance)})</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">الفاتورة (اختياري)</label>
      <select class="select" id="pmt-invoice">
        <option value="">بدون فاتورة</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">المبلغ</label>
      <input type="number" step="0.01" class="input" id="pmt-amount" placeholder="0.00">
    </div>
    <div class="form-group">
      <label class="form-label">التاريخ</label>
      <input type="date" class="input" id="pmt-date" value="${new Date().toISOString().split('T')[0]}">
    </div>
    <div class="form-group">
      <label class="form-label">ملاحظات</label>
      <textarea class="textarea" id="pmt-notes" placeholder="وصف الدفعة..."></textarea>
    </div>`;

  const modal = openModal({
    title: 'تسجيل دفعة جديدة',
    bodyHTML: body,
    footerHTML: `<button class="btn btn-secondary" id="pmt-cancel">إلغاء</button><button class="btn btn-primary" id="pmt-save">${ICONS.check} حفظ</button>`
  });

  const tSel = modal.element.querySelector('#pmt-type');
  const cBlock = modal.element.querySelector('#pmt-cust-block');
  const sBlock = modal.element.querySelector('#pmt-supp-block');
  const invSel = modal.element.querySelector('#pmt-invoice');
  const cSel = modal.element.querySelector('#pmt-customer');
  const sSel = modal.element.querySelector('#pmt-supplier');

  const updateInv = (type, eId) => {
    const filt = invoices.filter(inv =>
      type === 'customer'
        ? inv.type === 'sale' && inv.customer_id == eId
        : inv.type === 'purchase' && inv.supplier_id == eId
    );
    invSel.innerHTML = '<option value="">بدون فاتورة</option>' + filt.map(inv =>
      `<option value="${inv.id}">${inv.type === 'sale' ? 'بيع' : 'شراء'} ${inv.reference || ''} (${formatNumber(inv.total)})</option>`
    ).join('');
  };

  tSel.addEventListener('change', () => {
    if (tSel.value === 'customer') {
      cBlock.style.display = 'block';
      sBlock.style.display = 'none';
      updateInv('customer', cSel.value);
    } else {
      cBlock.style.display = 'none';
      sBlock.style.display = 'block';
      updateInv('supplier', sSel.value);
    }
  });

  cSel.addEventListener('change', () => updateInv('customer', cSel.value));
  sSel.addEventListener('change', () => updateInv('supplier', sSel.value));

  modal.element.querySelector('#pmt-cancel').onclick = () => modal.close();

  modal.element.querySelector('#pmt-save').onclick = async () => {
    const type = tSel.value;
    const cust = type === 'customer' ? (cSel.value || null) : null;
    const supp = type === 'supplier' ? (sSel.value || null) : null;
    const amount = parseFloat(modal.element.querySelector('#pmt-amount').value);
    if (!amount || amount <= 0) return showToast('المبلغ مطلوب', 'error');
    if (!cust && !supp) return showToast('اختر عميلاً أو مورداً', 'error');

    try {
      await apiCall('/payments', 'POST', {
        invoice_id: invSel.value || null,
        customer_id: cust,
        supplier_id: supp,
        amount,
        payment_date: modal.element.querySelector('#pmt-date').value,
        notes: modal.element.querySelector('#pmt-notes').value.trim()
      });
      modal.close();
      showToast('تم حفظ الدفعة بنجاح', 'success');
      loadPayments();
    } catch (e) { showToast(e.message, 'error'); }
  };
}

/**
 * حذف دفعة بعد تأكيد المستخدم
 */
export async function deletePayment(id) {
  if (!await confirmDialog('هل أنت متأكد من حذف هذه الدفعة؟')) return;
  try {
    await apiCall(`/payments?id=${id}`, 'DELETE');
    showToast('تم الحذف بنجاح', 'success');
    loadPayments();
  } catch (e) { showToast(e.message, 'error'); }
}

