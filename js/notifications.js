// notifications.js - إشعارات سطح المكتب والتنبيهات
import { showToast } from './utils.js';
import { refreshCaches, getCache } from './db.js';

let notificationPermission = false;
const isElectron = !!window.electronAPI;

export async function requestNotificationPermission() {
    if (isElectron) {
        notificationPermission = true;
        return true;
    }
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') {
        notificationPermission = true;
        return true;
    }
    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        notificationPermission = (permission === 'granted');
        return notificationPermission;
    }
    return false;
}

function showDesktopNotification(title, body, options = {}) {
    if (!notificationPermission && !isElectron) return;
    if (isElectron) {
        window.electronAPI.showBackgroundNotification(title, body, options);
    } else {
        try {
            const notification = new Notification(title, {
                body,
                icon: options.icon || '/icons/icon-512.png',
                silent: options.silent || false,
                requireInteraction: options.requireInteraction || true
            });
            notification.onclick = () => {
                window.focus();
                notification.close();
                if (window.electronAPI) window.electronAPI.focusWindow();
            };
            setTimeout(() => notification.close(), 10000);
        } catch(e) { console.error(e); }
    }
}

function showAggregatedNotifications(alerts) {
    if (!alerts.length) return;
    const passportCount = alerts.filter(a => a.type === 'passport').length;
    const tripCount = alerts.filter(a => a.type === 'trip').length;
    let msg = '';
    if (passportCount) msg += `${passportCount} عميل على وشك انتهاء جواز سفره. `;
    if (tripCount) msg += `${tripCount} رحلة خلال يومين.`;
    showDesktopNotification('⚠️ تنبيهات جديدة', msg, { requireInteraction: false });
}

export async function checkAndNotifyAlerts(showDesktop = true) {
    await refreshCaches();
    const { customers, invoices } = getCache();
    const today = new Date(); today.setHours(0,0,0,0);
    const alerts = [];

    for (const c of customers) {
        if (c.passport_expiry) {
            const expiry = new Date(c.passport_expiry);
            const daysLeft = Math.ceil((expiry - today) / (1000 * 3600 * 24));
            if (daysLeft === 30 || daysLeft === 7 || daysLeft === 1) {
                const msg = daysLeft === 30 ? 'ينتهي بعد شهر' : daysLeft === 7 ? 'ينتهي بعد أسبوع' : 'ينتهي غداً';
                showToast(`⚠️ جواز سفر ${c.name} ${msg}`, 'warning');
                alerts.push({ type: 'passport', client: c, daysLeft });
                if (showDesktop) showDesktopNotification(`جواز سفر ${c.name}`, msg);
            } else if (daysLeft <= 0 && daysLeft > -7) {
                showToast(`❌ جواز سفر ${c.name} منتهي`, 'error');
                alerts.push({ type: 'passport', client: c, daysLeft: 0 });
                if (showDesktop) showDesktopNotification(`❌ جواز سفر منتهي`, `جواز سفر ${c.name} منتهي`);
            }
        }
    }

    for (const inv of invoices) {
        if (inv.due_date && inv.status !== 'cancelled' && (inv.balance || 0) > 0) {
            const due = new Date(inv.due_date);
            const daysLeft = Math.ceil((due - today) / (1000 * 3600 * 24));
            if (daysLeft === 2 || daysLeft === 1 || daysLeft === 0) {
                const msg = daysLeft === 2 ? 'بعد يومين' : daysLeft === 1 ? 'غداً' : 'اليوم';
                const type = daysLeft === 0 ? 'success' : 'info';
                const entity = inv.customer?.name || inv.supplier?.name || '';
                showToast(`💰 فاتورة ${entity} مستحقة ${msg}`, type);
                alerts.push({ type: 'trip', booking: inv, daysLeft });
                if (showDesktop) showDesktopNotification(`فاتورة مستحقة`, `${entity} - ${msg}`);
            }
        }
    }

    if (showDesktop && alerts.length > 3) showAggregatedNotifications(alerts);
    return alerts;
}

export function scheduleAlertChecks() {
    setTimeout(() => checkAndNotifyAlerts(true), 5000);
    setInterval(() => checkAndNotifyAlerts(true), 60 * 60 * 1000);
}
