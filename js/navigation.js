// js/navigation.js - نظام التنقل (بدون حسابات هوى الشام)
import { ICONS, unlockScroll, lockScroll } from './utils.js';

export let currentTab = 'dashboard';
export const tabsConfig = {
    dashboard: { title: 'لوحة التحكم', subtitle: 'نظرة عامة على أداء العمل', icon: ICONS.home },
    items: { title: 'المواد', subtitle: 'إدارة المواد والخدمات', icon: ICONS.box },
    customers: { title: 'العملاء', subtitle: 'إدارة بيانات العملاء', icon: ICONS.users },
    suppliers: { title: 'الموردون', subtitle: 'إدارة الموردين', icon: ICONS.factory },
    invoices: { title: 'الفواتير', subtitle: 'سجل الفواتير والحركات', icon: ICONS.fileText },
    new_invoice: { title: 'فاتورة جديدة', subtitle: 'إنشاء فاتورة بيع أو شراء', icon: ICONS.cart },
    vouchers: { title: 'السندات', subtitle: 'سندات القبض والدفع والمصاريف', icon: ICONS.fileText },
    reports: { title: 'التقارير', subtitle: 'تقارير مالية وإدارية', icon: ICONS.chart },
    settings: { title: 'الإعدادات', subtitle: 'نسخ احتياطي وترخيص', icon: ICONS.settings }
};

const bottomNavTabs = ['dashboard', 'items', 'new_invoice', 'invoices', 'more'];
const moreMenuTabs = ['customers', 'suppliers', 'vouchers', 'reports', 'settings'];

function setActiveTab(tabName) {
    document.querySelectorAll('.nav-item, .bottom-item').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === tabName);
    });
    const cfg = tabsConfig[tabName];
    if (cfg) {
        document.getElementById('page-title').textContent = cfg.title;
        document.getElementById('page-subtitle').textContent = cfg.subtitle;
    }
}

export function navigateTo(tabName) {
    if (tabName === 'more') {
        const moreMenu = document.getElementById('more-menu');
        if (moreMenu) {
            moreMenu.style.display = 'flex';
            moreMenu.style.visibility = 'visible';
            moreMenu.style.opacity = '1';
            moreMenu.style.setProperty('display', 'flex', 'important');
            setTimeout(() => { lockScroll(); }, 10);
        } else {
            console.error('عنصر more-menu غير موجود في DOM');
        }
        return;
    }
    
    currentTab = tabName;
    localStorage.setItem('lastActiveTab', tabName);
    setActiveTab(tabName);
    
    const moreMenu = document.getElementById('more-menu');
    if (moreMenu && moreMenu.style.display === 'flex') {
        moreMenu.style.display = 'none';
        unlockScroll();
    }
    
    document.getElementById('sidebar').classList.remove('open');
    unlockScroll();
    
    const content = document.getElementById('tab-content');
    content.style.opacity = '0';
    content.style.transform = 'translateY(12px)';
    
    setTimeout(async () => {
        try {
            switch (tabName) {
                case 'dashboard': const db = await import('./dashboard.js'); db.loadDashboard(); break;
                case 'items': const it = await import('./items.js'); it.loadItems(); break;
                case 'customers': const cu = await import('./customers.js'); cu.loadCustomers(); break;
                case 'suppliers': const su = await import('./suppliers.js'); su.loadSuppliers(); break;
                case 'invoices': const iv = await import('./invoices.js'); iv.loadInvoices(); break;
                case 'new_invoice': const ni = await import('./invoices.js'); ni.showInvoiceModal(); break;
                case 'vouchers': const vc = await import('./vouchers.js'); vc.loadVouchers(); break;
                case 'reports': const rp = await import('./reports.js'); rp.loadReports(); break;
                case 'settings': const st = await import('./settings.js'); st.loadSettings(); break;
                default: break;
            }
        } catch (e) {
            console.error(e);
            const { showToast } = await import('./utils.js');
            showToast(e.message, 'error');
        }
        content.style.transition = 'all 0.4s';
        content.style.opacity = '1';
        content.style.transform = 'translateY(0)';
    }, 60);
}

export function getLastTab() {
    return localStorage.getItem('lastActiveTab');
}

export function initNavigation() {
    const sidebarNav = document.getElementById('sidebar-nav');
    const sheetGrid = document.getElementById('sheet-grid');
    const allTabs = Object.keys(tabsConfig);
    
    allTabs.forEach(key => {
        const cfg = tabsConfig[key];
        if (!cfg) return;
        const btn = document.createElement('button');
        btn.className = 'nav-item' + (key === 'dashboard' ? ' active' : '');
        btn.dataset.tab = key;
        btn.innerHTML = `${cfg.icon}<span>${cfg.title}</span>`;
        btn.onclick = () => navigateTo(key);
        sidebarNav.appendChild(btn);
    });
    
    moreMenuTabs.forEach(key => {
        const cfg = tabsConfig[key];
        if (!cfg) return;
        const sheetBtn = document.createElement('button');
        sheetBtn.className = 'sheet-item';
        sheetBtn.dataset.tab = key;
        sheetBtn.innerHTML = `${cfg.icon}<span>${cfg.title}</span>`;
        sheetBtn.onclick = () => navigateTo(key);
        sheetGrid.appendChild(sheetBtn);
    });
    
    const bottomItems = document.querySelectorAll('.bottom-item');
    if (bottomItems.length === 0) {
        console.warn('لم يتم العثور على أزرار التنقل السفلي');
        return;
    }
    
    bottomItems.forEach(btn => {
        const tabName = btn.dataset.tab;
        if (tabName && bottomNavTabs.includes(tabName)) {
            btn.onclick = (e) => {
                e.preventDefault();
                navigateTo(tabName);
            };
        } else if (tabName === 'more') {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                navigateTo('more');
            };
        }
    });
    
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });
    }
    
    const sheetBackdrop = document.querySelector('.sheet-backdrop');
    if (sheetBackdrop) {
        sheetBackdrop.addEventListener('click', () => {
            const moreMenu = document.getElementById('more-menu');
            if (moreMenu) {
                moreMenu.style.display = 'none';
                unlockScroll();
            }
        });
    }
    
    const helpBtn = document.getElementById('btn-help');
    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            import('./utils.js').then(m => m.openModal({
                title: 'مركز المساعدة',
                bodyHTML: '<p>نظام الراجحي للمحاسبة</p><p>للإبلاغ عن مشكلة: support@alrajhi.com</p>'
            }));
        });
    }
    
    setTimeout(() => {
        updateSidebarAvatar();
        updateBrandIcon();
    }, 100);
}

function updateSidebarAvatar() {
    const avatar = localStorage.getItem('userAvatar');
    const avatarDiv = document.getElementById('user-avatar');
    if (avatarDiv) {
        if (avatar) avatarDiv.innerHTML = `<img src="${avatar}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">`;
        else avatarDiv.innerHTML = 'م';
    }
}

function updateBrandIcon() {
    const icon = localStorage.getItem('brandIcon');
    const brandIconDiv = document.getElementById('brand-icon');
    if (brandIconDiv) {
        if (icon) brandIconDiv.innerHTML = `<img src="${icon}" style="width:36px;height:36px;border-radius:10px;">`;
        else brandIconDiv.innerHTML = `<svg viewBox="0 0 200 200" width="36" height="36"><rect width="200" height="200" rx="40" fill="#4f46e5"/><text x="100" y="120" fill="white" font-family="'Segoe UI', 'Tajawal'" font-size="110" font-weight="900" text-anchor="middle" dominant-baseline="middle">ر</text><text x="100" y="165" fill="white" font-family="system-ui" font-size="50" text-anchor="middle" dominant-baseline="middle">💰</text></svg>`;
    }
}
