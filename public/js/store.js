// public/js/store.js
const store = {
  data: {},
  listeners: {},
  dependencies: {
    customers:        ['invoices'],
    suppliers:        ['invoices'],
    items:            ['invoices'],
    units:            ['items', 'invoices'],
    categories:       ['items', 'invoices'],
    invoices:         ['payments', 'summary', 'customers', 'suppliers', 'items'],
    payments:         ['invoices', 'summary', 'customers', 'suppliers'],
    expenses:         ['summary'],
    summary:          [],
    reports:          [],
    accounts:         ['reports'],
    vouchers:         ['invoices', 'customers', 'suppliers', 'payments', 'expenses']
  }
};

function notifyListeners(key) {
  if (store.listeners[key]) {
    store.listeners[key].forEach(cb => {
      try { cb(); } catch (e) { console.error('Listener error:', e); }
    });
  }
}

export function get(key) {
  return store.data[key];
}

export function set(key, data) {
  store.data[key] = data;
}

export function subscribe(key, callback) {
  if (!store.listeners[key]) {
    store.listeners[key] = [];
  }
  store.listeners[key].push(callback);
  return () => {
    const arr = store.listeners[key];
    if (arr) {
      store.listeners[key] = arr.filter(cb => cb !== callback);
    }
  };
}

function invalidateKey(key) {
  if (!key) return;
  delete store.data[key];
  notifyListeners(key);
  Object.keys(store.data).forEach(k => {
    if (k.startsWith(key + '/') || k.startsWith(key + '_')) {
      delete store.data[k];
      notifyListeners(k);
    }
  });
}

export function invalidate(key) {
  if (!key) return;
  invalidateKey(key);
  const deps = store.dependencies[key] || [];
  const visited = new Set([key]);
  deps.forEach(dep => {
    if (!visited.has(dep)) {
      visited.add(dep);
      invalidateKey(dep);
    }
  });
}

export function clearAll() {
  Object.keys(store.data).forEach(k => {
    delete store.data[k];
    notifyListeners(k);
  });
  store.listeners = {};
}

