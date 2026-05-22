// sql-db.js - قاعدة بيانات SQLite محلية عبر sql.js + IndexedDB (نسخة كاملة ومستقرة)
let db = null;
let dbPromise = null;

export async function initDatabase() {
    if (dbPromise) return dbPromise;
    dbPromise = (async () => {
        while (typeof initSqlJs === 'undefined') {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        const SQL = await initSqlJs({ locateFile: () => '/lib/sql-wasm.wasm' });

        let savedDb = null;
        try {
            const request = indexedDB.open('alrajhi_sqlite', 1);
            const dbFile = await new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const idb = request.result;
                    if (!idb.objectStoreNames.contains('files')) { resolve(null); return; }
                    const tx = idb.transaction('files', 'readonly');
                    const store = tx.objectStore('files');
                    const getReq = store.get('database');
                    getReq.onsuccess = () => resolve(getReq.result);
                    getReq.onerror = () => reject(getReq.error);
                };
                request.onerror = () => reject(request.error);
                request.onupgradeneeded = () => {
                    const idb = request.result;
                    if (!idb.objectStoreNames.contains('files')) idb.createObjectStore('files');
                };
            });
            if (dbFile && dbFile.data) savedDb = new Uint8Array(dbFile.data);
        } catch (e) { console.warn('فشل تحميل من IndexedDB', e); }

        if (savedDb) {
            db = new SQL.Database(savedDb);
        } else {
            db = new SQL.Database();
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
            const defaultAccounts = [
                ['الصندوق','asset'], ['المبيعات','income'], ['المشتريات','expense'],
                ['المخزون','asset'], ['مصاريف عامة','expense'], ['رأس المال','equity']
            ];
            for (const [name, type] of defaultAccounts) {
                db.run(`INSERT OR IGNORE INTO accounts (user_id, name, type, balance) VALUES (?,?,?,0)`, ['local_user', name, type]);
            }
            db.run(`INSERT OR IGNORE INTO users (id, first_name, username) VALUES (?,?,?)`, ['local_user', 'مستخدم محلي', 'local']);
        }
        return db;
    })();
    return dbPromise;
}

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
    const rows = await query('SELECT last_insert_rowid() as id');
    const lastID = rows.length ? rows[0].id : null;
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

// ========== التحقق من التكرار (الوحدات مسموح تكرارها) ==========
async function isDuplicate(table, name, excludeId = null) {
    if (table === 'units') return false;
    const sql = excludeId 
        ? `SELECT id FROM ${table} WHERE user_id = 'local_user' AND LOWER(name) = LOWER(?) AND id != ? LIMIT 1`
        : `SELECT id FROM ${table} WHERE user_id = 'local_user' AND LOWER(name) = LOWER(?) LIMIT 1`;
    const params = excludeId ? [name, excludeId] : [name];
    const rows = await query(sql, params);
    return rows.length > 0;
}

// ========== العملاء ==========
export async function getCustomers() {
    return await query('SELECT * FROM customers WHERE user_id = ? ORDER BY name', ['local_user']);
}
export async function addCustomer({ name, phone, address }) {
    if (await isDuplicate('customers', name)) throw new Error('يوجد عميل بنفس الاسم');
    const res = await run('INSERT INTO customers (user_id, name, phone, address, balance) VALUES (?,?,?,?,0)', 
        ['local_user', name, phone || null, address || null]);
    const rows = await query('SELECT * FROM customers WHERE id = ?', [res.lastID]);
    return rows[0];
}
export async function updateCustomer(id, { name, phone, address }) {
    if (name && await isDuplicate('customers', name, id)) throw new Error('يوجد عميل آخر بنفس الاسم');
    await run('UPDATE customers SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address) WHERE id = ? AND user_id = ?',
        [name, phone, address, id, 'local_user']);
    const rows = await query('SELECT * FROM customers WHERE id = ?', [id]);
    return rows[0];
}
export async function deleteCustomer(id) {
    const used = await query('SELECT id FROM invoices WHERE customer_id = ? LIMIT 1', [id]);
    if (used.length) throw new Error('مرتبط بفواتير');
    await run('DELETE FROM customers WHERE id = ? AND user_id = ?', [id, 'local_user']);
    return { success: true };
}

// ========== الموردين ==========
export async function getSuppliers() {
    return await query('SELECT * FROM suppliers WHERE user_id = ? ORDER BY name', ['local_user']);
}
export async function addSupplier({ name, phone, address }) {
    if (await isDuplicate('suppliers', name)) throw new Error('يوجد مورد بنفس الاسم');
    const res = await run('INSERT INTO suppliers (user_id, name, phone, address, balance) VALUES (?,?,?,?,0)', 
        ['local_user', name, phone || null, address || null]);
    const rows = await query('SELECT * FROM suppliers WHERE id = ?', [res.lastID]);
    return rows[0];
}
export async function updateSupplier(id, { name, phone, address }) {
    if (name && await isDuplicate('suppliers', name, id)) throw new Error('يوجد مورد آخر بنفس الاسم');
    await run('UPDATE suppliers SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address) WHERE id = ? AND user_id = ?',
        [name, phone, address, id, 'local_user']);
    const rows = await query('SELECT * FROM suppliers WHERE id = ?', [id]);
    return rows[0];
}
export async function deleteSupplier(id) {
    const used = await query('SELECT id FROM invoices WHERE supplier_id = ? LIMIT 1', [id]);
    if (used.length) throw new Error('مرتبط بفواتير');
    await run('DELETE FROM suppliers WHERE id = ? AND user_id = ?', [id, 'local_user']);
    return { success: true };
}

// ========== التصنيفات ==========
export async function getCategories() {
    return await query('SELECT * FROM categories WHERE user_id = ? ORDER BY name', ['local_user']);
}
export async function addCategory(name) {
    if (await isDuplicate('categories', name)) throw new Error('يوجد تصنيف بنفس الاسم');
    const res = await run('INSERT INTO categories (user_id, name) VALUES (?,?)', ['local_user', name]);
    const rows = await query('SELECT * FROM categories WHERE id = ?', [res.lastID]);
    return rows[0];
}
export async function updateCategory(id, name) {
    if (await isDuplicate('categories', name, id)) throw new Error('يوجد تصنيف آخر بنفس الاسم');
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

// ========== الوحدات (السماح بتكرار الأسماء) ==========
export async function getUnits() {
    return await query('SELECT * FROM units WHERE user_id = ? ORDER BY name', ['local_user']);
}
export async function addUnit(name, abbreviation) {
    const res = await run('INSERT INTO units (user_id, name, abbreviation) VALUES (?,?,?)', 
        ['local_user', name, abbreviation || null]);
    const rows = await query('SELECT * FROM units WHERE id = ?', [res.lastID]);
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

// ========== المواد (مع التأكد من ظهورها بعد الإضافة) ==========
export async function getItems() {
    try {
        const items = await query('SELECT * FROM items WHERE user_id = ? ORDER BY name', ['local_user']);
        for (const it of items) {
            // جلب بيانات التصنيف
            const cat = await query('SELECT name FROM categories WHERE id = ?', [it.category_id]);
            it.category = cat[0] || null;
            // جلب الوحدة الأساسية
            const base = await query('SELECT name, abbreviation FROM units WHERE id = ?', [it.base_unit_id]);
            it.base_unit = base[0] || null;
            // جلب الوحدات الفرعية
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
    } catch (err) {
        console.error('خطأ في جلب المواد:', err);
        return [];
    }
}
export async function addItem(itemData) {
    const { name, category_id, item_type, purchase_price, selling_price, quantity, base_unit_id, item_units } = itemData;
    if (!name || name.trim() === '') throw new Error('اسم المادة مطلوب');
    if (await isDuplicate('items', name)) throw new Error('توجد مادة بنفس الاسم');
    const avgCost = parseFloat(purchase_price) || 0;
    const qty = parseFloat(quantity) || 0;
    const res = await run(`
        INSERT INTO items (user_id, name, category_id, item_type, purchase_price, selling_price, quantity, base_unit_id, average_cost)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        'local_user', name.trim(),
        category_id ? parseInt(category_id) : null,
        item_type || 'مخزون',
        parseFloat(purchase_price) || 0,
        parseFloat(selling_price) || 0,
        qty,
        base_unit_id ? parseInt(base_unit_id) : null,
        avgCost
    ]);
    const newId = res.lastID;
    if (newId && item_units && Array.isArray(item_units)) {
        for (const iu of item_units) {
            if (iu.unit_id) {
                await run('INSERT INTO item_units (item_id, unit_id, conversion_factor) VALUES (?, ?, ?)',
                    [newId, parseInt(iu.unit_id), parseFloat(iu.conversion_factor) || 1]);
            }
        }
    }
    // إعادة المادة المضافة مع بياناتها الكاملة
    const rows = await query('SELECT * FROM items WHERE id = ?', [newId]);
    if (rows.length === 0) throw new Error('فشل استرجاع المادة بعد الحفظ');
    const newItem = rows[0];
    // إضافة البيانات المرتبطة (تصنيف، وحدة أساسية، وحدات فرعية)
    const cat = await query('SELECT name FROM categories WHERE id = ?', [newItem.category_id]);
    newItem.category = cat[0] || null;
    const base = await query('SELECT name, abbreviation FROM units WHERE id = ?', [newItem.base_unit_id]);
    newItem.base_unit = base[0] || null;
    const ius = await query('SELECT * FROM item_units WHERE item_id = ?', [newId]);
    for (const iu of ius) {
        const u = await query('SELECT name, abbreviation FROM units WHERE id = ?', [iu.unit_id]);
        iu.unit = u[0] || null;
    }
    newItem.item_units = ius;
    newItem.available = newItem.quantity;
    newItem.total_value = newItem.quantity * (newItem.average_cost || 0);
    newItem.purchase_qty = newItem.sale_qty = newItem.purchase_count = newItem.sale_count = 0;
    return newItem;
}
export async function updateItem(id, itemData) {
    const { name, category_id, item_type, purchase_price, selling_price, quantity, base_unit_id, item_units } = itemData;
    if (name && await isDuplicate('items', name, id)) throw new Error('توجد مادة أخرى بنفس الاسم');
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
    `, [
        name, category_id || null, item_type,
        parseFloat(purchase_price) || 0,
        parseFloat(selling_price) || 0,
        parseFloat(quantity) || 0,
        base_unit_id ? parseInt(base_unit_id) : null,
        parseFloat(purchase_price) || 0,
        id, 'local_user'
    ]);
    await run('DELETE FROM item_units WHERE item_id = ?', [id]);
    if (item_units && Array.isArray(item_units)) {
        for (const iu of item_units) {
            if (iu.unit_id) {
                await run('INSERT INTO item_units (item_id, unit_id, conversion_factor) VALUES (?, ?, ?)',
                    [id, parseInt(iu.unit_id), parseFloat(iu.conversion_factor) || 1]);
            }
        }
    }
    const rows = await query('SELECT * FROM items WHERE id = ?', [id]);
    if (rows.length === 0) throw new Error('فشل استرجاع المادة بعد التعديل');
    const updatedItem = rows[0];
    const cat = await query('SELECT name FROM categories WHERE id = ?', [updatedItem.category_id]);
    updatedItem.category = cat[0] || null;
    const base = await query('SELECT name, abbreviation FROM units WHERE id = ?', [updatedItem.base_unit_id]);
    updatedItem.base_unit = base[0] || null;
    const ius = await query('SELECT * FROM item_units WHERE item_id = ?', [id]);
    for (const iu of ius) {
        const u = await query('SELECT name, abbreviation FROM units WHERE id = ?', [iu.unit_id]);
        iu.unit = u[0] || null;
    }
    updatedItem.item_units = ius;
    updatedItem.available = updatedItem.quantity;
    updatedItem.total_value = updatedItem.quantity * (updatedItem.average_cost || 0);
    updatedItem.purchase_qty = updatedItem.sale_qty = updatedItem.purchase_count = updatedItem.sale_count = 0;
    return updatedItem;
}
export async function deleteItem(id) {
    const used = await query('SELECT id FROM invoice_lines WHERE item_id = ? LIMIT 1', [id]);
    if (used.length) throw new Error('المادة مستخدمة في فواتير');
    await run('DELETE FROM item_units WHERE item_id = ?', [id]);
    await run('DELETE FROM items WHERE id = ? AND user_id = ?', [id, 'local_user']);
    return { success: true };
}

// ========== الفواتير (نسخة مبسطة لكنها تعمل) ==========
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
        inv.paid = payments.reduce((s,p) => s + (p.amount || 0), 0);
        inv.balance = inv.total - inv.paid;
    }
    return invoices;
}
export async function createInvoice(invoiceData) {
    const { type, customer_id, supplier_id, date, reference, notes, lines, paid_amount } = invoiceData;
    let total = 0;
    for (const line of lines) total += line.total;
    const res = await run(`
        INSERT INTO invoices (user_id, type, customer_id, supplier_id, date, reference, notes, total, status)
        VALUES (?,?,?,?,?,?,?,?,'posted')
    `, ['local_user', type, customer_id || null, supplier_id || null, date, reference || null, notes || null, total]);
    const invId = res.lastID;
    for (const line of lines) {
        const baseQty = line.quantity * (line.conversion_factor || 1);
        await run(`
            INSERT INTO invoice_lines (invoice_id, item_id, description, quantity, unit_price, total, unit_id, quantity_in_base)
            VALUES (?,?,?,?,?,?,?,?)
        `, [invId, line.item_id || null, line.description || null, line.quantity, line.unit_price, line.total, line.unit_id || null, baseQty]);
        if (line.item_id) {
            if (type === 'purchase') {
                const unitCost = line.unit_price / (line.conversion_factor || 1);
                await run('UPDATE items SET quantity = quantity + ?, average_cost = ((quantity * average_cost) + ? * ?) / (quantity + ?) WHERE id = ?',
                    [baseQty, baseQty, unitCost, baseQty, line.item_id]);
            } else {
                await run('UPDATE items SET quantity = quantity - ? WHERE id = ?', [baseQty, line.item_id]);
            }
        }
    }
    const paid = parseFloat(paid_amount) || 0;
    if (paid > 0) {
        await run(`INSERT INTO payments (user_id, invoice_id, customer_id, supplier_id, amount, payment_date, notes)
                   VALUES (?,?,?,?,?,?,?)`,
                   ['local_user', invId, customer_id || null, supplier_id || null, paid, date, 'دفعة تلقائية']);
        if (type === 'sale' && customer_id) {
            await run('UPDATE customers SET balance = balance + ? WHERE id = ?', [total - paid, customer_id]);
        } else if (type === 'purchase' && supplier_id) {
            await run('UPDATE suppliers SET balance = balance + ? WHERE id = ?', [total - paid, supplier_id]);
        }
    }
    return { id: invId, total };
}
export async function deleteInvoice(id) {
    await run('DELETE FROM invoice_lines WHERE invoice_id = ?', [id]);
    await run('DELETE FROM payments WHERE invoice_id = ?', [id]);
    await run('DELETE FROM invoices WHERE id = ?', [id]);
    return { success: true };
}

// ========== المصاريف ==========
export async function getExpenses() {
    return await query('SELECT * FROM expenses WHERE user_id = ? ORDER BY expense_date DESC', ['local_user']);
}
export async function addExpense({ amount, expense_date, description }) {
    const res = await run('INSERT INTO expenses (user_id, amount, expense_date, description) VALUES (?,?,?,?)',
        ['local_user', amount, expense_date || new Date().toISOString().split('T')[0], description || null]);
    const rows = await query('SELECT * FROM expenses WHERE id = ?', [res.lastID]);
    return rows[0];
}
export async function deleteExpense(id) {
    await run('DELETE FROM expenses WHERE id = ? AND user_id = ?', [id, 'local_user']);
    return { success: true };
}

// ========== السندات ==========
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
    const res = await run(`
        INSERT INTO vouchers (user_id, type, date, amount, description, reference, customer_id, supplier_id, invoice_id)
        VALUES (?,?,?,?,?,?,?,?,?)
    `, ['local_user', type, date, amount, description || null, reference || null, customer_id || null, supplier_id || null, invoice_id || null]);
    if (type === 'receipt' && customer_id) {
        await run('UPDATE customers SET balance = balance + ? WHERE id = ?', [amount, customer_id]);
    } else if (type === 'payment' && supplier_id) {
        await run('UPDATE suppliers SET balance = balance - ? WHERE id = ?', [amount, supplier_id]);
    }
    const rows = await query('SELECT * FROM vouchers WHERE id = ?', [res.lastID]);
    return rows[0];
}
export async function deleteVoucher(id) {
    const v = await query('SELECT * FROM vouchers WHERE id = ?', [id]);
    if (v.length) {
        if (v[0].type === 'receipt' && v[0].customer_id) {
            await run('UPDATE customers SET balance = balance - ? WHERE id = ?', [v[0].amount, v[0].customer_id]);
        } else if (v[0].type === 'payment' && v[0].supplier_id) {
            await run('UPDATE suppliers SET balance = balance + ? WHERE id = ?', [v[0].amount, v[0].supplier_id]);
        }
    }
    await run('DELETE FROM vouchers WHERE id = ?', [id]);
    return { success: true };
}

// ========== الملخص ==========
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
    return {
        net_profit: netProfit,
        cash_balance: 0,
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

// ========== الحسابات ==========
export async function getAccounts() {
    return await query('SELECT * FROM accounts WHERE user_id = ? ORDER BY name', ['local_user']);
}

// ========== التحقق ==========
export async function verify() {
    return { verified: true, user_id: 'local_user' };
}

// التصدير النهائي
export default {
    getCustomers, addCustomer, updateCustomer, deleteCustomer,
    getSuppliers, addSupplier, updateSupplier, deleteSupplier,
    getCategories, addCategory, updateCategory, deleteCategory,
    getUnits, addUnit, updateUnit, deleteUnit,
    getItems, addItem, updateItem, deleteItem,
    getInvoices, createInvoice, deleteInvoice,
    getExpenses, addExpense, deleteExpense,
    getVouchers, addVoucher, deleteVoucher,
    getSummary, getAccounts, verify
};
