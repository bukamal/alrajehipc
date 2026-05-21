// js/dashboard.js - لوحة التحكم والإحصائيات والرسوم البيانية
import { getAll } from './store.js';
import { formatNumber, renderSkeleton, animateEntry } from './core.js';
import { showToast } from './modal.js';

export async function loadDashboard() {
  const container = document.getElementById('tab-content');
  container.innerHTML = renderSkeleton('cards') + renderSkeleton('chart') + renderSkeleton('chart');

  try {
    const invoices = await getAll('invoices');
    const expenses = await getAll('expenses');
    const vouchers = await getAll('vouchers');
    const customers = await getAll('customers');
    const suppliers = await getAll('suppliers');

    const totalSales = invoices.filter(i => i.type === 'sale').reduce((s, i) => s + (i.total || 0), 0);
    const totalPurchases = invoices.filter(i => i.type === 'purchase').reduce((s, i) => s + (i.total || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const netProfit = totalSales - totalPurchases - totalExpenses;

    const cashBalance = vouchers.reduce((s, v) => s + (v.type === 'receipt' ? v.amount : -v.amount), 0);
    const receivables = customers.reduce((s, c) => s + (c.balance || 0), 0);
    const payables = suppliers.reduce((s, s2) => s + (s2.balance || 0), 0);

    // بيانات للربح اليومي (آخر 30 يوم)
    const dailyMap = new Map();
    for (const inv of invoices) {
      if (!inv.date) continue;
      if (inv.type === 'sale') dailyMap.set(inv.date, (dailyMap.get(inv.date) || 0) + inv.total);
      else if (inv.type === 'purchase') dailyMap.set(inv.date, (dailyMap.get(inv.date) || 0) - inv.total);
    }
    for (const ex of expenses) {
      if (!ex.expense_date) continue;
      dailyMap.set(ex.expense_date, (dailyMap.get(ex.expense_date) || 0) - ex.amount);
    }
    const sortedDays = Array.from(dailyMap.keys()).sort().slice(-30);
    const dailyProfits = sortedDays.map(d => dailyMap.get(d));

    // بيانات شهرية (آخر 6 أشهر)
    const monthly = {};
    for (const inv of invoices) {
      if (!inv.date) continue;
      const month = inv.date.substring(0, 7);
      if (!monthly[month]) monthly[month] = { sales: 0, purchases: 0 };
      if (inv.type === 'sale') monthly[month].sales += inv.total;
      else if (inv.type === 'purchase') monthly[month].purchases += inv.total;
    }
    for (const ex of expenses) {
      if (!ex.expense_date) continue;
      const month = ex.expense_date.substring(0, 7);
      if (!monthly[month]) monthly[month] = { sales: 0, purchases: 0, expenses: 0 };
      monthly[month].expenses = (monthly[month].expenses || 0) + ex.amount;
    }
    const months = Object.keys(monthly).sort().slice(-6);
    const monthlySales = months.map(m => monthly[m].sales);
    const monthlyPurchases = months.map(m => monthly[m].purchases);
    const monthlyExpenses = months.map(m => monthly[m].expenses || 0);
    const monthlyProfit = months.map((m, i) => monthlySales[i] - monthlyPurchases[i] - monthlyExpenses[i]);

    const html = `
      <div class="stats-grid">
        <div class="stat-card profit"><div class="stat-label">صافي الربح</div><div class="stat-value ${netProfit >= 0 ? 'positive' : 'negative'}">${formatNumber(netProfit)}</div><div class="stat-trend up">${netProfit >= 0 ? '↑ ربح' : '↓ خسارة'}</div></div>
        <div class="stat-card cash"><div class="stat-label">رصيد الصندوق</div><div class="stat-value">${formatNumber(cashBalance)}</div></div>
        <div class="stat-card receivables"><div class="stat-label">الذمم المدينة</div><div class="stat-value">${formatNumber(receivables)}</div></div>
        <div class="stat-card payables"><div class="stat-label">الذمم الدائنة</div><div class="stat-value">${formatNumber(payables)}</div></div>
      </div>
      <div class="chart-card"><div class="chart-title">المبيعات مقابل المشتريات</div><canvas id="incomeChart"></canvas></div>
      <div class="chart-card"><div class="chart-title">الربح اليومي (آخر 30 يوم)</div><canvas id="profitChart"></canvas></div>
      <div class="chart-card"><div class="chart-title">الملخص الشهري (آخر 6 شهور)</div><canvas id="monthlyChart"></canvas></div>
    `;
    container.innerHTML = html;
    animateEntry('.stat-card, .chart-card', 100);

    new Chart(document.getElementById('incomeChart'), {
      type: 'doughnut',
      data: { labels: ['مبيعات', 'مشتريات'], datasets: [{ data: [totalSales, totalPurchases], backgroundColor: ['#10b981', '#f59e0b'], borderWidth: 0 }] },
      options: { responsive: true, cutout: '70%', plugins: { legend: { position: 'bottom' } } }
    });

    if (sortedDays.length) {
      new Chart(document.getElementById('profitChart'), {
        type: 'line',
        data: { labels: sortedDays.map(d => d.substring(5)), datasets: [{ label: 'صافي الربح', data: dailyProfits, borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.1)', fill: true, tension: 0.3 }] },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
      });
    }

    if (months.length) {
      new Chart(document.getElementById('monthlyChart'), {
        type: 'bar',
        data: { labels: months, datasets: [{ label: 'مبيعات', data: monthlySales, backgroundColor: '#10b981' }, { label: 'مشتريات', data: monthlyPurchases, backgroundColor: '#f59e0b' }, { label: 'مصروفات', data: monthlyExpenses, backgroundColor: '#ef4444' }] },
        options: { responsive: true, scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } }
      });
    }
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg><h3>عذراً، حدث خطأ</h3><p>${err.message}</p></div>`;
    showToast(err.message, 'error');
  }
}
