// sql-db.js - قاعدة بيانات SQLite عبر sql.js + IndexedDB (بديل كامل لـ Flask API)
let db = null;
let dbReady = false;
let dbPromise = null;

// تحميل sql.js وتحميل/إنشاء قاعدة البيانات من IndexedDB
export async function initDatabase() {
    if (dbPromise) return dbPromise;
    dbPromise = (async () => {
        // انتظار تحميل sql.js من النطاق العام (تم تضمينه في index.html)
        while (typeof initSqlJs === 'undefined') {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        const SQL = await initSqlJs({
            locateFile: () => '/lib/sql-wasm.wasm'
        });
        // محاولة استعادة قاعدة البيانات المخزنة في IndexedDB
        let savedDb = null;
        try {
            const request = indexedDB.open('alrajhi_sqlite', 1);
            const dbFile = await new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const idb = request.result;
                    if (!idb.objectStoreNames.contains('files')) {
                        resolve(null);
                        return;
                    }
                    const tx = idb.transaction('files', 'readonly');
                    const store = tx.objectStore('files');
                    const getReq = store.get('database');
                    getReq.onsuccess = () => resolve(getReq.result);
                    getReq.onerror = () => reject(getReq.error);
                };
                request.onerror = () => reject(request.error);
                request.onupgradeneeded = () => {
                    const idb = request.result;
                    if (!idb.objectStoreNames.contains('files')) {
                        idb.createObjectStore('files');
                    }
                };
            });
            if (dbFile && dbFile.data) {
                savedDb = new Uint8Array(dbFile.data);
            }
        } catch(e) { console.warn('Failed to load from IndexedDB', e); }
        
        // إنشاء قاعدة البيانات (من الصفر أو من البيانات المحفوظة)
        if (savedDb) {
            db = new SQL.Database(savedDb);
        } else {
            db = new SQL.Database();
            // إنشاء الجداول
            db.run(`
                CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, first_name TEXT, username TEXT);
                CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, name TEXT NOT NULL, phone TEXT, address TEXT, balance REAL DEFAULT 0);
                CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, name TEXT NOT NULL, phone TEXT, address TEXT, balance REAL DEFAULT 0);
                CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, name TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS units (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, name TEXT NOT NULL, abbreviation TEXT);
                CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, name TEXT NOT NULL, category_id INTEGER, item_type TEXT, purchase_price REAL, selling_price REAL, quantity REAL, base_unit_id INTEGER, average_cost REAL);
                CREATE TABLE IF NOT EXISTS item_units (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER, unit_id INTEGER, conversion_factor REAL);
                CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, type TEXT, customer_id INTEGER, supplier_id INTEGER, date TEXT, reference TEXT, notes TEXT, total REAL, status TEXT);
                CREATE TABLE IF NOT EXISTS invoice_lines (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id INTEGER, item_id INTEGER, description TEXT, quantity REAL, unit_price REAL, total REAL, unit_id INTEGER, quantity_in_base REAL, unit_cost REAL, cost_amount REAL);
                CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, invoice_id INTEGER, customer_id INTEGER, supplier_id INTEGER, amount REAL, payment_date TEXT, notes TEXT, voucher_id INTEGER);
                CREATE TABLE IF NOT EXISTS vouchers (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, type TEXT, date TEXT, amount REAL, description TEXT, reference TEXT, customer_id INTEGER, supplier_id INTEGER, invoice_id INTEGER);
                CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, amount REAL, expense_date TEXT, description TEXT);
                CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, name TEXT, type TEXT, balance REAL);
            `);
            // إدخال الحسابات الافتراضية والمستخدم
            db.run(`INSERT OR IGNORE INTO accounts (user_id, name, type, balance) VALUES (?,?,?,0)`, ['local_user', 'الصندوق', 'asset']);
            db.run(`INSERT OR IGNORE INTO accounts (user_id, name, type, balance) VALUES (?,?,?,0)`, ['local_user', 'المبيعات', 'income']);
            db.run(`INSERT OR IGNORE INTO accounts (user_id, name, type, balance) VALUES (?,?,?,0)`, ['local_user', 'المشتريات', 'expense']);
            db.run(`INSERT OR IGNORE INTO accounts (user_id, name, type, balance) VALUES (?,?,?,0)`, ['local_user', 'المخزون', 'asset']);
            db.run(`INSERT OR IGNORE INTO accounts (user_id, name, type, balance) VALUES (?,?,?,0)`, ['local_user', 'مصاريف عامة', 'expense']);
            db.run(`INSERT OR IGNORE INTO accounts (user_id, name, type, balance) VALUES (?,?,?,0)`, ['local_user', 'رأس المال', 'equity']);
            db.run(`INSERT OR IGNORE INTO users (id, first_name, username) VALUES (?,?,?)`, ['local_user', 'مستخدم محلي', 'local']);
        }
        dbReady = true;
        return db;
    })();
    return dbPromise;
}

// دوال مساعدة لتنفيذ الاستعلامات
export async function query(sql, params = []) {
    const database = await initDatabase();
    const stmt = database.prepare(sql);
    stmt.bind(params);
    const result = [];
    while (stmt.step()) result.push(stmt.getAsObject());
    stmt.free();
    return result;
}

export async function run(sql, params = []) {
    const database = await initDatabase();
    database.run(sql, params);
    const lastID = database.last_insert_rowid();
    // حفظ التغييرات في IndexedDB
    const data = database.export();
    const request = indexedDB.open('alrajhi_sqlite', 1);
    await new Promise((resolve, reject) => {
        request.onsuccess = () => {
            const idb = request.result;
            const tx = idb.transaction('files', 'readwrite');
            const store = tx.objectStore('files');
            store.put({ data: Array.from(data) }, 'database');
            tx.oncomplete = resolve;
            tx.onerror = reject;
        };
        request.onerror = reject;
    });
    return { lastID };
}

// -------------------- العملاء --------------------
export async function getCustomers() {
    return await query('SELECT * FROM customers WHERE user_id = ? ORDER BY name', ['local_user']);
}

export async function addCustomer({ name, phone, address }) {
    const result = await run('INSERT INTO customers (user_id, name, phone, address, balance) VALUES (?,?,?,?,0)', ['local_user', name, phone || null, address || null]);
    const rows = await query('SELECT * FROM customers WHERE id = ?', [result.lastID]);
    return rows[0];
}

export async function updateCustomer(id, { name, phone, address }) {
    await run('UPDATE customers SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address) WHERE id = ? AND user_id = ?',
        [name, phone, address, id, 'local_user']);
    const rows = await query('SELECT * FROM customers WHERE id = ?', [id]);
    return rows[0];
}

export async function deleteCustomer(id) {
    const used = await query('SELECT id FROM invoices WHERE customer_id = ? LIMIT 1', [id]);
    if (used.length) throw new Error('مرتبط بفواتير');
    const pay = await query('SELECT id FROM payments WHERE customer_id = ? LIMIT 1', [id]);
    if (pay.length) throw new Error('مرتبط بدفعات');
    await run('DELETE FROM customers WHERE id = ? AND user_id = ?', [id, 'local_user']);
    return { success: true };
}

// -------------------- الموردين --------------------
export async function getSuppliers() {
    return await query('SELECT * FROM suppliers WHERE user_id = ? ORDER BY name', ['local_user']);
}

export async function addSupplier({ name, phone, address }) {
    const result = await run('INSERT INTO suppliers (user_id, name, phone, address, balance) VALUES (?,?,?,?,0)', ['local_user', name, phone || null, address || null]);
    const rows = await query('SELECT * FROM suppliers WHERE id = ?', [result.lastID]);
    return rows[0];
}

export async function updateSupplier(id, { name, phone, address }) {
    await run('UPDATE suppliers SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address) WHERE id = ? AND user_id = ?',
        [name, phone, address, id, 'local_user']);
    const rows = await query('SELECT * FROM suppliers WHERE id = ?', [id]);
    return rows[0];
}

export async function deleteSupplier(id) {
    const used = await query('SELECT id FROM invoices WHERE supplier_id = ? LIMIT 1', [id]);
    if (used.length) throw new Error('مرتبط بفواتير');
    const pay = await query('SELECT id FROM payments WHERE supplier_id = ? LIMIT 1', [id]);
    if (pay.length) throw new Error('مرتبط بدفعات');
    await run('DELETE FROM suppliers WHERE id = ? AND user_id = ?', [id, 'local_user']);
    return { success: true };
}

// -------------------- التصنيفات والوحدات --------------------
export async function getCategories() {
    return await query('SELECT * FROM categories WHERE user_id = ? ORDER BY name', ['local_user']);
}

export async function addCategory(name) {
    const result = await run('INSERT INTO categories (user_id, name) VALUES (?,?)', ['local_user', name]);
    const rows = await query('SELECT * FROM categories WHERE id = ?', [result.lastID]);
    return rows[0];
}

export async function updateCategory(id, name) {
    await run('UPDATE categories SET name = ? WHERE id = ? AND user_id = ?', [name, id, 'local_user']);
    const rows = await query('SELECT * FROM categories WHERE id = ?', [id]);
    return rows[0];
}

export async function deleteCategory(id) {
    const used = await query('SELECT id FROM items WHERE category_id = ? LIMIT 1', [id]);
    if (used.length) throw new Error('لا يمكن حذف التصنيف لاستخدامه في مواد');
    await run('DELETE FROM categories WHERE id = ? AND user_id = ?', [id, 'local_user']);
    return { success: true };
}

export async function getUnits() {
    return await query('SELECT * FROM units WHERE user_id = ? ORDER BY name', ['local_user']);
}

export async function addUnit(name, abbreviation) {
    const result = await run('INSERT INTO units (user_id, name, abbreviation) VALUES (?,?,?)', ['local_user', name, abbreviation || null]);
    const rows = await query('SELECT * FROM units WHERE id = ?', [result.lastID]);
    return rows[0];
}

export async function updateUnit(id, name, abbreviation) {
    await run('UPDATE units SET name = ?, abbreviation = ? WHERE id = ? AND user_id = ?', [name, abbreviation, id, 'local_user']);
    const rows = await query('SELECT * FROM units WHERE id = ?', [id]);
    return rows[0];
}

export async function deleteUnit(id) {
    const base = await query('SELECT id FROM items WHERE base_unit_id = ? LIMIT 1', [id]);
    if (base.length) throw new Error('الوحدة مستخدمة كوحدة أساسية');
    const iu = await query('SELECT id FROM item_units WHERE unit_id = ? LIMIT 1', [id]);
    if (iu.length) throw new Error('الوحدة مستخدمة في وحدات فرعية');
    await run('DELETE FROM units WHERE id = ? AND user_id = ?', [id, 'local_user']);
    return { success: true };
}

// -------------------- المواد --------------------
export async function getItems() {
    const items = await query('SELECT * FROM items WHERE user_id = ? ORDER BY name', ['local_user']);
    for (const it of items) {
        const cat = await query('SELECT name FROM categories WHERE id = ?', [it.category_id]);
        it.category = cat[0] || null;
        const base = await query('SELECT name, abbreviation FROM units WHERE id = ?', [it.base_unit_id]);
        it.base_unit = base[0] || null;
        const ius = await query('SELECT * FROM item_units WHERE item_id = ?', [it.id]);
        for (const iu of ius) {
            const u = await query('SELECT name, abbreviation FROM units WHERE id = ?', [iu.unit_id]);
            iu.unit = u[0] || null;
        }
        it.item_units = ius;
        it.available = it.quantity;
        it.total_value = it.quantity * (it.average_cost || 0);
        it.purchase_qty = it.sale_qty = it.purchase_count = it.sale_count = 0;
    }
    return items;
}

export async function addItem(itemData) {
    const { name, category_id, item_type, purchase_price, selling_price, quantity, base_unit_id, item_units } = itemData;
    const avgCost = purchase_price || 0;
    const result = await run(`
        INSERT INTO items (user_id, name, category_id, item_type, purchase_price, selling_price, quantity, base_unit_id, average_cost)
        VALUES (?,?,?,?,?,?,?,?,?)
    `, ['local_user', name, category_id || null, item_type || 'مخزون', purchase_price || 0, selling_price || 0, quantity || 0, base_unit_id || null, avgCost]);
    const newId = result.lastID;
    if (item_units && item_units.length) {
        for (const iu of item_units) {
            await run('INSERT INTO item_units (item_id, unit_id, conversion_factor) VALUES (?,?,?)', [newId, iu.unit_id, iu.conversion_factor]);
        }
    }
    const rows = await query('SELECT * FROM items WHERE id = ?', [newId]);
    return rows[0];
}

export async function updateItem(id, itemData) {
    const { name, category_id, item_type, purchase_price, selling_price, quantity, base_unit_id, item_units } = itemData;
    await run(`
        UPDATE items SET
            name = COALESCE(?, name),
            category_id = ?,
            item_type = COALESCE(?, item_type),
            purchase_price = COALESCE(?, purchase_price),
            selling_price = COALESCE(?, selling_price),
            quantity = COALESCE(?, quantity),
            base_unit_id = ?,
            average_cost = COALESCE(?, average_cost)
        WHERE id = ? AND user_id = ?
    `, [name, category_id || null, item_type, purchase_price, selling_price, quantity, base_unit_id || null, purchase_price, id, 'local_user']);
    await run('DELETE FROM item_units WHERE item_id = ?', [id]);
    if (item_units && item_units.length) {
        for (const iu of item_units) {
            await run('INSERT INTO item_units (item_id, unit_id, conversion_factor) VALUES (?,?,?)', [id, iu.unit_id, iu.conversion_factor]);
        }
    }
    const rows = await query('SELECT * FROM items WHERE id = ?', [id]);
    return rows[0];
}

export async function deleteItem(id) {
    const used = await query('SELECT id FROM invoice_lines WHERE item_id = ? LIMIT 1', [id]);
    if (used.length) throw new Error('المادة مستخدمة في فواتير');
    await run('DELETE FROM item_units WHERE item_id = ?', [id]);
    await run('DELETE FROM items WHERE id = ? AND user_id = ?', [id, 'local_user']);
    return { success: true };
}

// -------------------- الفواتير --------------------
// دوال مساعدة للمخزون
async function applyPurchase(itemId, qty, cost) {
    const rows = await query('SELECT quantity, average_cost FROM items WHERE id = ?', [itemId]);
    if (!rows.length) return;
    const oldQty = rows[0].quantity || 0;
    const oldAvg = rows[0].average_cost || 0;
    const newQty = oldQty + qty;
    const newAvg = (oldQty * oldAvg + qty * cost) / (newQty || 1);
    await run('UPDATE items SET quantity = ?, average_cost = ? WHERE id = ?', [newQty, newAvg, itemId]);
}
async function applySale(itemId, qty) {
    const rows = await query('SELECT quantity, average_cost FROM items WHERE id = ?', [itemId]);
    if (!rows.length) return 0;
    if (rows[0].quantity < qty) throw new Error('كمية غير كافية');
    const newQty = rows[0].quantity - qty;
    await run('UPDATE items SET quantity = ? WHERE id = ?', [newQty, itemId]);
    return qty * (rows[0].average_cost || 0);
}
async function updateCustomerBalance(customerId, change) {
    await run('UPDATE customers SET balance = balance + ? WHERE id = ?', [change, customerId]);
}
async function updateSupplierBalance(supplierId, change) {
    await run('UPDATE suppliers SET balance = balance + ? WHERE id = ?', [change, supplierId]);
}

export async function getInvoices() {
    const invoices = await query('SELECT * FROM invoices WHERE user_id = ? ORDER BY date DESC', ['local_user']);
    for (const inv of invoices) {
        if (inv.customer_id) {
            const c = await query('SELECT name FROM customers WHERE id = ?', [inv.customer_id]);
            inv.customer = c[0] || null;
        }
        if (inv.supplier_id) {
            const s = await query('SELECT name FROM suppliers WHERE id = ?', [inv.supplier_id]);
            inv.supplier = s[0] || null;
        }
        const lines = await query('SELECT * FROM invoice_lines WHERE invoice_id = ?', [inv.id]);
        for (const line of lines) {
            if (line.item_id) {
                const item = await query('SELECT name FROM items WHERE id = ?', [line.item_id]);
                line.item = item[0] || null;
            }
            if (line.unit_id) {
                const unit = await query('SELECT name, abbreviation FROM units WHERE id = ?', [line.unit_id]);
                line.unit = unit[0] || null;
            }
        }
        inv.invoice_lines = lines;
        const payments = await query('SELECT amount FROM payments WHERE invoice_id = ?', [inv.id]);
        inv.paid = payments.reduce((s, p) => s + (p.amount || 0), 0);
        inv.balance = inv.total - inv.paid;
    }
    return invoices;
}

export async function createInvoice({ type, customer_id, supplier_id, date, reference, notes, lines, paid_amount }) {
    let total = 0;
    for (const line of lines) total += line.total;
    const result = await run(`
        INSERT INTO invoices (user_id, type, customer_id, supplier_id, date, reference, notes, total, status)
        VALUES (?,?,?,?,?,?,?,?,'posted')
    `, ['local_user', type, customer_id || null, supplier_id || null, date, reference || null, notes || null, total]);
    const invoiceId = result.lastID;
    for (const line of lines) {
        const baseQty = line.quantity * (line.conversion_factor || 1);
        await run(`
            INSERT INTO invoice_lines (invoice_id, item_id, description, quantity, unit_price, total, unit_id, quantity_in_base, unit_cost, cost_amount)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        `, [invoiceId, line.item_id || null, line.description || null, line.quantity, line.unit_price, line.total, line.unit_id || null, baseQty, null, null]);
        if (line.item_id) {
            if (type === 'purchase') {
                const unitCost = line.unit_price / (line.conversion_factor || 1);
                await applyPurchase(line.item_id, baseQty, unitCost);
                await run('UPDATE invoice_lines SET unit_cost = ? WHERE invoice_id = ?', [unitCost, invoiceId]);
            } else {
                const costAmount = await applySale(line.item_id, baseQty);
                await run('UPDATE invoice_lines SET cost_amount = ? WHERE invoice_id = ?', [costAmount, invoiceId]);
            }
        }
    }
    const paid = parseFloat(paid_amount) || 0;
    if (paid > 0) {
        await run(`
            INSERT INTO payments (user_id, invoice_id, customer_id, supplier_id, amount, payment_date, notes)
            VALUES (?,?,?,?,?,?,?)
        `, ['local_user', invoiceId, customer_id || null, supplier_id || null, paid, date, 'دفعة تلقائية']);
    }
    if (type === 'sale' && customer_id) {
        await updateCustomerBalance(customer_id, total - paid);
    } else if (type === 'purchase' && supplier_id) {
        await updateSupplierBalance(supplier_id, total - paid);
    }
    const invs = await query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    return invs[0];
}

export async function deleteInvoice(id) {
    const inv = await query('SELECT * FROM invoices WHERE id = ?', [id]);
    if (!inv.length) throw new Error('الفاتورة غير موجودة');
    const invoice = inv[0];
    const lines = await query('SELECT * FROM invoice_lines WHERE invoice_id = ?', [id]);
    for (const line of lines) {
        if (line.item_id) {
            if (invoice.type === 'purchase') {
                // عكس عملية الشراء (نحتاج إلى الدالة العكسية، نستخدم التطبيق العكسي)
                // سيتم تنفيذها بشكل مبسط لاحقاً
            } else {
                // عكس البيع
            }
        }
    }
    await run('DELETE FROM invoice_lines WHERE invoice_id = ?', [id]);
    await run('DELETE FROM payments WHERE invoice_id = ?', [id]);
    await run('DELETE FROM invoices WHERE id = ?', [id]);
    return { success: true };
}

// -------------------- المصاريف --------------------
export async function getExpenses() {
    return await query('SELECT * FROM expenses WHERE user_id = ? ORDER BY expense_date DESC', ['local_user']);
}
export async function addExpense({ amount, expense_date, description }) {
    const result = await run('INSERT INTO expenses (user_id, amount, expense_date, description) VALUES (?,?,?,?)',
        ['local_user', amount, expense_date || new Date().toISOString().split('T')[0], description || null]);
    const rows = await query('SELECT * FROM expenses WHERE id = ?', [result.lastID]);
    return rows[0];
}
export async function deleteExpense(id) {
    await run('DELETE FROM expenses WHERE id = ? AND user_id = ?', [id, 'local_user']);
    return { success: true };
}

// -------------------- السندات --------------------
export async function getVouchers() {
    const vouchers = await query('SELECT * FROM vouchers WHERE user_id = ? ORDER BY date DESC', ['local_user']);
    for (const v of vouchers) {
        if (v.customer_id) {
            const c = await query('SELECT name FROM customers WHERE id = ?', [v.customer_id]);
            v.customer = c[0] || null;
        }
        if (v.supplier_id) {
            const s = await query('SELECT name FROM suppliers WHERE id = ?', [v.supplier_id]);
            v.supplier = s[0] || null;
        }
    }
    return vouchers;
}
export async function addVoucher({ type, date, amount, description, reference, customer_id, supplier_id, invoice_id }) {
    const result = await run(`
        INSERT INTO vouchers (user_id, type, date, amount, description, reference, customer_id, supplier_id, invoice_id)
        VALUES (?,?,?,?,?,?,?,?,?)
    `, ['local_user', type, date, amount, description || null, reference || null, customer_id || null, supplier_id || null, invoice_id || null]);
    if (type === 'receipt' && customer_id) {
        await updateCustomerBalance(customer_id, amount);
    } else if (type === 'payment' && supplier_id) {
        await updateSupplierBalance(supplier_id, -amount);
    }
    const rows = await query('SELECT * FROM vouchers WHERE id = ?', [result.lastID]);
    return rows[0];
}
export async function deleteVoucher(id) {
    const v = await query('SELECT * FROM vouchers WHERE id = ?', [id]);
    if (!v.length) throw new Error('السند غير موجود');
    const voucher = v[0];
    if (voucher.type === 'receipt' && voucher.customer_id) {
        await updateCustomerBalance(voucher.customer_id, -voucher.amount);
    } else if (voucher.type === 'payment' && voucher.supplier_id) {
        await updateSupplierBalance(voucher.supplier_id, voucher.amount);
    }
    await run('DELETE FROM vouchers WHERE id = ?', [id]);
    return { success: true };
}

// -------------------- الملخص --------------------
export async function getSummary() {
    const totalSales = await query('SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE type="sale" AND user_id=?', ['local_user']);
    const totalPurchases = await query('SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE type="purchase" AND user_id=?', ['local_user']);
    const totalExpenses = await query('SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE user_id=?', ['local_user']);
    const sales = totalSales[0]?.total || 0;
    const purchases = totalPurchases[0]?.total || 0;
    const expenses = totalExpenses[0]?.total || 0;
    const netProfit = sales - purchases - expenses;
    const receivables = await query('SELECT COALESCE(SUM(balance),0) as total FROM customers WHERE user_id=?', ['local_user']);
    const payables = await query('SELECT COALESCE(SUM(balance),0) as total FROM suppliers WHERE user_id=?', ['local_user']);
    const cashBalance = 0;
    return {
        net_profit: netProfit,
        cash_balance: cashBalance,
        receivables: receivables[0]?.total || 0,
        payables: payables[0]?.total || 0,
        daily_cash_balance: 0,
        total_sales: sales,
        total_purchases: purchases,
        cost_of_sales: purchases,
        total_expenses: expenses,
        monthly: { labels: [], sales: [], purchases: [], net_profit: [], expenses: [] },
        daily: { dates: [], profits: [] }
    };
}

// -------------------- الحسابات --------------------
export async function getAccounts() {
    return await query('SELECT * FROM accounts WHERE user_id = ? ORDER BY name', ['local_user']);
}

// -------------------- التحقق --------------------
export async function verify() {
    return { verified: true, user_id: 'local_user' };
}

// -------------------- التصدير الموحد لواجهة API --------------------
const API = {
    // العملاء
    getCustomers, addCustomer, updateCustomer, deleteCustomer,
    // الموردين
    getSuppliers, addSupplier, updateSupplier, deleteSupplier,
    // التصنيفات والوحدات
    getCategories, addCategory, updateCategory, deleteCategory,
    getUnits, addUnit, updateUnit, deleteUnit,
    // المواد
    getItems, addItem, updateItem, deleteItem,
    // الفواتير
    getInvoices, createInvoice, deleteInvoice,
    // المصاريف
    getExpenses, addExpense, deleteExpense,
    // السندات
    getVouchers, addVoucher, deleteVoucher,
    // الملخص والحسابات
    getSummary, getAccounts,
    // التحقق
    verify
};
export default API;
