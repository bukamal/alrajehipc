// js/db.js - إصدار الراجحي للمحاسبة (SQLite) بنفس أسلوب هوى الشام
import { loadDatabase, saveDatabase } from './sqlite-storage.js';
import { showToast } from './utils.js';

let db = null;
let cache = { customers: [], suppliers: [], items: [], invoices: [], invoiceLines: [], paymentVouchers: [], expenses: [], units: [], itemUnits: [] };
let cacheValid = false;

async function loadSqlJs() {
    if (!window.initSqlJs) {
        return new Promise((resolve, reject) => {
            const check = setInterval(() => {
                if (typeof window.initSqlJs === 'function') {
                    clearInterval(check);
                    resolve(window.initSqlJs);
                }
            }, 50);
            setTimeout(() => {
                clearInterval(check);
                reject(new Error('لم يتم تحميل مكتبة SQL.js بشكل صحيح'));
            }, 10000);
        });
    }
    return window.initSqlJs;
}

async function initDatabase() {
    if (db) return db;
    try {
        const initSqlJs = await loadSqlJs();
        const locateFile = (file) => `lib/${file}`;
        const SQL = await initSqlJs({ locateFile });
        const existingData = await loadDatabase();
        db = new SQL.Database(existingData);
        
        // إنشاء الجداول المحاسبية مع دعم الوحدات
        db.run(`
            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT,
                email TEXT,
                address TEXT,
                balance REAL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS suppliers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT,
                contact_person TEXT,
                balance REAL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS units (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                abbreviation TEXT
            );
            CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT,
                price REAL,
                supplier_id INTEGER,
                description TEXT,
                base_unit_id INTEGER,
                quantity REAL DEFAULT 0,
                average_cost REAL DEFAULT 0,
                purchase_price REAL DEFAULT 0,
                selling_price REAL DEFAULT 0,
                FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
                FOREIGN KEY (base_unit_id) REFERENCES units(id)
            );
            CREATE TABLE IF NOT EXISTS item_units (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id INTEGER NOT NULL,
                unit_id INTEGER NOT NULL,
                conversion_factor REAL NOT NULL,
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
                FOREIGN KEY (unit_id) REFERENCES units(id)
            );
            CREATE TABLE IF NOT EXISTS invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                customer_id INTEGER,
                supplier_id INTEGER,
                invoice_date TEXT NOT NULL,
                due_date TEXT,
                status TEXT DEFAULT 'pending',
                total_amount REAL NOT NULL,
                notes TEXT,
                FOREIGN KEY (customer_id) REFERENCES customers(id),
                FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
            );
            CREATE TABLE IF NOT EXISTS invoice_lines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_id INTEGER NOT NULL,
                item_id INTEGER,
                quantity REAL NOT NULL,
                unit_price REAL NOT NULL,
                total REAL NOT NULL,
                unit_id INTEGER,
                conversion_factor REAL DEFAULT 1,
                quantity_base REAL,
                FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
                FOREIGN KEY (item_id) REFERENCES items(id),
                FOREIGN KEY (unit_id) REFERENCES units(id)
            );
            CREATE TABLE IF NOT EXISTS payment_vouchers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                date TEXT NOT NULL,
                amount REAL NOT NULL,
                description TEXT,
                reference TEXT,
                customer_id INTEGER,
                supplier_id INTEGER,
                invoice_id INTEGER,
                FOREIGN KEY (customer_id) REFERENCES customers(id),
                FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
                FOREIGN KEY (invoice_id) REFERENCES invoices(id)
            );
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                amount REAL NOT NULL,
                category TEXT,
                notes TEXT
            );
        `);
        
        await persistDatabase();
        return db;
    } catch (err) {
        console.error('خطأ في تهيئة قاعدة البيانات:', err);
        throw new Error(`فشل تهيئة قاعدة البيانات: ${err.message}`);
    }
}

async function persistDatabase() {
    if (!db) return;
    const data = db.export();
    await saveDatabase(data);
}

async function exec(sql, params = []) {
    const database = await initDatabase();
    const stmt = database.prepare(sql);
    let result;
    try {
        result = stmt.run(params);
        if (/^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i.test(sql)) {
            await persistDatabase();
            invalidateCache();
        }
        return result;
    } finally {
        stmt.free();
    }
}

async function query(sql, params = []) {
    const database = await initDatabase();
    const stmt = database.prepare(sql);
    const rows = [];
    try {
        stmt.bind(params);
        while (stmt.step()) rows.push(stmt.getAsObject());
    } finally {
        stmt.free();
    }
    return rows;
}

export async function refreshCaches() {
    await initDatabase();
    const [customers, suppliers, units, items, itemUnits, invoices, invoiceLines, vouchers, expenses] = await Promise.all([
        query('SELECT * FROM customers ORDER BY name'),
        query('SELECT * FROM suppliers ORDER BY name'),
        query('SELECT * FROM units ORDER BY name'),
        query('SELECT * FROM items ORDER BY name'),
        query('SELECT * FROM item_units'),
        query('SELECT * FROM invoices ORDER BY id DESC'),
        query('SELECT * FROM invoice_lines'),
        query('SELECT * FROM payment_vouchers ORDER BY id DESC'),
        query('SELECT * FROM expenses ORDER BY id DESC')
    ]);
    
    const itemsWithUnits = items.map(item => {
        const unitsList = itemUnits.filter(iu => iu.item_id === item.id).map(iu => ({
            ...iu,
            unit: units.find(u => u.id === iu.unit_id)
        }));
        return {
            ...item,
            base_unit: units.find(u => u.id === item.base_unit_id),
            item_units: unitsList,
            available: item.quantity || 0
        };
    });
    
    const invoicesWithDetails = invoices.map(inv => {
        const lines = invoiceLines.filter(l => l.invoice_id === inv.id).map(l => {
            const item = itemsWithUnits.find(i => i.id === l.item_id);
            const unit = units.find(u => u.id === l.unit_id);
            return { ...l, item, unit };
        });
        const paid = vouchers.filter(v => v.invoice_id === inv.id && v.type === 'receipt').reduce((s, v) => s + v.amount, 0);
        const balance = (inv.total_amount || 0) - paid;
        const customer = inv.customer_id ? customers.find(c => c.id === inv.customer_id) : null;
        const supplier = inv.supplier_id ? suppliers.find(s => s.id === inv.supplier_id) : null;
        return { ...inv, lines, paid, balance, customer, supplier };
    });
    
    cache = { customers, suppliers, units, items: itemsWithUnits, itemUnits, invoices: invoicesWithDetails, invoiceLines, paymentVouchers: vouchers, expenses };
    cacheValid = true;
}

export function getCache() {
    if (!cacheValid) refreshCaches();
    return cache;
}
export function invalidateCache() { cacheValid = false; }

// ========== العملاء ==========
export async function addCustomer(data) {
    if (!data.name) throw new Error('اسم العميل مطلوب');
    const result = await exec(
        'INSERT INTO customers (name, phone, email, address, balance) VALUES (?,?,?,?,0)',
        [data.name, data.phone || null, data.email || null, data.address || null]
    );
    await refreshCaches();
    return { id: result.lastInsertRowid, ...data };
}

export async function updateCustomer(data) {
    if (!data.id) throw new Error('معرف العميل مطلوب');
    await exec(
        'UPDATE customers SET name=?, phone=?, email=?, address=? WHERE id=?',
        [data.name, data.phone, data.email, data.address, data.id]
    );
    await refreshCaches();
    return data;
}

export async function deleteCustomer(id) {
    const used = await query('SELECT COUNT(*) as count FROM invoices WHERE customer_id = ?', [id]);
    if (used[0].count > 0) throw new Error('لا يمكن حذف العميل لارتباطه بفواتير');
    await exec('DELETE FROM customers WHERE id = ?', [id]);
    await refreshCaches();
    return { success: true };
}

// ========== الموردون ==========
export async function addSupplier(data) {
    if (!data.name) throw new Error('اسم المورد مطلوب');
    const result = await exec(
        'INSERT INTO suppliers (name, phone, contact_person, balance) VALUES (?,?,?,0)',
        [data.name, data.phone || null, data.contact_person || null]
    );
    await refreshCaches();
    return { id: result.lastInsertRowid, ...data };
}

export async function updateSupplier(data) {
    if (!data.id) throw new Error('معرف المورد مطلوب');
    await exec(
        'UPDATE suppliers SET name=?, phone=?, contact_person=? WHERE id=?',
        [data.name, data.phone, data.contact_person, data.id]
    );
    await refreshCaches();
    return data;
}

export async function deleteSupplier(id) {
    const used = await query('SELECT COUNT(*) as count FROM items WHERE supplier_id = ?', [id]);
    if (used[0].count > 0) throw new Error('لا يمكن حذف المورد لارتباطه بمواد');
    const usedInvoices = await query('SELECT COUNT(*) as count FROM invoices WHERE supplier_id = ?', [id]);
    if (usedInvoices[0].count > 0) throw new Error('لا يمكن حذف المورد لارتباطه بفواتير');
    await exec('DELETE FROM suppliers WHERE id = ?', [id]);
    await refreshCaches();
    return { success: true };
}

// ========== الوحدات ==========
export async function addUnit(data) {
    if (!data.name) throw new Error('اسم الوحدة مطلوب');
    const result = await exec(
        'INSERT INTO units (name, abbreviation) VALUES (?,?)',
        [data.name, data.abbreviation || null]
    );
    await refreshCaches();
    return { id: result.lastInsertRowid, ...data };
}

export async function updateUnit(data) {
    if (!data.id) throw new Error('معرف الوحدة مطلوب');
    await exec('UPDATE units SET name=?, abbreviation=? WHERE id=?', [data.name, data.abbreviation, data.id]);
    await refreshCaches();
    return data;
}

export async function deleteUnit(id) {
    const usedAsBase = await query('SELECT COUNT(*) as count FROM items WHERE base_unit_id = ?', [id]);
    if (usedAsBase[0].count > 0) throw new Error('لا يمكن حذف الوحدة لأنها مرتبطة كوحدة أساسية لمواد');
    const usedInItemUnits = await query('SELECT COUNT(*) as count FROM item_units WHERE unit_id = ?', [id]);
    if (usedInItemUnits[0].count > 0) throw new Error('لا يمكن حذف الوحدة لأنها مستخدمة كوحدة فرعية');
    await exec('DELETE FROM units WHERE id = ?', [id]);
    await refreshCaches();
    return { success: true };
}

// ========== المواد ==========
export async function addItem(data) {
    if (!data.name) throw new Error('اسم المادة مطلوب');
    const { name, type, price, supplier_id, description, base_unit_id, quantity, purchase_price, selling_price, item_units = [] } = data;
    const result = await exec(
        `INSERT INTO items (name, type, price, supplier_id, description, base_unit_id, quantity, average_cost, purchase_price, selling_price)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [name, type || 'product', price || 0, supplier_id || null, description || null, base_unit_id || null, quantity || 0, purchase_price || 0, purchase_price || 0, selling_price || 0]
    );
    const itemId = result.lastInsertRowid;
    for (const iu of item_units) {
        await exec('INSERT INTO item_units (item_id, unit_id, conversion_factor) VALUES (?,?,?)', [itemId, iu.unit_id, iu.conversion_factor]);
    }
    await refreshCaches();
    return { id: itemId, ...data };
}

export async function updateItem(data) {
    if (!data.id) throw new Error('معرف المادة مطلوب');
    await exec(
        `UPDATE items SET name=?, type=?, price=?, supplier_id=?, description=?, base_unit_id=?, quantity=?, purchase_price=?, selling_price=?
         WHERE id=?`,
        [data.name, data.type, data.price, data.supplier_id, data.description, data.base_unit_id, data.quantity, data.purchase_price, data.selling_price, data.id]
    );
    await exec('DELETE FROM item_units WHERE item_id = ?', [data.id]);
    for (const iu of data.item_units || []) {
        await exec('INSERT INTO item_units (item_id, unit_id, conversion_factor) VALUES (?,?,?)', [data.id, iu.unit_id, iu.conversion_factor]);
    }
    await refreshCaches();
    return data;
}

export async function deleteItem(id) {
    const used = await query('SELECT COUNT(*) as count FROM invoice_lines WHERE item_id = ?', [id]);
    if (used[0].count > 0) throw new Error('لا يمكن حذف المادة لاستخدامها في فواتير');
    await exec('DELETE FROM item_units WHERE item_id = ?', [id]);
    await exec('DELETE FROM items WHERE id = ?', [id]);
    await refreshCaches();
    return { success: true };
}

// ========== الفواتير ==========
export async function addInvoice(data) {
    const { type, customer_id, supplier_id, invoice_date, due_date, status, total_amount, notes, lines, paid_amount } = data;
    if (!type || !['sale', 'purchase'].includes(type)) throw new Error('نوع الفاتورة غير صحيح');
    if (!lines || lines.length === 0) throw new Error('يجب إضافة بند واحد على الأقل');
    
    if (type === 'sale') {
        for (const line of lines) {
            const item = (await query('SELECT quantity FROM items WHERE id = ?', [line.item_id]))[0];
            const qtyBase = line.quantity * (line.conversion_factor || 1);
            if ((item?.quantity || 0) < qtyBase) {
                const itemName = (await query('SELECT name FROM items WHERE id = ?', [line.item_id]))[0]?.name;
                throw new Error(`المادة "${itemName}" غير متوفرة بالكمية المطلوبة`);
            }
        }
    }
    
    return db.transaction(async () => {
        const invoiceId = (await exec(
            `INSERT INTO invoices (type, customer_id, supplier_id, invoice_date, due_date, status, total_amount, notes)
             VALUES (?,?,?,?,?,?,?,?)`,
            [type, customer_id || null, supplier_id || null, invoice_date, due_date || null, status || 'pending', total_amount, notes || null]
        )).lastInsertRowid;
        
        for (const line of lines) {
            const qtyBase = line.quantity * (line.conversion_factor || 1);
            await exec(
                `INSERT INTO invoice_lines (invoice_id, item_id, quantity, unit_price, total, unit_id, conversion_factor, quantity_base)
                 VALUES (?,?,?,?,?,?,?,?)`,
                [invoiceId, line.item_id || null, line.quantity, line.unit_price, line.total, line.unit_id || null, line.conversion_factor || 1, qtyBase]
            );
            if (line.item_id) {
                const delta = type === 'sale' ? -qtyBase : qtyBase;
                const item = (await query('SELECT quantity, average_cost FROM items WHERE id = ?', [line.item_id]))[0];
                const newQty = (item.quantity || 0) + delta;
                let newAvgCost = item.average_cost;
                if (type === 'purchase' && qtyBase > 0) {
                    const oldCost = item.average_cost || 0;
                    const oldQty = item.quantity || 0;
                    newAvgCost = ((oldQty * oldCost) + (qtyBase * line.unit_price)) / (oldQty + qtyBase);
                }
                await exec('UPDATE items SET quantity = ?, average_cost = ? WHERE id = ?', [newQty, newAvgCost, line.item_id]);
            }
        }
        
        if (paid_amount && paid_amount > 0) {
            await exec(
                `INSERT INTO payment_vouchers (type, date, amount, description, customer_id, supplier_id, invoice_id)
                 VALUES (?,?,?,?,?,?,?)`,
                ['receipt', invoice_date, paid_amount, 'دفعة مقدمة من الفاتورة', customer_id || null, supplier_id || null, invoiceId]
            );
        }
        
        if (type === 'sale' && customer_id) {
            await exec('UPDATE customers SET balance = balance + ? WHERE id = ?', [total_amount - (paid_amount || 0), customer_id]);
        } else if (type === 'purchase' && supplier_id) {
            await exec('UPDATE suppliers SET balance = balance + ? WHERE id = ?', [total_amount - (paid_amount || 0), supplier_id]);
        }
        
        return invoiceId;
    }).then(async (invoiceId) => {
        await refreshCaches();
        return invoiceId;
    });
}

export async function updateInvoice(data) {
    if (!data.id) throw new Error('معرف الفاتورة مطلوب');
    await deleteInvoice(data.id);
    return addInvoice(data);
}

export async function deleteInvoice(id) {
    const invoice = (await query('SELECT * FROM invoices WHERE id = ?', [id]))[0];
    if (!invoice) throw new Error('الفاتورة غير موجودة');
    
    return db.transaction(async () => {
        const lines = await query('SELECT * FROM invoice_lines WHERE invoice_id = ?', [id]);
        for (const line of lines) {
            if (line.item_id) {
                const delta = invoice.type === 'sale' ? line.quantity_base : -line.quantity_base;
                await exec('UPDATE items SET quantity = quantity + ? WHERE id = ?', [delta, line.item_id]);
            }
        }
        if (invoice.type === 'sale' && invoice.customer_id) {
            await exec('UPDATE customers SET balance = balance - ? WHERE id = ?', [invoice.total_amount, invoice.customer_id]);
        } else if (invoice.type === 'purchase' && invoice.supplier_id) {
            await exec('UPDATE suppliers SET balance = balance - ? WHERE id = ?', [invoice.total_amount, invoice.supplier_id]);
        }
        await exec('DELETE FROM payment_vouchers WHERE invoice_id = ?', [id]);
        await exec('DELETE FROM invoice_lines WHERE invoice_id = ?', [id]);
        await exec('DELETE FROM invoices WHERE id = ?', [id]);
    }).then(async () => {
        await refreshCaches();
        return { success: true };
    });
}

// ========== سندات القبض والدفع ==========
export async function addPaymentVoucher(data, options = { allowNegative: false }) {
    const { type, date, amount, description, reference, customer_id, supplier_id, invoice_id } = data;
    if (amount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
    
    if (type === 'receipt' && customer_id) {
        const customer = (await query('SELECT balance FROM customers WHERE id = ?', [customer_id]))[0];
        if (!options.allowNegative && customer && (customer.balance - amount) < 0) {
            throw new Error(`لا يمكن إتمام العملية: سيصبح رصيد العميل سالباً (${customer.balance - amount})`);
        }
    } else if (type === 'payment' && supplier_id) {
        const supplier = (await query('SELECT balance FROM suppliers WHERE id = ?', [supplier_id]))[0];
        if (!options.allowNegative && supplier && (supplier.balance - amount) < 0) {
            throw new Error(`لا يمكن إتمام العملية: سيصبح رصيد المورد سالباً (${supplier.balance - amount})`);
        }
    }
    
    const result = await exec(
        `INSERT INTO payment_vouchers (type, date, amount, description, reference, customer_id, supplier_id, invoice_id)
         VALUES (?,?,?,?,?,?,?,?)`,
        [type, date || new Date().toISOString().slice(0,10), amount, description || null, reference || null, customer_id || null, supplier_id || null, invoice_id || null]
    );
    
    if (type === 'receipt' && customer_id) {
        await exec('UPDATE customers SET balance = balance - ? WHERE id = ?', [amount, customer_id]);
    } else if (type === 'payment' && supplier_id) {
        await exec('UPDATE suppliers SET balance = balance - ? WHERE id = ?', [amount, supplier_id]);
    } else if (type === 'expense') {
        await exec('INSERT INTO expenses (date, amount, category, notes) VALUES (?,?,?,?)', [date, amount, description || 'مصروف', null]);
    }
    
    await refreshCaches();
    return { id: result.lastInsertRowid, ...data };
}

export async function deletePaymentVoucher(id, options = { allowNegative: false }) {
    const voucher = (await query('SELECT * FROM payment_vouchers WHERE id = ?', [id]))[0];
    if (!voucher) throw new Error('السند غير موجود');
    
    if (voucher.type === 'receipt' && voucher.customer_id) {
        const customer = (await query('SELECT balance FROM customers WHERE id = ?', [voucher.customer_id]))[0];
        if (!options.allowNegative && customer && (customer.balance + voucher.amount) < 0) {
            throw new Error('سيصبح رصيد العميل سالباً بعد حذف السند');
        }
        await exec('UPDATE customers SET balance = balance + ? WHERE id = ?', [voucher.amount, voucher.customer_id]);
    } else if (voucher.type === 'payment' && voucher.supplier_id) {
        const supplier = (await query('SELECT balance FROM suppliers WHERE id = ?', [voucher.supplier_id]))[0];
        if (!options.allowNegative && supplier && (supplier.balance + voucher.amount) < 0) {
            throw new Error('سيصبح رصيد المورد سالباً بعد حذف السند');
        }
        await exec('UPDATE suppliers SET balance = balance + ? WHERE id = ?', [voucher.amount, voucher.supplier_id]);
    } else if (voucher.type === 'expense') {
        await exec('DELETE FROM expenses WHERE id = ?', [voucher.id]);
    }
    
    await exec('DELETE FROM payment_vouchers WHERE id = ?', [id]);
    await refreshCaches();
    return { success: true };
}

// ========== المصاريف العامة ==========
export async function addExpense(data) {
    if (!data.amount || data.amount <= 0) throw new Error('المبلغ مطلوب وأكبر من صفر');
    const date = data.date || new Date().toISOString().slice(0,10);
    const result = await exec(
        'INSERT INTO expenses (date, amount, category, notes) VALUES (?,?,?,?)',
        [date, data.amount, data.category || null, data.notes || null]
    );
    await refreshCaches();
    return { id: result.lastInsertRowid, ...data };
}

export async function updateExpense(data) {
    if (!data.id) throw new Error('معرف المصروف مطلوب');
    await exec(
        'UPDATE expenses SET date=?, amount=?, category=?, notes=? WHERE id=?',
        [data.date, data.amount, data.category, data.notes, data.id]
    );
    await refreshCaches();
    return data;
}

export async function deleteExpense(id) {
    await exec('DELETE FROM expenses WHERE id = ?', [id]);
    await refreshCaches();
    return { success: true };
}

// ========== ملخص لوحة التحكم ==========
async function getSummary() {
    await refreshCaches();
    const { invoices, customers, suppliers, expenses, paymentVouchers } = cache;
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0,10);
    
    const invoicesThisMonth = invoices.filter(i => i.invoice_date >= firstDay && i.invoice_date <= lastDay);
    const totalSales = invoicesThisMonth.filter(i => i.type === 'sale').reduce((s, i) => s + i.total_amount, 0);
    const totalPurchases = invoicesThisMonth.filter(i => i.type === 'purchase').reduce((s, i) => s + i.total_amount, 0);
    const totalPaid = paymentVouchers.filter(v => v.type === 'receipt' && v.date >= firstDay && v.date <= lastDay).reduce((s, v) => s + v.amount, 0);
    const totalExpenses = expenses.filter(e => e.date >= firstDay && e.date <= lastDay).reduce((s, e) => s + e.amount, 0);
    const pendingBalance = invoices.reduce((s, i) => s + (i.total_amount - (i.paid || 0)), 0);
    const netProfit = totalSales - totalPurchases - totalExpenses;
    const totalReceivables = customers.reduce((s, c) => s + (c.balance || 0), 0);
    const totalPayables = suppliers.reduce((s, s2) => s + (s2.balance || 0), 0);
    const cashBalance = totalPaid - totalExpenses - (totalPurchases - (paymentVouchers.filter(v => v.type === 'payment').reduce((s,v)=>s+v.amount,0)));
    
    return { totalBookings: invoices.length, totalRevenue: totalSales, totalPaid, pendingBalance, netProfit, totalReceivables, totalPayables, cashBalance };
}

// ========== واجهة API ==========
export async function apiCall(endpoint, method = 'GET', body = {}, options = { allowNegative: false }) {
    await initDatabase();
    if (!cacheValid) await refreshCaches();
    const [path, qs] = endpoint.split('?');
    const params = new URLSearchParams(qs || '');
    const id = params.get('id');
    
    switch (path) {
        case '/summary': return getSummary();
        case '/customers':
            if (method === 'GET') return cache.customers;
            if (method === 'POST') return addCustomer(body);
            if (method === 'PUT') return updateCustomer(body);
            if (method === 'DELETE') return deleteCustomer(id);
            break;
        case '/suppliers':
            if (method === 'GET') return cache.suppliers;
            if (method === 'POST') return addSupplier(body);
            if (method === 'PUT') return updateSupplier(body);
            if (method === 'DELETE') return deleteSupplier(id);
            break;
        case '/units':
            if (method === 'GET') return cache.units;
            if (method === 'POST') return addUnit(body);
            if (method === 'PUT') return updateUnit(body);
            if (method === 'DELETE') return deleteUnit(id);
            break;
        case '/items':
            if (method === 'GET') return cache.items;
            if (method === 'POST') return addItem(body);
            if (method === 'PUT') return updateItem(body);
            if (method === 'DELETE') return deleteItem(id);
            break;
        case '/invoices':
            if (method === 'GET') return cache.invoices;
            if (method === 'POST') return addInvoice(body);
            if (method === 'PUT') return updateInvoice(body);
            if (method === 'DELETE') return deleteInvoice(id);
            break;
        case '/payment_vouchers':
            if (method === 'GET') return cache.paymentVouchers;
            if (method === 'POST') return addPaymentVoucher(body, options);
            if (method === 'DELETE') return deletePaymentVoucher(id, options);
            break;
        case '/expenses':
            if (method === 'GET') return cache.expenses;
            if (method === 'POST') return addExpense(body);
            if (method === 'PUT') return updateExpense(body);
            if (method === 'DELETE') return deleteExpense(id);
            break;
        default: return [];
    }
    return [];
}

export async function ensureDatabase() {
    await initDatabase();
}

export default { apiCall, refreshCaches, getCache, ensureDatabase };
