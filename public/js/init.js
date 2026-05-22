// public/js/init.js - تهيئة التطبيق (نسخة تعمل مع sql-db.js دون الاعتماد على خادم خارجي)
import { apiCall, preloadData } from './core.js';
import { initNavigation } from './navigation.js';
import { loadDashboard } from './dashboard.js';

async function start() {
  // إخفاء شاشة التحميل
  const loading = document.getElementById('loading-screen');
  if (loading) loading.style.display = 'none';

  try {
    // التحقق البسيط (API.verify يعيد { verified: true } دائماً)
    const result = await apiCall('/verify', 'POST', { initData: 'local_user' });
    if (result && result.verified) {
      // تحميل البيانات الأساسية في الخلفية (لتخزينها في cache)
      await preloadData();
      // تهيئة شريط التنقل
      initNavigation();
      // تحميل لوحة التحكم
      loadDashboard();
    } else {
      document.getElementById('tab-content').innerHTML = '<div style="color:red;padding:20px;">فشل التحقق من المستخدم</div>';
    }
  } catch (err) {
    console.error('خطأ في بدء التطبيق:', err);
    document.getElementById('tab-content').innerHTML = `<div style="color:red;padding:20px;">خطأ: ${err.message}</div>`;
  }
}

start();
