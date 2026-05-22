// public/js/vouchers.js
import { apiCall, formatNumber, formatDate, ICONS, animateEntry } from './core.js';
import { showToast, confirmDialog, openModal } from './modal.js';
import { invalidate, subscribe, get as storeGet } from './store.js';
import { currentTab } from './navigation.js';

export async function loadVouchers() {
  try {
    const vouchers = await apiCall('/payments?voucher=1', 'GET');
    
    let html = `<div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">السندات</h3>
          <span class="card-subtitle">سندات القبض والدفع والمصاريف</span>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-add-voucher">${ICONS.plus} إضافة سند</button>
      </div>
      <div class="filter-bar" style="margin-bottom:14px;">
        <button class="filter-pill active" data-filter="all">الكل</button>
        <button class="filter-pill" data-filter="receipt">قبض</button>
        <button class="filter-pill" data-filter="payment">دفع</button>
        <button class="filter-pill" data-filter="expense">مصاريف</button>
      </div>
      <div style="display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap;">
        <div style="flex:1; min-width:200px;">
          <input type="text" class="input" id="voucher-search" placeholder="🔍 بحث في السندات...">
        </div>
        <div style="width:160px;">
          <input type="date" class="input" id="voucher-date-from" placeholder="من تاريخ">
        </div>
        <div style="width:160px;">
          <input type="date" class="input" id="voucher-date-to" placeholder="إلى تاريخ">
        </div>
        <button class="btn btn-secondary btn-sm" id="voucher-filter-clear" style="width:auto;">مسح الفلاتر</button>
      </div>
      <div id="vouchers-summary" style="margin-bottom:20px;"></div>
    </div>
    <div id="vouchers-list"></div>`;

    document.getElementById('tab-content').innerHTML = html;

    document.getElementById('btn-add-voucher')?.addEventListener('click', showAddVoucherModal);
    
    const renderFiltered = () => {
      const filter = document.querySelector('.filter-pill.active')?.dataset.filter || 'all';
      const searchTerm = (document.getElementById('voucher-search')?.value || '').trim().toLowerCase();
      const dateFrom = document.getElementById('voucher-date-from')?.value;
      const dateTo = document.getElementById('voucher-date-to')?.value;

      let filtered = vouchers;
      if (filter !== 'all') filtered = filtered.filter(v => v.type === filter);
      if (searchTerm) {
        filtered = filtered.filter(v =>
          (v.reference || '').toLowerCase().includes(searchTerm) ||
          (v.description || '').toLowerCase().includes(searchTerm) ||
          (v.customer?.name || '').toLowerCase().includes(searchTerm) ||
          (v.supplier?.name || '').toLowerCase().includes(searchTerm) ||
          String(v.amount).includes(searchTerm)
        );
      }
      if (dateFrom) filtered = filtered.filter(v => v.date >= dateFrom);
      if (dateTo) filtered = filtered.filter(v => v.date <= dateTo);

      let totalReceipt = 0, totalPayment = 0, totalExpense = 0;
      filtered.forEach(v => {
        if (v.type === 'receipt') totalReceipt += parseFloat(v.amount||0);
        else if (v.type === 'payment') totalPayment += parseFloat(v.amount||0);
        else totalExpense += parseFloat(v.amount||0);
      });
      document.getElementById('vouchers-summary').innerHTML = `
        <div style="display:flex; gap:20px; font-size:14px; flex-wrap:wrap; font-weight:600;">
          <span style="color:var(--success);">📥 إجمالي القبوض: <strong>${formatNumber(totalReceipt)}</strong></span>
          <span style="color:var(--danger);">📤 إجمالي الدفع: <strong>${formatNumber(totalPayment)}</strong></span>
          <span style="color:var(--warning);">💸 إجمالي المصاريف: <strong>${formatNumber(totalExpense)}</strong></span>
        </div>`;

      const container = document.getElementById('vouchers-list');
      if (!filtered.length) {
        container.innerHTML = emptyState('لا توجد سندات مطابقة', 'جرب تغيير معايير البحث');
        return;
      }

      let listHtml = '';
      filtered.forEach(v => {
        const typeLabel = v.type === 'receipt' ? 'قبض' : v.type === 'payment' ? 'دفع' : 'مصروف';
        const entityName = v.customer?.name || v.supplier?.name || '';
        const bgColor = v.type === 'receipt' ? 'var(--success)' : v.type === 'payment' ? 'var(--danger)' : 'var(--warning)';
        const sign = v.type === 'receipt' ? '+' : '-';
        
        listHtml += `
          <div class="card card-hover" style="border-right:4px solid ${bgColor}; margin-bottom:14px; cursor:pointer;" data-voucher-id="${v.id}">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div style="flex:1;">
                <div style="font-weight:900;font-size:22px;color:${bgColor};">
                  ${sign} ${formatNumber(v.amount)}
                </div>
                <div style="font-size:13px;color:var(--text-muted);margin-top:4px; font-weight:500;">
                  ${formatDate(v.date)} · ${typeLabel} ${entityName ? '· ' + entityName : ''}
                </div>
              </div>
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:6px; font-weight:500;">المرجع: ${v.reference || '-'}</div>
            ${v.invoice_id ? `<div style="font-size:12px;color:var(--primary);margin-top:6px; font-weight:600;">مرتبط بفاتورة رقم: ${v.invoice_id}</div>` : ''}
          </div>`;
      });
      container.innerHTML = listHtml;
      animateEntry('.card-hover[data-voucher-id]', 60);

      document.querySelectorAll('.card-hover[data-voucher-id]').forEach(card => {
        card.addEventListener('click', () => showVoucherDetail(card.dataset.voucherId));
      });
    };

    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        renderFiltered();
      });
    });
    document.getElementById('voucher-search')?.addEventListener('input', renderFiltered);
    document.getElementById('voucher-date-from')?.addEventListener('change', renderFiltered);
    document.getElementById('voucher-date-to')?.addEventListener('change', renderFiltered);
    document.getElementById('voucher-filter-clear')?.addEventListener('click', () => {
      document.getElementById('voucher-search').value = '';
      document.getElementById('voucher-date-from').value = '';
      document.getElementById('voucher-date-to').value = '';
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      document.querySelector('[data-filter="all"]').classList.add('active');
      renderFiltered();
    });

    renderFiltered();

    subscribe('vouchers', () => { if (currentTab === 'vouchers') loadVouchers(); });
    subscribe('invoices', () => { if (currentTab === 'vouchers') loadVouchers(); });
    subscribe('customers', () => { if (currentTab === 'vouchers') loadVouchers(); });
    subscribe('suppliers', () => { if (currentTab === 'vouchers') loadVouchers(); });

  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function showAddVoucherModal(initialData = {}) {
  let customers = [];
  let suppliers = [];
  try {
    const [custData, suppData] = await Promise.all([
      apiCall('/customers', 'GET'),
      apiCall('/suppliers', 'GET')
    ]);
    customers = custData;
    suppliers = suppData;
  } catch (e) {
    showToast('فشل جلب بيانات العملاء والموردين', 'error');
    return;
  }

  const body = `
    <div class="form-group">
      <label class="form-label">نوع السند</label>
      <select class="select" id="v-type">
        <option value="receipt" ${initialData.type === 'receipt' ? 'selected' : ''}>سند قبض</option>
        <option value="payment" ${initialData.type === 'payment' ? 'selected' : ''}>سند دفع</option>
        <option value="expense" ${initialData.type === 'expense' ? 'selected' : ''}>سند مصروف</option>
      </select>
    </div>
    
    <div class="form-group" id="v-cust-group" style="display:${initialData.type === 'receipt' ? 'block' : 'none'};">
      <label class="form-label">العميل</label>
      <select class="select" id="v-customer">
        <option value="">اختر عميل</option>
        ${customers.map(c => `<option value="${c.id}" ${initialData.customer_id == c.id ? 'selected' : ''}>${c.name} (الرصيد: ${formatNumber(c.balance)})</option>`).join('')}
      </select>
    </div>
    
    <div class="form-group" id="v-supp-group" style="display:${initialData.type === 'payment' ? 'block' : 'none'};">
      <label class="form-label">المورد</label>
      <select class="select" id="v-supplier">
        <option value="">اختر مورد</option>
        ${suppliers.map(s => `<option value="${s.id}" ${initialData.supplier_id == s.id ? 'selected' : ''}>${s.name} (الرصيد: ${formatNumber(s.balance)})</option>`).join('')}
      </select>
    </div>
    
    <div class="form-group">
      <label class="form-label">المبلغ</label>
      <input type="number" step="0.01" class="input" id="v-amount" placeholder="0.00" value="${initialData.amount || ''}">
    </div>
    
    <div class="form-group">
      <label class="form-label">التاريخ</label>
      <input type="date" class="input" id="v-date" value="${initialData.date || new Date().toISOString().split('T')[0]}">
    </div>
    
    <div class="form-group">
      <label class="form-label">الوصف</label>
      <textarea class="textarea" id="v-desc" placeholder="تفاصيل السند...">${initialData.description || ''}</textarea>
    </div>
    
    <div class="form-group">
      <label class="form-label">الرقم المرجعي (اختياري)</label>
      <input type="text" class="input" id="v-ref" placeholder="يُولّد تلقائياً إن ترك فارغاً" value="${initialData.reference || ''}">
    </div>
    
    <div class="form-group">
      <label class="form-label">ربط بفاتورة (اختياري)</label>
      <input type="number" class="input" id="v-invoice" placeholder="معرف الفاتورة" value="${initialData.invoice_id || ''}">
    </div>`;

  const modal = openModal({
    title: initialData.type ? 'تكرار السند' : 'إضافة سند جديد',
    bodyHTML: body,
    footerHTML: `<button class="btn btn-secondary" id="v-cancel">إلغاء</button><button class="btn btn-primary" id="v-save">${ICONS.check} حفظ</button>`
  });

  const typeSel = modal.element.querySelector('#v-type');
  const custGroup = modal.element.querySelector('#v-cust-group');
  const suppGroup = modal.element.querySelector('#v-supp-group');
  const amountInput = modal.element.querySelector('#v-amount');
  const customerSelect = modal.element.querySelector('#v-customer');
  const supplierSelect = modal.element.querySelector('#v-supplier');

  const warningDiv = document.createElement('div');
  warningDiv.id = 'voucher-warning';
  warningDiv.style.cssText = 'display:none; background: var(--warning-light); border: 1.5px solid var(--warning); border-radius: 12px; padding: 12px; margin-top: 12px; font-size: 13px; color: var(--warning); font-weight: 700; box-shadow: 0 4px 12px -4px var(--warning-glow);';
  modal.element.querySelector('.modal-body').appendChild(warningDiv);

  typeSel.addEventListener('change', () => {
    const val = typeSel.value;
    custGroup.style.display = val === 'receipt' ? 'block' : 'none';
    suppGroup.style.display = val === 'payment' ? 'block' : 'none';
    checkAmountAgainstBalance();
  });

  function checkAmountAgainstBalance() {
    const type = typeSel.value;
    const amount = parseFloat(amountInput.value) || 0;
    let balance = 0;
    let entityName = '';
    
    if (type === 'receipt' && customerSelect.value) {
      const cust = customers.find(c => c.id == customerSelect.value);
      if (cust) { balance = parseFloat(cust.balance) || 0; entityName = cust.name; }
    } else if (type === 'payment' && supplierSelect.value) {
      const supp = suppliers.find(s => s.id == supplierSelect.value);
      if (supp) { balance = parseFloat(supp.balance) || 0; entityName = supp.name; }
    } else {
      warningDiv.style.display = 'none';
      return;
    }

    if (amount > balance) {
      const diff = amount - balance;
      warningDiv.innerHTML = `⚠️ <strong>تنبيه:</strong> المبلغ المُدخل يتجاوز رصيد ${entityName} الحالي (${formatNumber(balance)}). سيتم تسجيل ${formatNumber(diff)} كدفعة مقدمة.`;
      warningDiv.style.display = 'block';
    } else {
      warningDiv.style.display = 'none';
    }
  }

  amountInput.addEventListener('input', checkAmountAgainstBalance);
  customerSelect.addEventListener('change', checkAmountAgainstBalance);
  supplierSelect.addEventListener('change', checkAmountAgainstBalance);
  typeSel.addEventListener('change', checkAmountAgainstBalance);

  modal.element.querySelector('#v-cancel').onclick = () => modal.close();

  modal.element.querySelector('#v-save').onclick = async () => {
    const type = typeSel.value;
    const amount = parseFloat(amountInput.value);
    if (!amount || amount <= 0) return showToast('المبلغ مطلوب', 'error');

    const custVal = type === 'receipt' ? customerSelect.value : null;
    const suppVal = type === 'payment' ? supplierSelect.value : null;
    const invoiceId = modal.element.querySelector('#v-invoice').value || null;

    if (invoiceId && custVal) {
      const invoices = await apiCall('/invoices', 'GET');
      const inv = invoices.find(i => i.id == invoiceId);
      if (inv && inv.customer_id != custVal) return showToast('الفاتورة المختارة لا تخص هذا العميل', 'error');
    }
    if (invoiceId && suppVal) {
      const invoices = await apiCall('/invoices', 'GET');
      const inv = invoices.find(i => i.id == invoiceId);
      if (inv && inv.supplier_id != suppVal) return showToast('الفاتورة المختارة لا تخص هذا المورد', 'error');
    }

    const payload = {
      type,
      amount,
      date: modal.element.querySelector('#v-date').value,
      description: modal.element.querySelector('#v-desc').value.trim(),
      reference: modal.element.querySelector('#v-ref').value.trim() || undefined,
      customer_id: custVal || null,
      supplier_id: suppVal || null,
      invoice_id: invoiceId,
      voucher: true
    };

    try {
      await apiCall('/payments?voucher=1', 'POST', payload);
      modal.close();
      showToast('تم حفظ السند بنجاح', 'success');
      loadVouchers();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };
}

function showVoucherDetail(voucherId) {
  const vouchers = storeGet('vouchers') || [];
  const v = vouchers.find(x => x.id == voucherId);
  if (!v) return showToast('السند غير موجود', 'error');

  const typeLabel = v.type === 'receipt' ? 'سند قبض' : v.type === 'payment' ? 'سند دفع' : 'سند مصروف';
  const entity = v.customer?.name || v.supplier?.name || '';
  const entityLabel = v.customer ? 'العميل' : 'المورد';
  const bgColor = v.type === 'receipt' ? 'var(--success)' : v.type === 'payment' ? 'var(--danger)' : 'var(--warning)';

  const modal = openModal({
    title: `${typeLabel} ${v.reference || ''}`,
    bodyHTML: `
      <div style="background:var(--bg);border-radius:16px;padding:20px;margin-bottom:20px; border: 1.5px solid var(--border);">
        <div style="text-align:center;margin-bottom:16px;">
          <div style="font-size:32px;font-weight:900;color:${bgColor};">${formatNumber(v.amount)}</div>
          <div style="font-size:14px;color:var(--text-secondary); font-weight:700;">${typeLabel}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <div><span style="color:var(--text-muted); font-weight:600;">التاريخ:</span> <strong>${formatDate(v.date)}</strong></div>
          <div><span style="color:var(--text-muted); font-weight:600;">المرجع:</span> <strong>${v.reference || '-'}</strong></div>
          ${entity ? `<div><span style="color:var(--text-muted); font-weight:600;">${entityLabel}:</span> <strong>${entity}</strong></div>` : ''}
          ${v.description ? `<div style="grid-column:1/-1;"><span style="color:var(--text-muted); font-weight:600;">الوصف:</span> <strong>${v.description}</strong></div>` : ''}
          ${v.invoice_id ? `<div><span style="color:var(--text-muted); font-weight:600;">الفاتورة:</span> <strong>#${v.invoice_id}</strong></div>` : ''}
        </div>
      </div>
    `,
    footerHTML: `
      <button class="btn btn-secondary" id="vdetail-duplicate">📋 تكرار</button>
      <button class="btn btn-danger" id="vdetail-delete">${ICONS.trash} حذف</button>
      <button class="btn btn-primary" id="vdetail-print">${ICONS.print} طباعة</button>
    `
  });

  modal.element.querySelector('#vdetail-duplicate').onclick = () => {
    modal.close();
    setTimeout(() => duplicateVoucher(voucherId), 250);
  };
  modal.element.querySelector('#vdetail-delete').onclick = () => {
    modal.close();
    setTimeout(() => deleteVoucher(voucherId), 250);
  };
  modal.element.querySelector('#vdetail-print').onclick = () => {
    modal.close();
    setTimeout(() => printVoucher(voucherId), 250);
  };
}

async function duplicateVoucher(voucherId) {
  const vouchers = storeGet('vouchers') || [];
  const v = vouchers.find(x => x.id == voucherId);
  if (!v) return showToast('السند غير موجود', 'error');

  showAddVoucherModal({
    type: v.type,
    amount: v.amount,
    description: v.description,
    customer_id: v.customer_id,
    supplier_id: v.supplier_id,
    invoice_id: v.invoice_id
  });
}

async function deleteVoucher(id) {
  if (!await confirmDialog('هل أنت متأكد من حذف هذا السند؟ سيتم عكس أي تأثير على الأرصدة.')) return;
  try {
    await apiCall(`/payments?voucher=1&id=${id}`, 'DELETE');
    invalidate('invoices');
    invalidate('customers');
    invalidate('suppliers');
    showToast('تم الحذف بنجاح', 'success');
    loadVouchers();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function printVoucher(voucherId) {
  const vouchers = storeGet('vouchers') || [];
  const v = vouchers.find(x => x.id == voucherId);
  if (!v) return showToast('السند غير موجود', 'error');
  
  const typeLabel = v.type === 'receipt' ? 'سند قبض' : v.type === 'payment' ? 'سند دفع' : 'سند مصروف';
  const entity = v.customer?.name || v.supplier?.name || '';
  const entityLabel = v.customer ? 'العميل' : 'المورد';
  const bgColor = v.type === 'receipt' ? '#059669' : v.type === 'payment' ? '#dc2626' : '#d97706';

  const htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>${typeLabel} - ${v.reference || ''}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 80mm; font-family: 'Segoe UI', system-ui, sans-serif; font-size: 12px; line-height: 1.4; padding: 4mm; color: #000; background: #fff; }
  .center { text-align: center; }
  .bold { font-weight: 900; }
  .shop { font-size: 20px; margin-bottom: 2px; color: #2563eb; }
  .type { font-size: 16px; color: #555; margin: 8px 0; font-weight: 700; }
  .line { border-top: 2px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; margin: 4px 0; }
  .label { color: #555; font-size: 11px; }
  .value { font-weight: 700; font-size: 12px; }
  .amount { font-size: 22px; font-weight: 900; color: ${bgColor}; text-align: center; margin: 12px 0; }
  .footer { text-align: center; font-size: 10px; color: #666; margin-top: 12px; padding-top: 8px; border-top: 1px dashed #999; }
</style>
</head>
<body>
<div class="center">
  <div class="shop bold">الراجحي للمحاسبة</div>
  <div style="font-size:9px; color:#888;">ALRAJEHI ACCOUNTING</div>
  <div class="type">${typeLabel}</div>
  <div style="font-size:12px; font-weight:700;">${v.reference || ''}</div>
</div>
<div class="line"></div>
<div class="row"><span class="label">التاريخ:</span><span class="value">${formatDate(v.date)}</span></div>
${entity ? `<div class="row"><span class="label">${entityLabel}:</span><span class="value">${entity}</span></div>` : ''}
${v.description ? `<div class="row"><span class="label">الوصف:</span><span class="value">${v.description}</span></div>` : ''}
${v.invoice_id ? `<div class="row"><span class="label">الفاتورة:</span><span class="value">#${v.invoice_id}</span></div>` : ''}
<div class="line"></div>
<div class="amount">${formatNumber(v.amount)}</div>
<div class="footer">
  <div>شكراً لتعاملكم / Thank you</div>
  <div style="margin-top:4px; font-size:9px;">الراجحي للمحاسبة · @bukamal1991</div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>
</body>
</html>`;

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
  } else {
    showToast('⚠️ تعذر فتح نافذة الطباعة. جرب السماح بالنوافذ المنبثقة.', 'warning');
  }
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

