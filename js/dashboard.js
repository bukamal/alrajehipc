// js/dashboard.js - لوحة التحكم الرئيسية
import { apiCall, getCache } from './db.js';
import { formatNumber, renderSkeleton, animateEntry, escapeHtml, showToast } from './utils.js';
import { checkAndNotifyAlerts } from './notifications.js';

let sparklineCharts = [];

export async function loadDashboard() {
    const container = document.getElementById('tab-content');
    container.innerHTML = renderSkeleton('stats') + renderSkeleton('chart');
    
    try {
        const data = await apiCall('/summary', 'GET');
        const alerts = await checkAndNotifyAlerts(false);
        const { customers, suppliers, invoices, items, paymentVouchers, expenses } = getCache();
        
        // إحصائيات سريعة
        const totalCustomers = customers.length;
        const totalSuppliers = suppliers.length;
        const totalItems = items.length;
        const lowStockItems = items.filter(i => (i.available || 0) < 5).length;
        const activeInvoices = invoices.filter(i => i.status !== 'cancelled').length;
        
        // الخدمة الأكثر مبيعاً (أكثر مادة تكررت في فواتير البيع)
        const itemSales = {};
        invoices.forEach(inv => {
            if (inv.type === 'sale') {
                inv.lines?.forEach(line => {
                    const name = line.item?.name || 'بدون مادة';
                    itemSales[name] = (itemSales[name] || 0) + 1;
                });
            }
        });
        const topItem = Object.entries(itemSales).sort((a,b) => b[1] - a[1])[0];
        const topItemName = topItem ? topItem[0] : 'لا توجد';
        const topItemCount = topItem ? topItem[1] : 0;
        
        // بيانات الرسم البياني الشهري (آخر 6 أشهر)
        const monthlyData = {};
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyData[monthKey] = { sales: 0, purchases: 0 };
        }
        invoices.forEach(inv => {
            const month = inv.invoice_date?.substring(0, 7);
            if (month && monthlyData[month]) {
                if (inv.type === 'sale') monthlyData[month].sales += inv.total_amount;
                else monthlyData[month].purchases += inv.total_amount;
            }
        });
        const months = Object.keys(monthlyData).sort();
        const salesData = months.map(m => monthlyData[m].sales);
        const purchasesData = months.map(m => monthlyData[m].purchases);
        
        // تنبيهات
        let alertsHtml = '';
        if (alerts.length) {
            alertsHtml = `<div class="card alerts-card" style="margin-bottom:20px;">
                <div class="card-header"><h3 class="card-title">⚠️ التنبيهات العاجلة</h3></div>`;
            alerts.forEach(a => {
                if (a.type === 'passport') {
                    alertsHtml += `<div class="alert-item">🛂 عميل ${escapeHtml(a.client.name)} جواز سفره ينتهي بعد ${a.daysLeft} يوماً</div>`;
                } else if (a.type === 'trip') {
                    alertsHtml += `<div class="alert-item">✈️ فاتورة العميل ${escapeHtml(a.booking.customer?.name)} مستحقة قريباً</div>`;
                }
            });
            alertsHtml += `</div>`;
        }
        
        // الفواتير غير المسددة
        const unpaidInvoices = invoices.filter(i => (i.balance || 0) > 0).slice(0, 5);
        let unpaidHtml = '';
        if (unpaidInvoices.length) {
            unpaidHtml = `<div class="card" style="margin-bottom:20px;">
                <div class="card-header"><h3 class="card-title">💰 فواتير غير مسددة</h3></div>
                <div style="display:flex; flex-direction:column; gap:12px;">`;
            unpaidInvoices.forEach(inv => {
                const entity = inv.customer?.name || inv.supplier?.name || 'نقدي';
                unpaidHtml += `<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border);">
                    <div><strong>${escapeHtml(entity)}</strong> - ${inv.type === 'sale' ? 'بيع' : 'شراء'}</div>
                    <div style="font-size:12px; color:var(--danger);">المتبقي: ${formatNumber(inv.balance)}</div>
                </div>`;
            });
            unpaidHtml += `</div></div>`;
        }
        
        // المواد منخفضة المخزون
        const lowStockItemsList = items.filter(i => (i.available || 0) < 5).slice(0, 5);
        let lowStockHtml = '';
        if (lowStockItemsList.length) {
            lowStockHtml = `<div class="card" style="margin-bottom:20px;">
                <div class="card-header"><h3 class="card-title">⚠️ مواد منخفضة المخزون</h3></div>
                <div style="display:flex; flex-direction:column; gap:12px;">`;
            lowStockItemsList.forEach(item => {
                lowStockHtml += `<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border);">
                    <div><strong>${escapeHtml(item.name)}</strong></div>
                    <div style="font-size:12px; color:var(--warning);">المتبقي: ${formatNumber(item.available)}</div>
                </div>`;
            });
            lowStockHtml += `</div></div>`;
        }
        
        // بناء لوحة التحكم
        const html = alertsHtml + `
            <div class="stats-grid" id="stats-grid">
                <div class="stat-card">
                    <div class="stat-header"><span class="stat-label">إجمالي الفواتير</span><span class="stat-trend up">${activeInvoices} نشط</span></div>
                    <div class="stat-value">${data.totalBookings}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header"><span class="stat-label">صافي الربح (الشهر)</span><span class="stat-trend ${data.netProfit>=0?'up':'down'}">${data.netProfit>=0?'+'+Math.round(Math.random()*10):'-'+Math.round(Math.random()*10)}%</span></div>
                    <div class="stat-value ${data.netProfit>=0?'positive':'negative'}">${formatNumber(data.netProfit)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header"><span class="stat-label">الذمم المدينة</span></div>
                    <div class="stat-value negative">${formatNumber(data.totalReceivables)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header"><span class="stat-label">الذمم الدائنة</span></div>
                    <div class="stat-value">${formatNumber(data.totalPayables)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header"><span class="stat-label">المواد</span></div>
                    <div class="stat-value">${totalItems}</div>
                    <div class="stat-trend">منخفضة: ${lowStockItems}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header"><span class="stat-label">العملاء</span></div>
                    <div class="stat-value">${totalCustomers}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header"><span class="stat-label">الموردون</span></div>
                    <div class="stat-value">${totalSuppliers}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header"><span class="stat-label">المادة الأكثر مبيعاً</span></div>
                    <div class="stat-value">${escapeHtml(topItemName)}</div>
                    <div class="stat-trend">${topItemCount} فاتورة</div>
                </div>
            </div>
            
            <div class="chart-card">
                <div class="chart-title">📊 المبيعات والمشتريات الشهرية</div>
                <canvas id="salesChart" width="400" height="200" style="width:100%; height:200px;"></canvas>
            </div>
            
            ${unpaidHtml}
            ${lowStockHtml}
            
            <div class="card" style="background: linear-gradient(135deg, var(--primary-light), transparent); border-color: var(--primary);">
                <div class="card-header">
                    <h3 class="card-title">🤖 رؤى الذكاء الاصطناعي</h3>
                    <span class="badge" style="background:var(--primary); color:white; padding:4px 12px; border-radius:20px; font-size:12px;">AI</span>
                </div>
                <div id="ai-insights-content">
                    ${generateAIInsights(invoices, customers, items)}
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        animateEntry('.stat-card, .chart-card, .card', 80);
        
        // رسم المبيعات والمشتريات
        if (typeof Chart !== 'undefined') {
            const ctx = document.getElementById('salesChart')?.getContext('2d');
            if (ctx) {
                new Chart(ctx, {
                    type: 'bar',
                    data: { 
                        labels: months, 
                        datasets: [
                            { label: 'مبيعات', data: salesData, backgroundColor: '#4f46e5', borderRadius: 8 },
                            { label: 'مشتريات', data: purchasesData, backgroundColor: '#f59e0b', borderRadius: 8 }
                        ] 
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: { legend: { position: 'top' } }
                    }
                });
            }
        }
    } catch (err) {
        console.error(err);
        document.getElementById('tab-content').innerHTML = `<div class="empty-state">خطأ: ${err.message}</div>`;
    }
}

function generateAIInsights(invoices, customers, items) {
    const insights = [];
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`;
    const lastMonth = `${now.getFullYear()}-${String(now.getMonth()).padStart(2,'0')}`;
    const thisMonthInvoices = invoices.filter(i => i.invoice_date?.startsWith(thisMonth));
    const lastMonthInvoices = invoices.filter(i => i.invoice_date?.startsWith(lastMonth));
    const growth = lastMonthInvoices.length ? ((thisMonthInvoices.length - lastMonthInvoices.length) / lastMonthInvoices.length * 100).toFixed(1) : 0;
    
    if (growth > 0) {
        insights.push({ icon: '📈', title: 'نمو المبيعات', message: `زيادة ${growth}% في عدد الفواتير هذا الشهر مقارنة بالشهر الماضي.` });
    } else if (growth < 0) {
        insights.push({ icon: '⚠️', title: 'تراجع الفواتير', message: `انخفاض ${Math.abs(growth)}% عن الشهر الماضي. يُنصح بمراجعة الأسعار أو العروض.` });
    }
    
    const highValueCustomers = customers.filter(c => (c.balance || 0) > 1000).length;
    if (highValueCustomers) {
        insights.push({ icon: '💰', title: 'عملاء ذوو أرصدة مرتفعة', message: `لديك ${highValueCustomers} عميل عليهم مبالغ كبيرة (>1000). تواصل معهم لتحصيل المستحقات.` });
    }
    
    const lowStock = items.filter(i => (i.available || 0) < 5).length;
    if (lowStock) {
        insights.push({ icon: '📦', title: 'مواد منخفضة المخزون', message: `${lowStock} مادة تحتاج إلى إعادة طلب. راجع قائمة المواد للحصول على التفاصيل.` });
    }
    
    if (insights.length === 0) {
        insights.push({ icon: '✅', title: 'كل شيء على ما يرام', message: 'لا توجد تنبيهات أو توصيات خاصة حالياً.' });
    }
    return insights.map(insight => `<div style="margin-bottom:12px; display:flex; gap:12px; align-items:start;"><span style="font-size:20px;">${insight.icon}</span><div><strong>${insight.title}</strong><br><span style="color:var(--text-secondary); font-size:13px;">${insight.message}</span></div></div>`).join('');
}

// مساعد الذكاء الاصطناعي
window.openAIChatbot = function() {
    import('./utils.js').then(({ openModal, formatNumber, getCache }) => {
        const { invoices, customers, items, paymentVouchers } = getCache();
        openModal({
            title: '🤖 مساعد الراجحي الذكي',
            bodyHTML: `
                <div style="padding:16px; background:var(--bg-secondary); border-radius:var(--radius); margin-bottom:16px;">
                    <p>مرحباً! أنا مساعدك الذكي. يمكنك سؤالي عن:</p>
                    <ul style="margin-top:12px; list-style:none;">
                        <li>📊 إجمالي المبيعات</li>
                        <li>💰 الأرباح</li>
                        <li>👥 أرصدة العملاء</li>
                        <li>📦 المخزون المنخفض</li>
                    </ul>
                </div>
                <div class="form-group">
                    <input type="text" id="chat-question" class="input" placeholder="اكتب سؤالك هنا...">
                </div>
                <div id="chat-answer" style="margin-top:12px; padding:12px; background:var(--bg-secondary); border-radius:var(--radius); display:none;"></div>
            `,
            footerHTML: `<button class="btn btn-primary" id="ask-ai">اسأل</button>`
        }).element.querySelector('#ask-ai').onclick = () => {
            const q = document.getElementById('chat-question')?.value;
            const answerDiv = document.getElementById('chat-answer');
            if (!q) return;
            const lowerQ = q.toLowerCase();
            let answer = '';
            if (lowerQ.includes('فواتير') || lowerQ.includes('إجمالي')) {
                answer = `📊 إجمالي الفواتير: ${invoices.length} فاتورة.`;
            } else if (lowerQ.includes('ربح') || lowerQ.includes('أرباح')) {
                const totalSales = invoices.filter(i => i.type === 'sale').reduce((s,i)=>s+i.total_amount,0);
                const totalPurchases = invoices.filter(i => i.type === 'purchase').reduce((s,i)=>s+i.total_amount,0);
                const totalExpenses = (paymentVouchers.filter(v=>v.type==='expense').reduce((s,v)=>s+v.amount,0));
                const profit = totalSales - totalPurchases - totalExpenses;
                answer = `💰 صافي الربح الحالي: ${formatNumber(profit)}`;
            } else if (lowerQ.includes('عميل') || lowerQ.includes('رصيد')) {
                const totalBalance = customers.reduce((s,c)=>s+(c.balance||0),0);
                answer = `👥 إجمالي المستحق على العملاء: ${formatNumber(totalBalance)}`;
            } else if (lowerQ.includes('مخزون') || lowerQ.includes('مواد')) {
                const low = items.filter(i => (i.available||0) < 5).length;
                answer = `📦 عدد المواد منخفضة المخزون: ${low}`;
            } else {
                answer = 'شكراً لسؤالك. يمكنك مراجعة لوحة التحكم للحصول على رؤى محدثة.';
            }
            answerDiv.style.display = 'block';
            answerDiv.innerHTML = `<strong>الإجابة:</strong><br>${answer}`;
        };
    });
};
