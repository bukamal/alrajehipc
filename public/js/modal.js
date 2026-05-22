// public/js/modal.js
import { ICONS, lockScroll, unlockScroll } from './core.js';

let activeModal = null;

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  let iconSvg = ICONS.info;
  if (type === 'success') iconSvg = ICONS.check;
  if (type === 'error') iconSvg = ICONS.x;
  if (type === 'warning') iconSvg = ICONS.alert;
  toast.innerHTML = `<span class="toast-icon">${iconSvg}</span> ${message}`;
  container.appendChild(toast);
  
  // إزالة تلقائية بعد 3 ثوانٍ
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.35s ease forwards';
    setTimeout(() => toast.remove(), 350);
  }, 3000);
}

export function closeActiveModal() {
  if (!activeModal) return;
  const closeBtn = activeModal.querySelector('.modal-close');
  if (closeBtn) {
    closeBtn.click();
  } else {
    if (activeModal.classList) {
      const box = activeModal.querySelector('.modal-box');
      activeModal.style.animation = 'fadeIn 0.2s ease reverse';
      if (box) box.style.animation = 'slideUp 0.25s ease reverse';
      setTimeout(() => {
        activeModal.remove();
        activeModal = null;
        unlockScroll();
      }, 200);
    }
  }
}

export function openModal({ title, bodyHTML, footerHTML = '', onClose }) {
  const portal = document.getElementById('modal-portal');
  if (activeModal) closeActiveModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" aria-label="إغلاق">${ICONS.x}</button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
      ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
    </div>
  `;
  portal.appendChild(overlay);
  lockScroll();
  activeModal = overlay;

  const box = overlay.querySelector('.modal-box');
  const closeBtn = overlay.querySelector('.modal-close');

  function close() {
    overlay.style.animation = 'fadeIn 0.2s ease reverse';
    box.style.animation = 'slideUp 0.25s ease reverse';
    setTimeout(() => {
      overlay.remove();
      if (activeModal === overlay) activeModal = null;
      unlockScroll();
      if (onClose) onClose();
    }, 200);
  }

  closeBtn.onclick = close;
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  const handleEsc = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', handleEsc, { once: true });
  return { close, element: overlay };
}

export function confirmDialog(message) {
  return new Promise(resolve => {
    const modal = openModal({
      title: 'تأكيد العملية',
      bodyHTML: `<div style="display:flex;gap:14px;align-items:center;padding:8px 0;"><div style="color:var(--warning);flex-shrink:0;">${ICONS.alert}</div><p style="font-size:15px;line-height:1.8;">${message}</p></div>`,
      footerHTML: `<button class="btn btn-secondary" id="confirm-cancel">إلغاء</button><button class="btn btn-danger" id="confirm-ok">تأكيد</button>`,
      onClose: () => resolve(false)
    });
    modal.element.querySelector('#confirm-cancel').onclick = () => { modal.close(); resolve(false); };
    modal.element.querySelector('#confirm-ok').onclick = () => { modal.close(); resolve(true); };
  });
}

export function showFormModal({ title, fields, initialValues = {}, onSave, onSuccess }) {
  const formId = 'form-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
  let body = '';
  fields.forEach(f => {
    const val = initialValues[f.id] !== undefined ? initialValues[f.id] : '';
    if (f.type === 'select') {
      body += `<div class="form-group"><label class="form-label">${f.label}</label><select class="select" id="${formId}-${f.id}">${f.options}</select></div>`;
    } else if (f.type === 'textarea') {
      body += `<div class="form-group"><label class="form-label">${f.label}</label><textarea class="textarea" id="${formId}-${f.id}" placeholder="${f.placeholder || ''}">${val}</textarea></div>`;
    } else {
      body += `<div class="form-group"><label class="form-label">${f.label}</label><input class="input" id="${formId}-${f.id}" type="${f.type || 'text'}" placeholder="${f.placeholder || ''}" value="${val}"></div>`;
    }
  });

  const modal = openModal({
    title,
    bodyHTML: body,
    footerHTML: `<button class="btn btn-secondary" id="${formId}-cancel">إلغاء</button><button class="btn btn-primary" id="${formId}-save">${ICONS.check} حفظ</button>`
  });

  modal.element.querySelector(`#${formId}-cancel`).onclick = () => modal.close();
  modal.element.querySelector(`#${formId}-save`).onclick = async () => {
    const saveBtn = modal.element.querySelector(`#${formId}-save`);
    if (saveBtn.disabled) return;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="loader-inline"></span> جاري الحفظ...`;

    try {
      const values = {};
      fields.forEach(f => {
        const el = modal.element.querySelector(`#${formId}-${f.id}`);
        if (el) values[f.id] = el.value.trim();
      });
      const result = await onSave(values);
      if (result && result.error) throw new Error(result.error.message || result.error);
      modal.close();
      showToast('تم الحفظ بنجاح', 'success');
      if (onSuccess) onSuccess();
    } catch (e) {
      showToast(e.message, 'error');
      saveBtn.disabled = false;
      saveBtn.innerHTML = `${ICONS.check} حفظ`;
    }
  };
}


