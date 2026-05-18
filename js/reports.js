// js/reports.js - التقارير المالية (قائمة الدخل، الميزانية، ميزان المراجعة، كشوفات)
import { refreshCaches, getCache, apiCall } from './db.js';
import { formatNumber, ICONS, showToast, getCurrencySettings, escapeHtml, openModal, formatDate, confirmDialog, emptyState } from './utils.js';

export async function loadReports() {
    const container = document.getElementById('tab-content');
    container.innerHTML = `
        <div class="card">
            <h3 class="card-title">التقارير المالية والإدارية</h3>
            <p class="card-subtitle">اختر التقرير الذي تريد عرضه</p>
        </div>
        <div class="report-card" data-report="income_statement">
            <div class="report-icon">${ICONS.chart}</div>
            <div class="report-info"><h4>قائمة الدخل</h4><p>الإيرادات والمصروفات وصافي الربح</p></div>
        </div>
        <div class="report-card" data-report="balance_sheet">
            <div class="report-icon">${ICONS.wallet}</div>
            <div class="report-info"><h4>الميزانية العمومية</h4><p>الأصول والخصوم وحقوق الملكية</p></div>
        </div>
        <div class="report-card" data-report="trial_balance">
            <div class="report-icon">${ICONS.scale}</div>
            <div class="report-info"><h4>ميزان المراجعة</h4><p>نظرة شاملة على أرصدة الحسابات</p></div>
        </div>
        <div class="report-card" data-report="customer_balances">
            <div class="report-icon">${ICONS.users}</div>
            <div class="report-info"><h4>أرصدة العملاء</h4><p>المستحق على العملاء</p></div>
        </div>
        <div class="report-card" data-report="supplier_balances">
            <div class="report-icon">${ICONS.factory}</div>
            <div class="report-info"><h4>أرصدة الموردين</h4><p>المستحق للموردين</p></div>
        </div>
        <div class="report-card" data-report="inventory_summary">
            <div class="report-icon">${ICONS.box}</div>
            <div class="report-info"><h4>ملخص المخزون</h4><p>قيمة المواد المتوفرة</p></div>
        </div>`;
    
    document.querySelectorAll('.report-card').forEach(el => {
        el.addEventListener('click', () => {
            const r = el.dataset.report;
            if (r === 'income_statement') loadIncomeStatement();
            else if (r === 'balance_sheet') loadBalanceSheet();
            else if (r === 'trial_balance') loadTrialBalance();
            else if (r === 'customer_balances') loadCustomerBalances();
            else if (r === 'supplier_balances') loadSupplierBalances();
            else if (r === 'inventory_summary') loadInventorySummary();
        });
    });
}

// قائمة الدخل
export async function loadIncomeStatement() {
    await refreshCaches();
    const { invoices, paymentVouchers, expenses } = getCache();
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0,10);
    
    const salesInvoices = invoices.filter(i => i.type === 'sale' && i.invoice_date >= firstDay && i.invoice_date <= lastDay);
    const purchaseInvoices = invoices.filter(i => i.type === 'purchase' && i.invoice_date >= firstDay && i.invoice_date <= lastDay);
    const totalSales = salesInvoices.reduce((s, i) => s + i.total_amount, 0);
    const totalPurchases = purchaseInvoices.reduce((s, i) => s + i.total_amount, 0);
    const totalExpenses = expenses.filter(e => e.date >= firstDay && e.date <= lastDay).reduce((s, e) => s + e.amount, 0);
    const netProfit = totalSales - totalPurchases - totalExpenses;
    
    const html = `
        <div class="card">
            <button class="btn btn-secondary btn-sm" onclick="window.loadReports()" style="width:auto; margin-bottom:16px;">↩️ العودة إلى التقارير</button>
            <h3 class="card-title">قائمة الدخل (الشهر الحالي)</h3>
            <div class="table-wrap">
                <table class="table">
                    <thead><tr><th>البيان</th><th>المبلغ</th></tr></thead>
                    <tbody>
                        <tr><td>المبيعات</td><td class="positive">${formatNumber(totalSales)}</td></tr>
                        <tr><td>المشتريات (تكلفة المبيعات)</td><td class="negative">${formatNumber(totalPurchases)}</td></tr>
                        <tr><td>المصاريف التشغيلية</td><td class="negative">${formatNumber(totalExpenses)}</td></tr>
                        <tr style="border-top:2px solid var(--border); font-weight:900;"><td>صافي الربح</td><td class="${netProfit >= 0 ? 'positive' : 'negative'}">${formatNumber(netProfit)}</td></tr>
                    </tbody>
                </table>
            </div>
        </div>`;
    document.getElementById('tab-content').innerHTML = html;
    window.loadReports = loadReports;
}

// الميزانية العمومية
export async function loadBalanceSheet() {
    await refreshCaches();
    const { customers, suppliers, invoices, paymentVouchers, items } = getCache();
    
    // الأصول: أرصدة العملاء (المدينون) + قيمة المخزون + النقدية (صافي)
    const receivables = customers.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0);
    const inventoryValue = items.reduce((s, i) => s + ((i.available || 0) * (i.average_cost || 0)), 0);
    const totalReceipts = paymentVouchers.filter(v => v.type === 'receipt').reduce((s, v) => s + v.amount, 0);
    const totalPayments = paymentVouchers.filter(v => v.type === 'payment').reduce((s, v) => s + v.amount, 0);
    const totalExpenses = paymentVouchers.filter(v => v.type === 'expense').reduce((s, v) => s + v.amount, 0);
    const cashBalance = totalReceipts - totalPayments - totalExpenses;
    const totalAssets = receivables + inventoryValue + (cashBalance > 0 ? cashBalance : 0);
    
    // الخصوم: أرصدة الموردين (الدائنون)
    const payables = suppliers.reduce((s, s2) => s + (s2.balance > 0 ? s2.balance : 0), 0);
    
    // حقوق الملكية = إجمالي الأصول - إجمالي الخصوم
    const equity = totalAssets - payables;
    
    const html = `
        <div class="card">
            <button class="btn btn-secondary btn-sm" onclick="window.loadReports()" style="width:auto; margin-bottom:16px;">↩️ العودة إلى التقارير</button>
            <h3 class="card-title">الميزانية العمومية</h3>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px;">
                <div><h4>الأصول</h4><div class="table-wrap"><table class="table"><tr><td>الذمم المدينة (عملاء)</td><td>${formatNumber(receivables)}</td></tr><tr><td>قيمة المخزون</td><td>${formatNumber(inventoryValue)}</td></tr><tr><td>الصندوق (النقدية)</td><td>${formatNumber(cashBalance > 0 ? cashBalance : 0)}</td></tr><tr style="border-top:2px solid var(--border);"><td><strong>إجمالي الأصول</strong></td><td><strong>${formatNumber(totalAssets)}</strong></td></tr></table></div></div>
                <div><h4>الخصوم وحقوق الملكية</h4><div class="table-wrap"><table class="table"><tr><td>الذمم الدائنة (موردون)</td><td>${formatNumber(payables)}</td></tr><tr><td>حقوق الملكية (الأرباح المحتجزة)</td><td>${formatNumber(equity)}</td></tr><tr style="border-top:2px solid var(--border);"><td><strong>إجمالي الخصوم وحقوق الملكية</strong></td><td><strong>${formatNumber(payables + equity)}</strong></td></tr></table></div></div>
            </div>
        </div>`;
    document.getElementById('tab-content').innerHTML = html;
    window.loadReports = loadReports;
}

// ميزان المراجعة
export async function loadTrialBalance() {
    await refreshCaches();
    const { customers, suppliers, invoices, paymentVouchers, expenses } = getCache();
    
    const totalSales = invoices.filter(i => i.type === 'sale').reduce((s, i) => s + i.total_amount, 0);
    const totalPurchases = invoices.filter(i => i.type === 'purchase').reduce((s, i) => s + i.total_amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const totalReceivables = customers.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0);
    const totalPayables = suppliers.reduce((s, s2) => s + (s2.balance > 0 ? s2.balance : 0), 0);
    const totalReceipts = paymentVouchers.filter(v => v.type === 'receipt').reduce((s, v) => s + v.amount, 0);
    const totalPayments = paymentVouchers.filter(v => v.type === 'payment').reduce((s, v) => s + v.amount, 0);
    const cashBalance = totalReceipts - totalPayments - totalExpenses;
    
    const rows = [
        { account: 'الصندوق', debit: cashBalance > 0 ? cashBalance : 0, credit: cashBalance < 0 ? -cashBalance : 0 },
        { account: 'الذمم المدينة', debit: totalReceivables, credit: 0 },
        { account: 'الذمم الدائنة', debit: 0, credit: totalPayables },
        { account: 'المبيعات', debit: 0, credit: totalSales },
        { account: 'المشتريات', debit: totalPurchases, credit: 0 },
        { account: 'المصاريف', debit: totalExpenses, credit: 0 }
    ];
    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
    
    let rowsHtml = rows.map(r => `<tr><td>${r.account}</td><td>${formatNumber(r.debit)}</td><td>${formatNumber(r.credit)}</td></tr>`).join('');
    rowsHtml += `<tr style="border-top:2px solid var(--border); font-weight:900;"><td>المجموع</td><td>${formatNumber(totalDebit)}</td><td>${formatNumber(totalCredit)}</td></tr>`;
    
    const html = `
        <div class="card">
            <button class="btn btn-secondary btn-sm" onclick="window.loadReports()" style="width:auto; margin-bottom:16px;">↩️ العودة إلى التقارير</button>
            <h3 class="card-title">ميزان المراجعة</h3>
            <div class="table-wrap"><table class="table"><thead><tr><th>الحساب</th><th>مدين</th><th>دائن</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
        </div>`;
    document.getElementById('tab-content').innerHTML = html;
    window.loadReports = loadReports;
}

// أرصدة العملاء
export async function loadCustomerBalances() {
    await refreshCaches();
    const { customers, invoices, paymentVouchers } = getCache();
    const data = customers.map(c => {
        const totalInvoices = invoices.filter(i => i.customer_id === c.id).reduce((s, i) => s + i.total_amount, 0);
        const paid = paymentVouchers.filter(v => v.customer_id === c.id && v.type === 'receipt').reduce((s, v) => s + v.amount, 0);
        const balance = totalInvoices - paid;
        return { ...c, balance };
    }).filter(c => c.balance !== 0).sort((a,b) => b.balance - a.balance);
    
    let rowsHtml = '';
    data.forEach(c => {
        rowsHtml += `<tr><td>${escapeHtml(c.name)}</td><td>${formatNumber(c.balance)}</td><td>${escapeHtml(c.phone || '-')}</td></tr>`;
    });
    const html = `
        <div class="card">
            <button class="btn btn-secondary btn-sm" onclick="window.loadReports()" style="width:auto; margin-bottom:16px;">↩️ العودة إلى التقارير</button>
            <h3 class="card-title">أرصدة العملاء (المستحق عليهم)</h3>
            ${data.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>العميل</th><th>المستحق</th><th>الجوال</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>` : emptyState('لا توجد أرصدة مستحقة على العملاء')}
        </div>`;
    document.getElementById('tab-content').innerHTML = html;
    window.loadReports = loadReports;
}

// أرصدة الموردين
export async function loadSupplierBalances() {
    await refreshCaches();
    const { suppliers, invoices, paymentVouchers } = getCache();
    const data = suppliers.map(s => {
        const totalInvoices = invoices.filter(i => i.supplier_id === s.id).reduce((s, i) => s + i.total_amount, 0);
        const paid = paymentVouchers.filter(v => v.supplier_id === s.id && v.type === 'payment').reduce((s, v) => s + v.amount, 0);
        const balance = totalInvoices - paid;
        return { ...s, balance };
    }).filter(s => s.balance !== 0).sort((a,b) => b.balance - a.balance);
    
    let rowsHtml = '';
    data.forEach(s => {
        rowsHtml += `<tr><td>${escapeHtml(s.name)}</td><td>${formatNumber(s.balance)}</td><td>${escapeHtml(s.phone || '-')}</td></tr>`;
    });
    const html = `
        <div class="card">
            <button class="btn btn-secondary btn-sm" onclick="window.loadReports()" style="width:auto; margin-bottom:16px;">↩️ العودة إلى التقارير</button>
            <h3 class="card-title">أرصدة الموردين (المستحق لهم)</h3>
            ${data.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>المورد</th><th>المستحق</th><th>الجوال</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>` : emptyState('لا توجد أرصدة مستحقة للموردين')}
        </div>`;
    document.getElementById('tab-content').innerHTML = html;
    window.loadReports = loadReports;
}

// ملخص المخزون
export async function loadInventorySummary() {
    await refreshCaches();
    const { items } = getCache();
    const data = items.filter(i => i.type === 'product').map(i => ({
        name: i.name,
        quantity: i.available || 0,
        avgCost: i.average_cost || 0,
        totalValue: (i.available || 0) * (i.average_cost || 0),
        unit: i.base_unit?.name || 'قطعة'
    })).sort((a,b) => b.totalValue - a.totalValue);
    
    let rowsHtml = '';
    let totalValue = 0;
    data.forEach(i => {
        totalValue += i.totalValue;
        rowsHtml += `<tr><td>${escapeHtml(i.name)}</td><td>${formatNumber(i.quantity)} ${i.unit}</td><td>${formatNumber(i.avgCost)}</td><td>${formatNumber(i.totalValue)}</td></tr>`;
    });
    const html = `
        <div class="card">
            <button class="btn btn-secondary btn-sm" onclick="window.loadReports()" style="width:auto; margin-bottom:16px;">↩️ العودة إلى التقارير</button>
            <h3 class="card-title">ملخص المخزون</h3>
            <div class="table-wrap"><table class="table"><thead><tr><th>المادة</th><th>الكمية</th><th>متوسط التكلفة</th><th>القيمة الإجمالية</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
            <div style="margin-top:16px; font-weight:900;">إجمالي قيمة المخزون: ${formatNumber(totalValue)}</div>
        </div>`;
    document.getElementById('tab-content').innerHTML = html;
    window.loadReports = loadReports;
}
