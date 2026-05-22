// public/js/reports.js
import { apiCall, formatNumber, formatDate, ICONS, animateEntry } from './core.js';
import { showToast } from './modal.js';

export async function loadReports() {
  document.getElementById('tab-content').innerHTML = `
    <div class="card">
      <h3 class="card-title">التقارير المالية</h3>
      <p class="card-subtitle">اختر التقرير المطلوب لعرض التفاصيل</p>
    </div>
    <div class="report-card" data-report="trial_balance">
      <div class="report-icon">${ICONS.chart}</div>
      <div class="report-info"><h4>ميزان المراجعة</h4><p>نظرة شاملة على الحسابات</p></div>
    </div>
    <div class="report-card" data-report="income_statement">
      <div class="report-icon">${ICONS.chart}</div>
      <div class="report-info"><h4>قائمة الدخل</h4><p>الإيرادات والمصروفات والأرباح</p></div>
    </div>
    <div class="report-card" data-report="balance_sheet">
      <div class="report-icon">${ICONS.chart}</div>
      <div class="report-info"><h4>الميزانية العمومية</h4><p>الأصول والخصوم وحقوق الملكية</p></div>
    </div>
    <div class="report-card" data-report="account_ledger">
      <div class="report-icon">${ICONS.fileText}</div>
      <div class="report-info"><h4>الأستاذ العام</h4><p>كشف حساب تفصيلي</p></div>
    </div>
    <div class="report-card" data-report="customer_statement">
      <div class="report-icon">${ICONS.users}</div>
      <div class="report-info"><h4>كشف حساب عميل</h4><p>حركات عميل محدد</p></div>
    </div>
    <div class="report-card" data-report="supplier_statement">
      <div class="report-icon">${ICONS.factory}</div>
      <div class="report-info"><h4>كشف حساب مورد</h4><p>حركات مورد محدد</p></div>
    </div>
    <div class="report-card" data-report="vouchers_log">
      <div class="report-icon">${ICONS.fileText}</div>
      <div class="report-info"><h4>سجل السندات</h4><p>عرض وتحليل السندات</p></div>
    </div>`;

  animateEntry('.report-card', 80);

  document.querySelectorAll('.report-card').forEach(el => {
    el.addEventListener('click', () => {
      const r = el.dataset.report;
      if (r === 'trial_balance') loadTrialBalance();
      else if (r === 'income_statement') loadIncomeStatement();
      else if (r === 'balance_sheet') loadBalanceSheet();
      else if (r === 'account_ledger') loadAccountLedgerForm();
      else if (r === 'customer_statement') loadCustomerStatementForm();
      else if (r === 'supplier_statement') loadSupplierStatementForm();
      else if (r === 'vouchers_log') loadVouchersLog();
    });
  });
}

export async function loadTrialBalance() {
  try {
    const data = await apiCall('/reports?type=trial_balance', 'GET');
    const rows = data.map(r => `<tr>
      <td style="font-weight:800;">${r.name}</td>
      <td>${formatNumber(r.total_debit)}</td>
      <td>${formatNumber(r.total_credit)}</td>
      <td class="${r.balance>=0?'text-success':'text-danger'}" style="font-weight:900;">${formatNumber(r.balance)}</td>
    </tr>`).join('');
    document.getElementById('tab-content').innerHTML = `
      <div class="card">
        <button class="btn btn-secondary btn-sm" onclick="window.loadReports()" style="width:auto;margin-bottom:14px;">🔙 رجوع</button>
        <h3 class="card-title">ميزان المراجعة</h3>
        <div class="table-wrap"><table class="table"><thead><tr><th>الحساب</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>${rows}</tbody></table></div>
      </div>`;
  } catch (e) { showToast(e.message, 'error'); }
}

export async function loadIncomeStatement() {
  try {
    const d = await apiCall('/reports?type=income_statement', 'GET');
    const iRows = d.income.map(i => `<tr><td>${i.name}</td><td style="font-weight:800;color:var(--success);">${formatNumber(i.balance)}</td></tr>`).join('');
    const eRows = d.expenses.map(e => `<tr><td>${e.name}</td><td style="font-weight:800;color:var(--danger);">${formatNumber(e.balance)}</td></tr>`).join('');
    document.getElementById('tab-content').innerHTML = `
      <div class="card">
        <button class="btn btn-secondary btn-sm" onclick="window.loadReports()" style="width:auto;margin-bottom:14px;">🔙 رجوع</button>
        <h3 class="card-title">قائمة الدخل</h3>
        <h4 style="margin-bottom:10px; font-size:16px;">الإيرادات</h4>
        <div class="table-wrap"><table class="table"><thead><tr><th>الحساب</th><th>الرصيد</th></tr></thead><tbody>${iRows}</tbody></table></div>
        <p style="font-weight:900;text-align:left; margin:14px 0; font-size:16px;">إجمالي الإيرادات: <span style="color:var(--success);">${formatNumber(d.total_income)}</span></p>
        <h4 style="margin-bottom:10px; font-size:16px;">المصروفات</h4>
        <div class="table-wrap"><table class="table"><thead><tr><th>الحساب</th><th>الرصيد</th></tr></thead><tbody>${eRows}</tbody></table></div>
        <p style="font-weight:900;text-align:left; margin:14px 0; font-size:16px;">إجمالي المصروفات: <span style="color:var(--danger);">${formatNumber(d.total_expenses)}</span></p>
        <hr style="border-color: var(--border); margin: 20px 0;">
        <h2 style="color:${d.net_profit>=0?'var(--success)':'var(--danger)'};font-size:26px;font-weight:900;text-align:center;">صافي الربح: ${formatNumber(d.net_profit)}</h2>
      </div>`;
  } catch (e) { showToast(e.message, 'error'); }
}

export async function loadBalanceSheet() {
  try {
    const d = await apiCall('/reports?type=balance_sheet', 'GET');
    const aRows = d.assets.map(a => `<tr><td>${a.name}</td><td style="font-weight:800;">${formatNumber(a.balance)}</td></tr>`).join('');
    const lRows = d.liabilities.map(l => `<td><td>${l.name}</td><td style="font-weight:800;">${formatNumber(l.balance)}</td></tr>`).join('');
    const eRows = d.equity.map(e => `<tr><td>${e.name}</td><td style="font-weight:800;">${formatNumber(e.balance)}</td></tr>`).join('');
    document.getElementById('tab-content').innerHTML = `
      <div class="card">
        <button class="btn btn-secondary btn-sm" onclick="window.loadReports()" style="width:auto;margin-bottom:14px;">🔙 رجوع</button>
        <h3 class="card-title">الميزانية العمومية</h3>
        <h4 style="margin-bottom:10px; font-size:16px;">الأصول</h4>
        <div class="table-wrap"><table class="table"><thead><tr><th>الحساب</th><th>الرصيد</th></tr></thead><tbody>${aRows}</tbody></table></div>
        <p style="font-weight:900;text-align:left; margin:14px 0; font-size:16px;">إجمالي الأصول: ${formatNumber(d.total_assets)}</p>
        <h4 style="margin-bottom:10px; font-size:16px;">الخصوم</h4>
        <div class="table-wrap"><table class="table"><thead><tr><th>الحساب</th><th>الرصيد</th></tr></thead><tbody>${lRows}</tbody></table></div>
        <p style="font-weight:900;text-align:left; margin:14px 0; font-size:16px;">إجمالي الخصوم: ${formatNumber(d.total_liabilities)}</p>
        <h4 style="margin-bottom:10px; font-size:16px;">حقوق الملكية</h4>
        <div class="table-wrap"><table class="table"><thead><tr><th>الحساب</th><th>الرصيد</th></tr></thead><tbody>${eRows}</tbody></table></div>
        <p style="font-weight:900;text-align:left; margin:14px 0; font-size:16px;">إجمالي حقوق الملكية: ${formatNumber(d.total_equity)}</p>
      </div>`;
  } catch (e) { showToast(e.message, 'error'); }
}

export async function loadAccountLedgerForm() {
  try {
    const accounts = await apiCall('/accounts', 'GET');
    const opts = accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    document.getElementById('tab-content').innerHTML = `
      <div class="card">
        <button class="btn btn-secondary btn-sm" onclick="window.loadReports()" style="width:auto;margin-bottom:14px;">🔙 رجوع</button>
        <h3 class="card-title">الأستاذ العام</h3>
        <div class="form-group"><select class="select" id="ledger-account">${opts}</select></div>
        <button class="btn btn-primary" id="btn-ledger" style="width:auto;">عرض الحركات</button>
        <div id="ledger-result" style="margin-top:20px"></div>
      </div>`;
    document.getElementById('btn-ledger').addEventListener('click', async () => {
      const id = document.getElementById('ledger-account').value;
      if (!id) return;
      try {
        const lines = await apiCall(`/reports?type=account_ledger&account_id=${id}`, 'GET');
        let html = '<div class="table-wrap"><table class="table"><thead><tr><th>التاريخ</th><th>الوصف</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>';
        lines.forEach(l => html += `<tr>
          <td>${formatDate(l.date)}</td>
          <td>${l.description||''}</td>
          <td style="color:var(--success);font-weight:800;">${formatNumber(l.debit)}</td>
          <td style="color:var(--danger);font-weight:800;">${formatNumber(l.credit)}</td>
          <td class="${(l.balance||0)>=0?'text-success':'text-danger'}" style="font-weight:900;">${formatNumber(l.balance)}</td>
        </tr>`);
        html += '</tbody></table></div>';
        document.getElementById('ledger-result').innerHTML = html;
      } catch (e) { showToast(e.message, 'error'); }
    });
  } catch (e) { showToast(e.message, 'error'); }
}

export async function loadCustomerStatementForm() {
  try {
    const custs = await apiCall('/customers', 'GET');
    const opts = custs.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    document.getElementById('tab-content').innerHTML = `
      <div class="card">
        <button class="btn btn-secondary btn-sm" onclick="window.loadReports()" style="width:auto;margin-bottom:14px;">🔙 رجوع</button>
        <h3 class="card-title">كشف حساب عميل</h3>
        <div class="form-group"><select class="select" id="stmt-cust">${opts}</select></div>
        <button class="btn btn-primary" id="btn-stmt-cust" style="width:auto;">عرض الكشف</button>
        <div id="stmt-result" style="margin-top:20px"></div>
      </div>`;
    document.getElementById('btn-stmt-cust').addEventListener('click', async () => {
      const id = document.getElementById('stmt-cust').value;
      if (!id) return;
      try {
        const lines = await apiCall(`/reports?type=customer_statement&customer_id=${id}`, 'GET');
        let html = '<div class="table-wrap"><table class="table"><thead><tr><th>التاريخ</th><th>الوصف</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>';
        lines.forEach(l => html += `<tr>
          <td>${formatDate(l.date)}</td>
          <td>${l.description||''}</td>
          <td style="color:var(--success);font-weight:800;">${formatNumber(l.debit)}</td>
          <td style="color:var(--danger);font-weight:800;">${formatNumber(l.credit)}</td>
          <td class="${(l.balance||0)>=0?'text-success':'text-danger'}" style="font-weight:900;">${formatNumber(l.balance)}</td>
        </tr>`);
        html += '</tbody></table></div>';
        document.getElementById('stmt-result').innerHTML = html;
      } catch (e) { showToast(e.message, 'error'); }
    });
  } catch (e) { showToast(e.message, 'error'); }
}

export async function loadSupplierStatementForm() {
  try {
    const supps = await apiCall('/suppliers', 'GET');
    const opts = supps.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    document.getElementById('tab-content').innerHTML = `
      <div class="card">
        <button class="btn btn-secondary btn-sm" onclick="window.loadReports()" style="width:auto;margin-bottom:14px;">🔙 رجوع</button>
        <h3 class="card-title">كشف حساب مورد</h3>
        <div class="form-group"><select class="select" id="stmt-supp">${opts}</select></div>
        <button class="btn btn-primary" id="btn-stmt-supp" style="width:auto;">عرض الكشف</button>
        <div id="stmt-result" style="margin-top:20px"></div>
      </div>`;
    document.getElementById('btn-stmt-supp').addEventListener('click', async () => {
      const id = document.getElementById('stmt-supp').value;
      if (!id) return;
      try {
        const lines = await apiCall(`/reports?type=supplier_statement&supplier_id=${id}`, 'GET');
        let html = '<div class="table-wrap"><table class="table"><thead><tr><th>التاريخ</th><th>الوصف</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>';
        lines.forEach(l => html += `<tr>
          <td>${formatDate(l.date)}</td>
          <td>${l.description||''}</td>
          <td style="color:var(--success);font-weight:800;">${formatNumber(l.debit)}</td>
          <td style="color:var(--danger);font-weight:800;">${formatNumber(l.credit)}</td>
          <td class="${(l.balance||0)>=0?'text-success':'text-danger'}" style="font-weight:900;">${formatNumber(l.balance)}</td>
        </tr>`);
        html += '</tbody></table></div>';
        document.getElementById('stmt-result').innerHTML = html;
      } catch (e) { showToast(e.message, 'error'); }
    });
  } catch (e) { showToast(e.message, 'error'); }
}

export async function loadVouchersLog() {
  try {
    const vouchers = await apiCall('/payments?voucher=1', 'GET');
    const [customers, suppliers] = await Promise.all([
      apiCall('/customers', 'GET'),
      apiCall('/suppliers', 'GET')
    ]);

    let totalReceipt = 0, totalPayment = 0, totalExpense = 0;

    const rows = vouchers.map(v => {
      const typeLabel = v.type === 'receipt' ? 'قبض' : v.type === 'payment' ? 'دفع' : 'مصروف';
      const entityName = v.customer?.name || v.supplier?.name || '-';
      const entityType = v.customer ? 'عميل' : v.supplier ? 'مورد' : '-';
      if (v.type === 'receipt') totalReceipt += parseFloat(v.amount||0);
      else if (v.type === 'payment') totalPayment += parseFloat(v.amount||0);
      else totalExpense += parseFloat(v.amount||0);

      return `<tr>
        <td>${formatDate(v.date)}</td>
        <td>${v.reference || '-'}</td>
        <td>${typeLabel}</td>
        <td>${entityName}</td>
        <td>${entityType}</td>
        <td style="font-weight:800;color:${v.type==='receipt'?'var(--success)':'var(--danger)'};">${formatNumber(v.amount)}</td>
        <td>${v.description || ''}</td>
      </tr>`;
    }).join('');

    document.getElementById('tab-content').innerHTML = `
      <div class="card">
        <button class="btn btn-secondary btn-sm" onclick="window.loadReports()" style="width:auto;margin-bottom:14px;">🔙 رجوع</button>
        <h3 class="card-title">سجل السندات</h3>
        <div class="stats-grid" style="grid-template-columns: repeat(3,1fr); margin-bottom:24px;">
          <div class="stat-card" style="border-color:var(--success);"><div class="stat-label">إجمالي القبوض</div><div class="stat-value positive">${formatNumber(totalReceipt)}</div></div>
          <div class="stat-card" style="border-color:var(--danger);"><div class="stat-label">إجمالي الدفع</div><div class="stat-value negative">${formatNumber(totalPayment)}</div></div>
          <div class="stat-card" style="border-color:var(--warning);"><div class="stat-label">إجمالي المصاريف</div><div class="stat-value" style="color:var(--warning);">${formatNumber(totalExpense)}</div></div>
        </div>
        <div class="filter-bar">
          <button class="filter-pill active" data-vtype="all">الكل</button>
          <button class="filter-pill" data-vtype="receipt">قبض</button>
          <button class="filter-pill" data-vtype="payment">دفع</button>
          <button class="filter-pill" data-vtype="expense">مصاريف</button>
        </div>
        <div class="table-wrap"><table class="table" id="vouchers-table"><thead><tr><th>التاريخ</th><th>المرجع</th><th>النوع</th><th>الجهة</th><th>تصنيف الجهة</th><th>المبلغ</th><th>الوصف</th></tr></thead><tbody>${rows}</tbody></table></div>
      </div>`;

    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', function() {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        this.classList.add('active');
        const vtype = this.dataset.vtype;
        document.querySelectorAll('#vouchers-table tbody tr').forEach(row => {
          const typeCell = row.cells[2].textContent.trim();
          if (vtype === 'all' || 
              (vtype === 'receipt' && typeCell === 'قبض') ||
              (vtype === 'payment' && typeCell === 'دفع') ||
              (vtype === 'expense' && typeCell === 'مصروف')) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        });
      });
    });

  } catch (e) { showToast(e.message, 'error'); }
}

window.loadReports = loadReports;

