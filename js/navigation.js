import { ICONS, unlockScroll } from './core.js';

export let currentTab = 'dashboard';

export const tabsConfig = {
    dashboard: { title: 'لوحة التحكم', subtitle: 'نظرة عامة', icon: ICONS.home, loader: () => import('./dashboard.js').then(m => m.loadDashboard()) },
    items: { title: 'المواد', subtitle: 'إدارة المخزون', icon: ICONS.box, loader: () => import('./items.js').then(m => m.loadItems()) },
    'sale-invoice': { title: 'فاتورة بيع', subtitle: 'إنشاء فاتورة مبيعات', icon: ICONS.cart, loader: () => import('./invoices.js').then(m => m.showInvoiceModal('sale')) },
    'purchase-invoice': { title: 'فاتورة شراء', subtitle: 'إنشاء فاتورة مشتريات', icon: ICONS.download, loader: () => import('./invoices.js').then(m => m.showInvoiceModal('purchase')) },
    customers: { title: 'العملاء', subtitle: 'قائمة العملاء', icon: ICONS.users, loader: () => import('./sections.js').then(m => m.loadGenericSection(m.getSectionOptions('/customers'))) },
    suppliers: { title: 'الموردين', subtitle: 'قائمة الموردين', icon: ICONS.factory, loader: () => import('./sections.js').then(m => m.loadGenericSection(m.getSectionOptions('/suppliers'))) },
    categories: { title: 'التصنيفات', subtitle: 'تصنيفات المواد', icon: ICONS.tag, loader: () => import('./sections.js').then(m => m.loadGenericSection(m.getSectionOptions('/definitions?type=category'))) },
    units: { title: 'الوحدات', subtitle: 'وحدات القياس', icon: ICONS.scale, loader: () => import('./sections.js').then(m => m.loadUnitsSection()) },
    vouchers: { title: 'السندات', subtitle: 'سندات القبض والصرف', icon: ICONS.fileText, loader: () => import('./vouchers.js').then(m => m.loadVouchers()) },
    invoices: { title: 'الفواتير', subtitle: 'سجل الفواتير', icon: ICONS.fileText, loader: () => import('./invoices.js').then(m => m.loadInvoices()) },
    reports: { title: 'التقارير', subtitle: 'التقارير المالية', icon: ICONS.chart, loader: () => import('./reports.js').then(m => m.loadReports()) },
    accounts: { title: 'الحسابات', subtitle: 'إدارة الحسابات', icon: ICONS.wallet, loader: () => import('./accounts.js').then(m => m.loadAccounts()) }
};

export function setActiveTab(tabName) {
    document.querySelectorAll('.nav-item, .bottom-item').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === tabName);
    });
    const cfg = tabsConfig[tabName];
    if (cfg) {
        const title = document.getElementById('page-title');
        const subtitle = document.getElementById('page-subtitle');
        if (title) title.textContent = cfg.title;
        if (subtitle) subtitle.textContent = cfg.subtitle;
    }
}

export async function navigateTo(tabName) {
    if (currentTab === tabName) return;
    currentTab = tabName;
    setActiveTab(tabName);
    
    const moreMenu = document.getElementById('more-menu');
    if (moreMenu) moreMenu.style.display = 'none';
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
    unlockScroll();
    
    const content = document.getElementById('tab-content');
    if (!content) return;
    
    content.style.opacity = '0';
    content.style.transform = 'translateY(12px)';
    
    const cfg = tabsConfig[tabName];
    if (!cfg) {
        content.innerHTML = `<div class="empty-state"><h3>⚠️ غير معروف</h3></div>`;
        content.style.opacity = '1';
        return;
    }
    
    try {
        await cfg.loader();
    } catch (err) {
        console.error(err);
        content.innerHTML = `<div class="empty-state"><h3>⚠️ خطأ</h3><p>${err.message}</p></div>`;
    }
    
    requestAnimationFrame(() => {
        content.style.transition = 'all 0.4s cubic-bezier(0.16,1,0.3,1)';
        content.style.opacity = '1';
        content.style.transform = 'translateY(0)';
    });
}

function showMoreMenu() {
    const menu = document.getElementById('more-menu');
    if (menu) menu.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

export function initNavigation() {
    const sidebarNav = document.getElementById('sidebar-nav');
    const sheetGrid = document.getElementById('sheet-grid');
    if (!sidebarNav) return;
    
    sidebarNav.innerHTML = '';
    if (sheetGrid) sheetGrid.innerHTML = '';
    
    const mainTabs = ['dashboard','items','sale-invoice','purchase-invoice','customers','suppliers','categories','units','vouchers','invoices','reports','accounts'];
    const moreTabs = ['purchase-invoice','customers','suppliers','categories','units','vouchers','reports','accounts'];
    
    mainTabs.forEach(key => {
        const cfg = tabsConfig[key];
        if (!cfg) return;
        const btn = document.createElement('button');
        btn.className = 'nav-item' + (key === 'dashboard' ? ' active' : '');
        btn.dataset.tab = key;
        btn.innerHTML = `${cfg.icon}<span>${cfg.title}</span>`;
        btn.onclick = () => navigateTo(key);
        sidebarNav.appendChild(btn);
    });
    
    if (sheetGrid) {
        moreTabs.forEach(key => {
            const cfg = tabsConfig[key];
            if (!cfg) return;
            const btn = document.createElement('button');
            btn.className = 'sheet-item';
            btn.dataset.tab = key;
            btn.innerHTML = `${cfg.icon}<span>${cfg.title}</span>`;
            btn.onclick = () => { unlockScroll(); navigateTo(key); };
            sheetGrid.appendChild(btn);
        });
    }
    
    const bottomItems = document.querySelectorAll('.bottom-item');
    bottomItems.forEach(btn => {
        const tab = btn.dataset.tab;
        if (tab === 'more') {
            btn.onclick = showMoreMenu;
        } else if (tab) {
            btn.onclick = () => navigateTo(tab);
        }
    });
    
    const toggle = document.getElementById('menu-toggle');
    if (toggle) toggle.onclick = () => document.getElementById('sidebar').classList.toggle('open');
    
    const backdrop = document.querySelector('.sheet-backdrop');
    if (backdrop) backdrop.onclick = () => {
        document.getElementById('more-menu').style.display = 'none';
        unlockScroll();
    };
}
