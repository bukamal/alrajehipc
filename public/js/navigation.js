// navigation.js - إدارة التنقل (تم إخفاء الوحدات من القائمة)
import { ICONS, unlockScroll, lockScroll } from './core.js';
import { loadDashboard } from './dashboard.js';
import { loadItems } from './items.js';
import { loadInvoices, showInvoiceModal } from './invoices.js';
import { loadGenericSection, getSectionOptions } from './sections.js';
import { loadVouchers } from './vouchers.js';
import { loadReports } from './reports.js';
import { loadExpenses } from './expenses.js';

export let currentTab = 'dashboard';

export const tabsConfig = {
  dashboard: { title: 'لوحة التحكم', subtitle: 'نظرة عامة على أداء عملك', icon: ICONS.home },
  items: { title: 'المواد', subtitle: 'إدارة المخزون والمنتجات', icon: ICONS.box },
  'sale-invoice': { title: 'فاتورة بيع', subtitle: 'إنشاء فاتورة مبيعات جديدة', icon: ICONS.cart },
  'purchase-invoice': { title: 'فاتورة شراء', subtitle: 'إنشاء فاتورة مشتريات جديدة', icon: ICONS.download },
  customers: { title: 'العملاء', subtitle: 'قائمة العملاء والذمم المدينة', icon: ICONS.users },
  suppliers: { title: 'الموردين', subtitle: 'قائمة الموردين والذمم الدائنة', icon: ICONS.factory },
  categories: { title: 'التصنيفات', subtitle: 'تصنيفات المواد', icon: ICONS.tag },
  // تم إخفاء الوحدات من القائمة
  // units: { title: 'الوحدات', subtitle: 'وحدات القياس', icon: ICONS.scale },
  vouchers: { title: 'السندات', subtitle: 'سندات القبض والصرف والمصاريف', icon: ICONS.fileText },
  invoices: { title: 'الفواتير', subtitle: 'سجل الفواتير والحركات', icon: ICONS.fileText },
  expenses: { title: 'المصاريف', subtitle: 'تتبع المصاريف التشغيلية', icon: ICONS.dollar },
  reports: { title: 'التقارير', subtitle: 'التقارير المالية والإحصائيات', icon: ICONS.chart }
};

export function setActiveTab(tabName) {
  document.querySelectorAll('.nav-item, .bottom-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tabName);
  });
  const cfg = tabsConfig[tabName];
  if (cfg) {
    document.getElementById('page-title').textContent = cfg.title;
    const subtitleEl = document.getElementById('page-subtitle');
    if (subtitleEl) subtitleEl.textContent = cfg.subtitle || '';
  }
}

export async function navigateTo(tabName) {
  currentTab = tabName;
  setActiveTab(tabName);
  
  const moreMenu = document.getElementById('more-menu');
  if (moreMenu) moreMenu.style.display = 'none';
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open');
  if (document.body.style.position === 'fixed') unlockScroll();

  const content = document.getElementById('tab-content');
  if (!content) return;
  
  content.style.opacity = '0';
  content.style.transform = 'translateY(12px)';

  try {
    switch (tabName) {
      case 'dashboard':
        await loadDashboard();
        break;
      case 'items':
        await loadItems();
        break;
      case 'sale-invoice':
        await showInvoiceModal('sale');
        break;
      case 'purchase-invoice':
        await showInvoiceModal('purchase');
        break;
      case 'customers':
        await loadGenericSection(getSectionOptions('/customers'));
        break;
      case 'suppliers':
        await loadGenericSection(getSectionOptions('/suppliers'));
        break;
      case 'categories':
        await loadGenericSection(getSectionOptions('/definitions?type=category'));
        break;
      // case 'units': // تم إزالته
      //   await loadUnitsSection();
      //   break;
      case 'vouchers':
        await loadVouchers();
        break;
      case 'invoices':
        await loadInvoices();
        break;
      case 'expenses':
        await loadExpenses();
        break;
      case 'reports':
        await loadReports();
        break;
      default:
        content.innerHTML = '<div class="empty-state">قيد التطوير</div>';
    }
  } catch (err) {
    console.error('Navigation error:', err);
    content.innerHTML = `<div class="empty-state" style="color:var(--danger);">خطأ: ${err.message}</div>`;
  }

  requestAnimationFrame(() => {
    content.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    content.style.opacity = '1';
    content.style.transform = 'translateY(0)';
  });
}

function showMoreMenu() {
  const moreMenu = document.getElementById('more-menu');
  if (moreMenu) moreMenu.style.display = 'flex';
  lockScroll();
}

export function initNavigation() {
  const sidebarNav = document.getElementById('sidebar-nav');
  const sheetGrid = document.getElementById('sheet-grid');
  if (!sidebarNav || !sheetGrid) {
    console.error('عناصر التنقل غير موجودة');
    return;
  }

  // الأزرار الرئيسية (بدون الوحدات)
  const mainTabs = [
    'dashboard', 'items', 'sale-invoice', 'purchase-invoice',
    'customers', 'suppliers', 'categories', 'vouchers', 'invoices', 'expenses', 'reports'
  ];
  
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

  // أزرار قائمة "المزيد" (بدون الوحدات)
  const moreTabs = [
    'purchase-invoice', 'customers', 'suppliers', 'categories',
    'vouchers', 'expenses', 'reports'
  ];
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

  // ربط أزرار الشريط السفلي
  document.querySelectorAll('.bottom-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      if (tabName === 'more') showMoreMenu();
      else if (tabName) navigateTo(tabName);
    });
  });

  const menuToggle = document.getElementById('menu-toggle');
  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.toggle('open');
    });
  }

  const moreBackdrop = document.querySelector('.sheet-backdrop');
  if (moreBackdrop) {
    moreBackdrop.addEventListener('click', () => {
      const moreMenu = document.getElementById('more-menu');
      if (moreMenu) moreMenu.style.display = 'none';
      unlockScroll();
    });
  }
}
