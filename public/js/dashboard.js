// public/js/dashboard.js - نسخة متكاملة مع بطاقات ورسوم بيانية
import { apiCall, formatNumber } from './core.js';

export async function loadDashboard() {
  const container = document.getElementById('tab-content');
  if (!container) return;

  try {
    const data = await apiCall('/summary', 'GET');
    
    // بناء البطاقات
    let html = `<div class="stats-grid">
      <div class="stat-card profit">
        <div class="stat-label">صافي الربح</div>
        <div class="stat-value ${data.net_profit >= 0 ? 'positive' : 'negative'}">${formatNumber(data.net_profit)}</div>
      </div>
      <div class="stat-card cash">
        <div class="stat-label">رصيد الصندوق</div>
        <div class="stat-value">${formatNumber(data.cash_balance)}</div>
      </div>
      <div class="stat-card receivables">
        <div class="stat-label">الذمم المدينة</div>
        <div class="stat-value">${formatNumber(data.receivables)}</div>
      </div>
      <div class="stat-card payables">
        <div class="stat-label">الذمم الدائنة</div>
        <div class="stat-value">${formatNumber(data.payables)}</div>
      </div>
    </div>`;
    
    // إضافة مخطط دائري
    html += `<div class="chart-card"><div class="chart-title">المبيعات مقابل المشتريات</div><canvas id="incomeChart" width="400" height="200"></canvas></div>`;
    
    container.innerHTML = html;
    
    // رسم المخطط الدائري
    const ctx = document.getElementById('incomeChart')?.getContext('2d');
    if (ctx && typeof Chart !== 'undefined') {
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['مبيعات', 'مشتريات'],
          datasets: [{ data: [data.total_sales || 0, data.total_purchases || 0], backgroundColor: ['#10b981', '#f59e0b'] }]
        },
        options: { responsive: true, maintainAspectRatio: true }
      });
    }
  } catch (err) {
    console.error('Dashboard error:', err);
    container.innerHTML = `<div style="color:red; padding:20px;">خطأ في تحميل لوحة التحكم: ${err.message}</div>`;
  }
}
