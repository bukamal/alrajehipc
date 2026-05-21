// js/vouchers.js - السندات مع حقل بحث نصي للعميل/المورد وعكس الأرصدة
import { formatNumber, formatDate, ICONS, animateEntry } from './core.js';
import { getAll, save, del, getByIndex, invalidate } from './store.js';
import { showToast, confirmDialog, openModal } from './modal.js';

export async function loadVouchers() {
  try {
    let vouchers = await getAll('vouchers');
    const customers = await getAll('customers');
    const suppliers = await getAll('suppliers');
    const invoices = await getAll('invoices');
    vouchers = vouchers.map(v => ({
      ...v,
      customer: customers.find(c => c.id === v.customer_id),
      supplier: suppliers.find(s => s.id === v.supplier_id),
      invoice: invoices.find(i => i.id === v.invoice_id)
    }));
    let html = `<div class="card">
      <div class="card-header">
        <div><h3 class="card-title">السندات</h3><span class="card-subtitle">سندات القبض والدفع والمصاريف</span></div>
        <button class="btn btn-primary btn-sm" id="btn-add-voucher">${ICONS.plus} إضافة سند</button>
      </div>
      <div class="filter-bar">
        <button class="filter-pill active" data-filter="all">الكل</button>
        <button class="filter-pill" data-filter="receipt">قبض</button>
        <button class="filter-pill" data-filter="payment">دفع</button>
        <button class="filter-pill" data-filter="expense">مصاريف</button>
      </div>
      <div class="form-group"><input type="text" class="input" id="voucher-search" placeholder="🔍 بحث في السندات..."></div>
    </div>
    <div id="vouchers-list"></div>`;
    document.getElementById('tab-content').innerHTML = html;
    document.getElementById('btn-add-voucher').addEventListener('click', showAddVoucherModal);
    document.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        this.classList.add('active');
        renderVouchers(vouchers);
      });
    });
    document.getElementById('voucher-search').addEventListener('input', () => renderVouchers(vouchers));
    renderVouchers(vouchers);
  } catch(err) { showToast(err.message, 'error'); }
}

function renderVouchers(vouchers) {
  const filter = document.querySelector('.filter-pill.active')?.dataset.filter || 'all';
  const search = (document.getElementById('voucher-search')?.value || '').toLowerCase();
  let filtered = vouchers;
  if (filter !== 'all') filtered = filtered.filter(v => v.type === filter);
  if (search) filtered = filtered.filter(v => (v.reference || '').toLowerCase().includes(search) || (v.description || '').toLowerCase().includes(search) || (v.customer?.name || '').toLowerCase().includes(search) || (v.supplier?.name || '').toLowerCase().includes(search));
  const container = document.getElementById('vouchers-list');
  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state"><h3>لا توجد سندات</h3></div>`;
    return;
  }
  let html = '';
  for (const v of filtered) {
    const typeLabel = v.type === 'receipt' ? 'قبض' : v.type === 'payment' ? 'دفع' : 'مصروف';
    const entity = v.customer?.name || v.supplier?.name || '';
    const bgColor = v.type === 'receipt' ? 'var(--success)' : v.type === 'payment' ? 'var(--danger)' : 'var(--warning)';
    html += `<div class="card card-hover voucher-card" data-id="${v.id}" style="border-right:4px solid ${bgColor}; margin-bottom:14px; cursor:pointer;">
      <div style="display:flex; justify-content:space-between;">
        <div><span style="font-weight:900;">${typeLabel}</span> ${v.reference ? `· ${v.reference}` : ''}<br><small>${formatDate(v.date)} ${entity ? '· ' + entity : ''}</small></div>
        <div style="font-size:20px; font-weight:900; color:${bgColor};">${v.type === 'receipt' ? '+' : '-'} ${formatNumber(v.amount)}</div>
      </div>
      ${v.description ? `<div style="margin-top:8px; font-size:13px;">${v.description}</div>` : ''}
      ${v.invoice ? `<div style="margin-top:6px; font-size:12px; color:var(--primary);">مرتبط بفاتورة: ${v.invoice.reference || v.invoice.id}</div>` : ''}
    </div>`;
  }
  container.innerHTML = html;
  animateEntry('.voucher-card', 60);
  document.querySelectorAll('.voucher-card').forEach(card => {
    card.addEventListener('click', () => showVoucherDetail(parseInt(card.dataset.id)));
  });
}

async function showAddVoucherModal(initialData = {}) {
  const customers = await getAll('customers');
  const suppliers = await getAll('suppliers');
  const invoices = await getAll('invoices');
  const customerDatalistId = `customer-datalist-${Date.now()}`;
  const supplierDatalistId = `supplier-datalist-${Date.now()}`;
  const customerOptions = customers.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  const supplierOptions = suppliers.map(s => `<option value="${s.name}">${s.name}</option>`).join('');

  const body = `
    <div class="form-group"><label>نوع السند</label><select class="select" id="v-type"><option value="receipt">سند قبض</option><option value="payment">سند دفع</option><option value="expense">سند مصروف</option></select></div>
    <div class="form-group" id="v-cust-group"><label>العميل</label>
      <input type="text" class="input" id="v-customer-search" list="${customerDatalistId}" placeholder="ابحث عن عميل">
      <datalist id="${customerDatalistId}">${customerOptions}</datalist>
      <input type="hidden" id="v-customer-id">
    </div>
    <div class="form-group" id="v-supp-group" style="display:none"><label>المورد</label>
      <input type="text" class="input" id="v-supplier-search" list="${supplierDatalistId}" placeholder="ابحث عن مورد">
      <datalist id="${supplierDatalistId}">${supplierOptions}</datalist>
      <input type="hidden" id="v-supplier-id">
    </div>
    <div class="form-group"><label>المبلغ</label><input type="number" step="0.01" class="input" id="v-amount"></div>
    <div class="form-group"><label>التاريخ</label><input type="date" class="input" id="v-date" value="${new Date().toISOString().split('T')[0]}"></div>
    <div class="form-group"><label>الوصف</label><textarea class="textarea" id="v-desc"></textarea></div>
    <div class="form-group"><label>المرجع (اختياري)</label><input type="text" class="input" id="v-ref"></div>
    <div class="form-group"><label>ربط بفاتورة (اختياري)</label><select class="select" id="v-invoice"><option value="">بدون فاتورة</option>${invoices.map(i=>`<option value="${i.id}">${i.type==='sale'?'بيع':'شراء'} ${i.reference||i.id} - ${formatNumber(i.total)}</option>`).join('')}</select></div>`;
  const modal = openModal({
    title: 'إضافة سند جديد',
    bodyHTML: body,
    footerHTML: `<button class="btn btn-secondary" id="v-cancel">إلغاء</button><button class="btn btn-primary" id="v-save">حفظ</button>`
  });
  const typeSel = modal.element.querySelector('#v-type');
  const custGroup = modal.element.querySelector('#v-cust-group');
  const suppGroup = modal.element.querySelector('#v-supp-group');
  const custSearch = modal.element.querySelector('#v-customer-search');
  const custHidden = modal.element.querySelector('#v-customer-id');
  const suppSearch = modal.element.querySelector('#v-supplier-search');
  const suppHidden = modal.element.querySelector('#v-supplier-id');
  typeSel.addEventListener('change', () => {
    const val = typeSel.value;
    custGroup.style.display = val === 'receipt' ? 'block' : 'none';
    suppGroup.style.display = val === 'payment' ? 'block' : 'none';
  });
  custSearch.addEventListener('change', () => {
    const name = custSearch.value.trim();
    const cust = customers.find(c => c.name === name);
    custHidden.value = cust ? cust.id : '';
    if (!cust && name) showToast('العميل غير موجود', 'warning');
  });
  suppSearch.addEventListener('change', () => {
    const name = suppSearch.value.trim();
    const supp = suppliers.find(s => s.name === name);
    suppHidden.value = supp ? supp.id : '';
    if (!supp && name) showToast('المورد غير موجود', 'warning');
  });
  modal.element.querySelector('#v-cancel').onclick = () => modal.close();
  modal.element.querySelector('#v-save').onclick = async () => {
    const type = typeSel.value;
    const amount = parseFloat(modal.element.querySelector('#v-amount').value);
    if (!amount || amount <= 0) { showToast('المبلغ مطلوب', 'error'); return; }
    let customer_id = null, supplier_id = null;
    if (type === 'receipt') {
      const custName = custSearch.value.trim();
      if (!custName) { showToast('اختر عميلاً للسند', 'error'); return; }
      const cust = customers.find(c => c.name === custName);
      if (!cust) { showToast('العميل غير موجود', 'error'); return; }
      customer_id = cust.id;
    } else if (type === 'payment') {
      const suppName = suppSearch.value.trim();
      if (!suppName) { showToast('اختر مورداً للسند', 'error'); return; }
      const supp = suppliers.find(s => s.name === suppName);
      if (!supp) { showToast('المورد غير موجود', 'error'); return; }
      supplier_id = supp.id;
    }
    const invoice_id = modal.element.querySelector('#v-invoice').value || null;
    const voucher = {
      type,
      amount,
      date: modal.element.querySelector('#v-date').value,
      description: modal.element.querySelector('#v-desc').value.trim(),
      reference: modal.element.querySelector('#v-ref').value.trim() || null,
      customer_id,
      supplier_id,
      invoice_id: invoice_id ? parseInt(invoice_id) : null
    };
    await save('vouchers', voucher);
    // تحديث الرصيد
    if (customer_id) {
      const cust = customers.find(c => c.id == customer_id);
      if (cust) {
        const change = type === 'receipt' ? -amount : (type === 'payment' ? amount : 0);
        cust.balance = (cust.balance || 0) + change;
        await save('customers', cust);
        await invalidate('customers');
      }
    } else if (supplier_id) {
      const supp = suppliers.find(s => s.id == supplier_id);
      if (supp) {
        const change = type === 'payment' ? -amount : (type === 'receipt' ? amount : 0);
        supp.balance = (supp.balance || 0) + change;
        await save('suppliers', supp);
        await invalidate('suppliers');
      }
    }
    if (invoice_id) {
      const existingPayments = await getByIndex('payments', 'invoice_id', invoice_id);
      const paidTotal = existingPayments.reduce((s,p)=>s+(p.amount||0),0) + amount;
      const invoice = invoices.find(i=>i.id==invoice_id);
      if (invoice && paidTotal > invoice.total) showToast('تحذير: إجمالي المدفوعات تجاوز قيمة الفاتورة', 'warning');
      await save('payments', { invoice_id, customer_id, supplier_id, amount, payment_date: voucher.date, notes: `سند ${voucher.reference || ''}` });
      await invalidate('invoices');
    }
    await invalidate('vouchers');
    modal.close();
    showToast('تم حفظ السند', 'success');
    loadVouchers();
  };
}

async function showVoucherDetail(id) {
  const vouchers = await getAll('vouchers');
  const v = vouchers.find(v => v.id == id);
  if (!v) return;
  const customers = await getAll('customers');
  const suppliers = await getAll('suppliers');
  const invoices = await getAll('invoices');
  const entity = v.customer_id ? customers.find(c=>c.id==v.customer_id) : suppliers.find(s=>s.id==v.supplier_id);
  const invoice = invoices.find(i=>i.id==v.invoice_id);
  const modal = openModal({
    title: `سند ${v.type === 'receipt' ? 'قبض' : v.type === 'payment' ? 'دفع' : 'مصروف'} ${v.reference || ''}`,
    bodyHTML: `<div><strong>التاريخ:</strong> ${formatDate(v.date)}</div><div><strong>المبلغ:</strong> ${formatNumber(v.amount)}</div><div><strong>الجهة:</strong> ${entity?.name || '-'}</div>${invoice ? `<div><strong>الفاتورة:</strong> ${invoice.reference || invoice.id}</div>` : ''}<div><strong>الوصف:</strong> ${v.description || '-'}</div>`,
    footerHTML: `<button class="btn btn-danger" id="v-delete">حذف</button><button class="btn btn-secondary" id="v-close">إغلاق</button>`
  });
  modal.element.querySelector('#v-close').onclick = () => modal.close();
  modal.element.querySelector('#v-delete').onclick = async () => {
    modal.close();
    if (await confirmDialog('حذف السند؟ سيتم عكس التأثير على الرصيد والفاتورة.')) {
      // عكس التغيير على الرصيد (نفس منطق التحديث ولكن بالإشارة المعكوسة)
      if (v.customer_id) {
        const cust = await getByIndex('customers', 'id', v.customer_id);
        if (cust[0]) {
          // عند الحذف نضيف المبلغ إذا كان قبضاً، وننقص إذا كان دفعاً
          const change = v.type === 'receipt' ? v.amount : (v.type === 'payment' ? -v.amount : 0);
          cust[0].balance = (cust[0].balance || 0) + change;
          await save('customers', cust[0]);
        }
      } else if (v.supplier_id) {
        const supp = await getByIndex('suppliers', 'id', v.supplier_id);
        if (supp[0]) {
          const change = v.type === 'payment' ? v.amount : (v.type === 'receipt' ? -v.amount : 0);
          supp[0].balance = (supp[0].balance || 0) + change;
          await save('suppliers', supp[0]);
        }
      }
      // حذف الدفعة المرتبطة إذا كانت الفاتورة موجودة
      if (v.invoice_id) {
        const payments = await getByIndex('payments', 'invoice_id', v.invoice_id);
        const related = payments.find(p => p.amount === v.amount && p.payment_date === v.date);
        if (related) await del('payments', related.id);
        await invalidate('invoices');
      }
      await del('vouchers', id);
      await invalidate('vouchers');
      showToast('تم الحذف', 'success');
      loadVouchers();
    }
  };
}
