// js/reports.js - جميع التقارير المالية مع حقل بحث للعميل/المورد
import { getAll, getByIndex } from './store.js';
import { formatNumber, formatDate, ICONS, animateEntry } from './core.js';
import { showToast } from './modal.js';

export async function loadReports() {
  document.getElementById('tab-content').innerHTML = `
    <div class="card"><h3 class="card-title">التقارير المالية</h3><p class="card-subtitle">اختر التقرير المطلوب</p></div>
    <div class="report-card" data-report="trial_balance"><div class="report-icon">${ICONS.chart}</div><div><h4>ميزان المراجعة</h4></div></div>
    <div class="report-card" data-report="income_statement"><div class="report-icon">${ICONS.chart}</div><div><h4>قائمة الدخل</h4></div></div>
    <div class="report-card" data-report="balance_sheet"><div class="report-icon">${ICONS.chart}</div><div><h4>الميزانية العمومية</h4></div></div>
    <div class="report-card" data-report="account_ledger"><div class="report-icon">${ICONS.fileText}</div><div><h4>الأستاذ العام (كل الحسابات)</h4></div></div>
    <div class="report-card" data-report="customer_statement"><div class="report-icon">${ICONS.users}</div><div><h4>كشف حساب عميل</h4></div></div>
    <div class="report-card" data-report="supplier_statement"><div class="report-icon">${ICONS.factory}</div><div><h4>كشف حساب مورد</h4></div></div>
    <div class="report-card" data-report="monthly_summary"><div class="report-icon">${ICONS.chart}</div><div><h4>ملخص شهري</h4></div></div>
    <div class="report-card" data-report="daily_profit"><div class="report-icon">${ICONS.chart}</div><div><h4>الربح اليومي</h4></div></div>`;
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
      else if (r === 'monthly_summary') loadMonthlySummary();
      else if (r === 'daily_profit') loadDailyProfitReport();
    });
  });
}

async function loadTrialBalance() {
  const customers = await getAll('customers');
  const suppliers = await getAll('suppliers');
  const invoices = await getAll('invoices');
  const expenses = await getAll('expenses');
  const vouchers = await getAll('vouchers');
  const cashBalance = vouchers.reduce((s,v)=> s + (v.type === 'receipt' ? v.amount : -v.amount), 0);
  const receivables = customers.reduce((s,c)=>s+(c.balance||0),0);
  const payables = suppliers.reduce((s,supp)=>s+(supp.balance||0),0);
  const totalSales = invoices.filter(i=>i.type==='sale').reduce((s,i)=>s+(i.total||0),0);
  const totalPurchases = invoices.filter(i=>i.type==='purchase').reduce((s,i)=>s+(i.total||0),0);
  const totalExpenses = expenses.reduce((s,e)=>s+(e.amount||0),0);
  const equity = cashBalance + receivables - payables - totalExpenses;
  const rows = [
    { name: 'الصندوق', debit: cashBalance > 0 ? cashBalance : 0, credit: cashBalance < 0 ? -cashBalance : 0, balance: cashBalance },
    { name: 'ذمم مدينة', debit: receivables, credit: 0, balance: receivables },
    { name: 'ذمم دائنة', debit: 0, credit: payables, balance: -payables },
    { name: 'المبيعات', debit: 0, credit: totalSales, balance: totalSales },
    { name: 'المشتريات', debit: totalPurchases, credit: 0, balance: -totalPurchases },
    { name: 'مصاريف عامة', debit: totalExpenses, credit: 0, balance: -totalExpenses },
    { name: 'رأس المال', debit: equity < 0 ? -equity : 0, credit: equity > 0 ? equity : 0, balance: equity }
  ];
  let html = `<div class="card"><button class="btn btn-secondary" onclick="loadReports()">🔙 رجوع</button><h3>ميزان المراجعة</h3><div class="table-wrap"><table class="table"><thead><tr><th>الحساب</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>`;
  for (const r of rows) html += `<tr><td style="font-weight:800;">${r.name}</td><td class="text-success">${formatNumber(r.debit)}</td><td class="text-danger">${formatNumber(r.credit)}</td><td class="${r.balance>=0?'text-success':'text-danger'}">${formatNumber(r.balance)}</td></tr>`;
  html += `</tbody></table></div></div>`;
  document.getElementById('tab-content').innerHTML = html;
}

async function loadIncomeStatement() {
  const invoices = await getAll('invoices');
  const expenses = await getAll('expenses');
  const totalSales = invoices.filter(i=>i.type==='sale').reduce((s,i)=>s+(i.total||0),0);
  const totalPurchases = invoices.filter(i=>i.type==='purchase').reduce((s,i)=>s+(i.total||0),0);
  const totalExpenses = expenses.reduce((s,e)=>s+(e.amount||0),0);
  const netProfit = totalSales - totalPurchases - totalExpenses;
  const html = `<div class="card"><button class="btn btn-secondary" onclick="loadReports()">🔙 رجوع</button><h3>قائمة الدخل</h3><div class="table-wrap"><table class="table"><thead><tr><th>البند</th><th>المبلغ</th></tr></thead><tbody>
    <tr><td style="font-weight:800;">المبيعات</td><td class="text-success">${formatNumber(totalSales)}</td></tr>
    <tr><td style="font-weight:800;">المشتريات</td><td class="text-danger">${formatNumber(totalPurchases)}</td></tr>
    <tr><td style="font-weight:800;">المصاريف</td><td class="text-danger">${formatNumber(totalExpenses)}</td></tr>
    <tr style="border-top:2px solid var(--border);"><td style="font-weight:900;">صافي الربح</td><td class="${netProfit>=0?'text-success':'text-danger'}">${formatNumber(netProfit)}</td></tr>
  </tbody></table></div></div>`;
  document.getElementById('tab-content').innerHTML = html;
}

async function loadBalanceSheet() {
  const customers = await getAll('customers');
  const suppliers = await getAll('suppliers');
  const vouchers = await getAll('vouchers');
  const expenses = await getAll('expenses');
  const cash = vouchers.reduce((s,v)=> s + (v.type === 'receipt' ? v.amount : -v.amount), 0);
  const receivables = customers.reduce((s,c)=>s+(c.balance||0),0);
  const payables = suppliers.reduce((s,supp)=>s+(supp.balance||0),0);
  const totalAssets = cash + receivables;
  const totalLiabilities = payables;
  const totalExpenses = expenses.reduce((s,e)=>s+(e.amount||0),0);
  const equity = totalAssets - totalLiabilities - totalExpenses;
  const html = `<div class="card"><button class="btn btn-secondary" onclick="loadReports()">🔙 رجوع</button><h3>الميزانية العمومية</h3>
    <h4>الأصول</h4><div class="table-wrap"><table class="table"><thead><tr><th>الحساب</th><th>الرصيد</th></tr></thead><tbody>
    <tr><td style="font-weight:800;">الصندوق</td><td>${formatNumber(cash)}</td></tr>
    <tr><td style="font-weight:800;">ذمم مدينة</td><td>${formatNumber(receivables)}</td></tr>
    <tr style="font-weight:900;"><td>إجمالي الأصول</td><td>${formatNumber(totalAssets)}</td></tr>
    </tbody></table></div>
    <h4>الخصوم</h4><div class="table-wrap"><table class="table"><thead><tr><th>الحساب</th><th>الرصيد</th></tr></thead><tbody>
    <tr><td style="font-weight:800;">ذمم دائنة</td><td>${formatNumber(payables)}</td></tr>
    <tr style="font-weight:900;"><td>إجمالي الخصوم</td><td>${formatNumber(totalLiabilities)}</td></tr>
    </tbody></table></div>
    <h4>حقوق الملكية</h4><div class="table-wrap"><table class="table"><thead><tr><th>الحساب</th><th>الرصيد</th></tr></thead><tbody>
    <tr><td style="font-weight:800;">رأس المال (الأرباح المرحلة)</td><td>${formatNumber(equity)}</td></tr>
    </tbody></table></div>
  </div>`;
  document.getElementById('tab-content').innerHTML = html;
}

async function loadAccountLedgerForm() {
  const accounts = await getAll('accounts');
  const opts = accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  const html = `<div class="card"><button class="btn btn-secondary" onclick="loadReports()">🔙 رجوع</button><h3>الأستاذ العام</h3>
    <div class="form-group"><label>اختر الحساب</label><select id="ledger-account" class="select">${opts}</select></div>
    <button class="btn btn-primary" id="btn-ledger">عرض الحركات</button>
    <div id="ledger-result" style="margin-top:20px;"></div></div>`;
  document.getElementById('tab-content').innerHTML = html;
  document.getElementById('btn-ledger').addEventListener('click', async () => {
    const accId = parseInt(document.getElementById('ledger-account').value);
    const account = accounts.find(a => a.id === accId);
    if (!account) return;
    const invoices = await getAll('invoices');
    const payments = await getAll('payments');
    const vouchers = await getAll('vouchers');
    const expenses = await getAll('expenses');
    const customers = await getAll('customers');
    const suppliers = await getAll('suppliers');
    let lines = [];
    if (account.name === 'الصندوق') {
      for (const v of vouchers) lines.push({ date: v.date, description: `${v.type==='receipt'?'قبض':'صرف'} ${v.reference||''}`, debit: v.type==='receipt'?v.amount:0, credit: v.type!=='receipt'?v.amount:0 });
      for (const p of payments) lines.push({ date: p.payment_date, description: 'دفعة', debit: p.customer_id?p.amount:0, credit: p.supplier_id?p.amount:0 });
    } else if (account.name === 'المبيعات') {
      for (const inv of invoices.filter(i=>i.type==='sale')) lines.push({ date: inv.date, description: `فاتورة ${inv.reference||''}`, debit: 0, credit: inv.total });
    } else if (account.name === 'المشتريات') {
      for (const inv of invoices.filter(i=>i.type==='purchase')) lines.push({ date: inv.date, description: `فاتورة ${inv.reference||''}`, debit: inv.total, credit: 0 });
    } else if (account.name === 'مصاريف عامة') {
      for (const ex of expenses) lines.push({ date: ex.expense_date, description: ex.description||'مصروف', debit: ex.amount, credit: 0 });
      for (const v of vouchers.filter(v=>v.type==='expense')) lines.push({ date: v.date, description: `سند مصروف ${v.reference||''}`, debit: v.amount, credit: 0 });
    } else {
      const cust = customers.find(c => c.name === account.name.replace('عميل ',''));
      if (cust) {
        const invs = invoices.filter(i=>i.customer_id===cust.id);
        const pays = payments.filter(p=>p.customer_id===cust.id);
        for (const inv of invs) lines.push({ date: inv.date, description: `فاتورة ${inv.reference||''}`, debit: inv.type==='sale'?inv.total:0, credit: inv.type==='purchase'?inv.total:0 });
        for (const p of pays) lines.push({ date: p.payment_date, description: 'دفعة', debit: 0, credit: p.amount });
      } else {
        const supp = suppliers.find(s => s.name === account.name.replace('مورد ',''));
        if (supp) {
          const invs = invoices.filter(i=>i.supplier_id===supp.id);
          const pays = payments.filter(p=>p.supplier_id===supp.id);
          for (const inv of invs) lines.push({ date: inv.date, description: `فاتورة ${inv.reference||''}`, debit: inv.type==='purchase'?inv.total:0, credit: inv.type==='sale'?inv.total:0 });
          for (const p of pays) lines.push({ date: p.payment_date, description: 'دفعة', debit: p.amount, credit: 0 });
        }
      }
    }
    lines.sort((a,b)=>a.date.localeCompare(b.date));
    let balance = 0;
    let resultHtml = '<div class="table-wrap"><table class="table"><thead><tr><th>التاريخ</th><th>الوصف</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>';
    for (const l of lines) {
      balance += (l.debit||0) - (l.credit||0);
      resultHtml += `<tr><td>${formatDate(l.date)}</td><td>${l.description}</td><td class="text-success">${formatNumber(l.debit)}</td><td class="text-danger">${formatNumber(l.credit)}</td><td class="${balance>=0?'text-success':'text-danger'}">${formatNumber(balance)}</td></tr>`;
    }
    resultHtml += '</tbody></table></div>';
    document.getElementById('ledger-result').innerHTML = resultHtml || '<div class="empty-state">لا توجد حركات لهذا الحساب</div>';
  });
}

async function loadCustomerStatementForm() {
  const customers = await getAll('customers');
  const customerDatalistId = `cust-datalist-${Date.now()}`;
  const custOptions = customers.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  const html = `<div class="card"><button class="btn btn-secondary" onclick="loadReports()">🔙 رجوع</button><h3>كشف حساب عميل</h3>
    <div class="form-group"><label>اختر العميل</label>
      <input type="text" class="input" id="stmt-cust-search" list="${customerDatalistId}" placeholder="ابحث عن عميل">
      <datalist id="${customerDatalistId}">${custOptions}</datalist>
      <input type="hidden" id="stmt-cust-id">
    </div>
    <button class="btn btn-primary" id="btn-stmt">عرض الكشف</button>
    <div id="stmt-result"></div></div>`;
  document.getElementById('tab-content').innerHTML = html;
  const searchInput = document.getElementById('stmt-cust-search');
  const hiddenId = document.getElementById('stmt-cust-id');
  searchInput.addEventListener('change', () => {
    const name = searchInput.value.trim();
    const cust = customers.find(c => c.name === name);
    if (cust) hiddenId.value = cust.id;
    else hiddenId.value = '';
  });
  document.getElementById('btn-stmt').addEventListener('click', async () => {
    const custId = parseInt(hiddenId.value);
    if (!custId) { showToast('اختر عميلاً صحيحاً', 'error'); return; }
    const invoices = await getByIndex('invoices', 'customer_id', custId);
    const payments = await getByIndex('payments', 'customer_id', custId);
    const vouchers = await getByIndex('vouchers', 'customer_id', custId);
    let lines = [];
    for (const inv of invoices) lines.push({ date: inv.date, description: `فاتورة ${inv.type==='sale'?'بيع':'شراء'} ${inv.reference||''}`, debit: inv.type==='sale'?inv.total:0, credit: inv.type==='purchase'?inv.total:0 });
    for (const p of payments) lines.push({ date: p.payment_date, description: 'دفعة', debit: 0, credit: p.amount });
    for (const v of vouchers) lines.push({ date: v.date, description: `سند قبض ${v.reference||''}`, debit: 0, credit: v.amount });
    lines.sort((a,b)=>a.date.localeCompare(b.date));
    let balance = 0;
    let resultHtml = '<div class="table-wrap"><table class="table"><thead><tr><th>التاريخ</th><th>الوصف</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>';
    for (const l of lines) {
      balance += (l.debit||0) - (l.credit||0);
      resultHtml += `<tr><td>${formatDate(l.date)}</td><td>${l.description}</td><td class="text-success">${formatNumber(l.debit)}</td><td class="text-danger">${formatNumber(l.credit)}</td><td class="${balance>=0?'text-success':'text-danger'}">${formatNumber(balance)}</td></tr>`;
    }
    resultHtml += '</tbody></table></div>';
    document.getElementById('stmt-result').innerHTML = resultHtml || '<div class="empty-state">لا توجد حركات لهذا العميل</div>';
  });
}

async function loadSupplierStatementForm() {
  const suppliers = await getAll('suppliers');
  const supplierDatalistId = `supp-datalist-${Date.now()}`;
  const suppOptions = suppliers.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
  const html = `<div class="card"><button class="btn btn-secondary" onclick="loadReports()">🔙 رجوع</button><h3>كشف حساب مورد</h3>
    <div class="form-group"><label>اختر المورد</label>
      <input type="text" class="input" id="stmt-supp-search" list="${supplierDatalistId}" placeholder="ابحث عن مورد">
      <datalist id="${supplierDatalistId}">${suppOptions}</datalist>
      <input type="hidden" id="stmt-supp-id">
    </div>
    <button class="btn btn-primary" id="btn-stmt">عرض الكشف</button>
    <div id="stmt-result"></div></div>`;
  document.getElementById('tab-content').innerHTML = html;
  const searchInput = document.getElementById('stmt-supp-search');
  const hiddenId = document.getElementById('stmt-supp-id');
  searchInput.addEventListener('change', () => {
    const name = searchInput.value.trim();
    const supp = suppliers.find(s => s.name === name);
    if (supp) hiddenId.value = supp.id;
    else hiddenId.value = '';
  });
  document.getElementById('btn-stmt').addEventListener('click', async () => {
    const suppId = parseInt(hiddenId.value);
    if (!suppId) { showToast('اختر مورداً صحيحاً', 'error'); return; }
    const invoices = await getByIndex('invoices', 'supplier_id', suppId);
    const payments = await getByIndex('payments', 'supplier_id', suppId);
    const vouchers = await getByIndex('vouchers', 'supplier_id', suppId);
    let lines = [];
    for (const inv of invoices) lines.push({ date: inv.date, description: `فاتورة ${inv.type==='purchase'?'شراء':'بيع'} ${inv.reference||''}`, debit: inv.type==='purchase'?inv.total:0, credit: inv.type==='sale'?inv.total:0 });
    for (const p of payments) lines.push({ date: p.payment_date, description: 'دفعة', debit: p.amount, credit: 0 });
    for (const v of vouchers) lines.push({ date: v.date, description: `سند صرف ${v.reference||''}`, debit: v.amount, credit: 0 });
    lines.sort((a,b)=>a.date.localeCompare(b.date));
    let balance = 0;
    let resultHtml = '<div class="table-wrap"><table class="table"><thead><tr><th>التاريخ</th><th>الوصف</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>';
    for (const l of lines) {
      balance += (l.credit||0) - (l.debit||0);
      resultHtml += `<tr><td>${formatDate(l.date)}</td><td>${l.description}</td><td class="text-success">${formatNumber(l.debit)}</td><td class="text-danger">${formatNumber(l.credit)}</td><td class="${balance>=0?'text-success':'text-danger'}">${formatNumber(balance)}</td></tr>`;
    }
    resultHtml += '</tbody></table></div>';
    document.getElementById('stmt-result').innerHTML = resultHtml || '<div class="empty-state">لا توجد حركات لهذا المورد</div>';
  });
}

async function loadMonthlySummary() {
  const invoices = await getAll('invoices');
  const expenses = await getAll('expenses');
  const monthly = {};
  for (const inv of invoices) {
    if (!inv.date) continue;
    const key = inv.date.substring(0,7);
    if (!monthly[key]) monthly[key] = { sales:0, purchases:0, expenses:0 };
    if (inv.type === 'sale') monthly[key].sales += inv.total;
    else monthly[key].purchases += inv.total;
  }
  for (const ex of expenses) {
    if (!ex.expense_date) continue;
    const key = ex.expense_date.substring(0,7);
    if (!monthly[key]) monthly[key] = { sales:0, purchases:0, expenses:0 };
    monthly[key].expenses += ex.amount;
  }
  const months = Object.keys(monthly).sort();
  let html = `<div class="card"><button class="btn btn-secondary" onclick="loadReports()">🔙 رجوع</button><h3>الملخص الشهري</h3><div class="table-wrap"><table class="table"><thead><tr><th>الشهر</th><th>المبيعات</th><th>المشتريات</th><th>المصروفات</th><th>صافي الربح</th></tr></thead><tbody>`;
  for (const m of months) {
    const d = monthly[m];
    const profit = d.sales - d.purchases - d.expenses;
    html += `<tr><td>${m}</td><td>${formatNumber(d.sales)}</td><td>${formatNumber(d.purchases)}</td><td>${formatNumber(d.expenses)}</td><td class="${profit>=0?'text-success':'text-danger'}">${formatNumber(profit)}</td></tr>`;
  }
  html += `</tbody></table></div></div>`;
  document.getElementById('tab-content').innerHTML = html;
}

async function loadDailyProfitReport() {
  const invoices = await getAll('invoices');
  const expenses = await getAll('expenses');
  const daily = new Map();
  for (const inv of invoices) {
    if (!inv.date) continue;
    if (inv.type === 'sale') daily.set(inv.date, (daily.get(inv.date)||0) + inv.total);
    else if (inv.type === 'purchase') daily.set(inv.date, (daily.get(inv.date)||0) - inv.total);
  }
  for (const ex of expenses) {
    if (!ex.expense_date) continue;
    daily.set(ex.expense_date, (daily.get(ex.expense_date)||0) - ex.amount);
  }
  const dates = Array.from(daily.keys()).sort();
  const profits = dates.map(d => daily.get(d));
  let html = `<div class="card"><button class="btn btn-secondary" onclick="loadReports()">🔙 رجوع</button><h3>الربح اليومي</h3><div class="table-wrap"><table class="table"><thead><tr><th>التاريخ</th><th>صافي الربح</th></tr></thead><tbody>`;
  for (let i=0; i<dates.length; i++) {
    html += `<tr><td>${formatDate(dates[i])}</td><td class="${profits[i]>=0?'text-success':'text-danger'}">${formatNumber(profits[i])}</td></tr>`;
  }
  html += `</tbody></table></div><canvas id="dailyProfitChart" style="margin-top:20px; max-height:300px;"></canvas></div>`;
  document.getElementById('tab-content').innerHTML = html;
  const ctx = document.getElementById('dailyProfitChart')?.getContext('2d');
  if (ctx) {
    new Chart(ctx, {
      type: 'line',
      data: { labels: dates.map(d=>formatDate(d)), datasets: [{ label: 'صافي الربح اليومي', data: profits, borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.1)', fill: true, tension: 0.3 }] },
      options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
  }
}

window.loadReports = loadReports;
