let db = null;
let dbInitialized = false;

const IDB_NAME = 'AlrajhiSQLiteStorage';
const IDB_STORE = 'files';
const IDB_KEY = 'alrajhi_database.db';

// حذف قاعدة البيانات القديمة
export async function resetIDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase(IDB_NAME);
        req.onsuccess = () => {
            console.log('IndexedDB deleted');
            resolve();
        };
        req.onerror = () => reject(req.error);
    });
}

async function openIDB() {
    const request = indexedDB.open(IDB_NAME, 1);
    return new Promise((resolve, reject) => {
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const idb = event.target.result;
            if (!idb.objectStoreNames.contains(IDB_STORE)) {
                idb.createObjectStore(IDB_STORE);
            }
        };
    });
}

async function loadDatabaseBinary() {
    const idb = await openIDB();
    if (!idb.objectStoreNames.contains(IDB_STORE)) {
        idb.close();
        throw new Error('Store missing');
    }
    return new Promise((resolve) => {
        const tx = idb.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const get = store.get(IDB_KEY);
        get.onsuccess = () => resolve(get.result ? new Uint8Array(get.result) : null);
        get.onerror = () => resolve(null);
        tx.oncomplete = () => idb.close();
    });
}

async function saveDatabaseBinary(binary) {
    const idb = await openIDB();
    if (!idb.objectStoreNames.contains(IDB_STORE)) {
        idb.close();
        throw new Error('Store missing');
    }
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        const put = store.put(binary, IDB_KEY);
        put.onsuccess = () => resolve();
        put.onerror = () => reject(put.error);
        tx.oncomplete = () => {
            idb.close();
            resolve();
        };
    });
}

export async function initDB() {
    if (dbInitialized) return db;
    
    // محاولة تحميل SQL.js
    if (!window.initSqlJs) {
        throw new Error('SQL.js not loaded. Check lib/sql-wasm.js');
    }
    const SQL = await window.initSqlJs({ locateFile: () => './lib/sql-wasm.wasm' });
    
    let existingBinary = null;
    try {
        existingBinary = await loadDatabaseBinary();
    } catch (err) {
        console.warn('Error loading database, resetting...', err);
        await resetIDB();
        existingBinary = null;
    }
    
    if (existingBinary) {
        db = new SQL.Database(existingBinary);
    } else {
        db = new SQL.Database();
        await createTables();
    }
    dbInitialized = true;
    return db;
}

async function createTables() {
    // ... (نفس الجداول السابقة)
    db.run(`CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT, email TEXT, address TEXT, balance REAL DEFAULT 0, passport_expiry TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT, contact_person TEXT, balance REAL DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS units (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, abbreviation TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category_id INTEGER, item_type TEXT, base_unit_id INTEGER, purchase_price REAL, selling_price REAL, quantity REAL DEFAULT 0, average_cost REAL DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS item_units (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER, unit_id INTEGER, conversion_factor REAL)`);
    db.run(`CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, customer_id INTEGER, supplier_id INTEGER, date TEXT, reference TEXT, notes TEXT, total REAL, status TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS invoice_lines (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id INTEGER, item_id INTEGER, unit_id INTEGER, quantity REAL, unit_price REAL, total REAL, conversion_factor REAL, quantity_in_base REAL)`);
    db.run(`CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id INTEGER, customer_id INTEGER, supplier_id INTEGER, amount REAL, payment_date TEXT, notes TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS vouchers (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, customer_id INTEGER, supplier_id INTEGER, amount REAL, date TEXT, description TEXT, reference TEXT, invoice_id INTEGER)`);
    db.run(`CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, amount REAL, expense_date TEXT, description TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT, balance REAL)`);
    
    const stmt = db.prepare("SELECT COUNT(*) as cnt FROM accounts");
    stmt.step();
    const count = stmt.getAsObject().cnt;
    stmt.free();
    if (count === 0) {
        const defaultAccounts = [
            ['الصندوق', 'asset', 0],
            ['المبيعات', 'income', 0],
            ['المشتريات', 'expense', 0],
            ['المخزون', 'asset', 0],
            ['مصاريف عامة', 'expense', 0],
            ['رأس المال', 'equity', 0]
        ];
        for (const acc of defaultAccounts) {
            db.run(`INSERT INTO accounts (name, type, balance) VALUES (?, ?, ?)`, acc);
        }
    }
    const catStmt = db.prepare("SELECT COUNT(*) as cnt FROM categories");
    catStmt.step();
    const catCount = catStmt.getAsObject().cnt;
    catStmt.free();
    if (catCount === 0) {
        db.run(`INSERT INTO categories (name) VALUES ('عام')`);
    }
    await persistDB();
}

export async function persistDB() {
    if (!db) return;
    const binary = db.export();
    await saveDatabaseBinary(binary);
}

const tableMap = {
    customers:'customers', suppliers:'suppliers', categories:'categories',
    units:'units', items:'items', item_units:'item_units', invoices:'invoices',
    invoice_lines:'invoice_lines', payments:'payments', vouchers:'vouchers',
    expenses:'expenses', accounts:'accounts'
};

export async function getAll(storeName) {
    await initDB();
    const table = tableMap[storeName];
    const stmt = db.prepare(`SELECT * FROM ${table}`);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

export async function get(storeName, id) {
    await initDB();
    const table = tableMap[storeName];
    const stmt = db.prepare(`SELECT * FROM ${table} WHERE id = ?`);
    stmt.bind([id]);
    let row = null;
    if (stmt.step()) row = stmt.getAsObject();
    stmt.free();
    return row;
}

export async function save(storeName, data) {
    await initDB();
    const table = tableMap[storeName];
    if (data.id) {
        const keys = Object.keys(data).filter(k => k !== 'id');
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const values = keys.map(k => data[k]);
        values.push(data.id);
        db.run(`UPDATE ${table} SET ${setClause} WHERE id = ?`, values);
        await persistDB();
        return data.id;
    } else {
        const keys = Object.keys(data);
        const placeholders = keys.map(() => '?').join(', ');
        const values = keys.map(k => data[k]);
        const result = db.run(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`, values);
        await persistDB();
        return result.lastInsertRowid;
    }
}

export async function del(storeName, id) {
    await initDB();
    const table = tableMap[storeName];
    db.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
    await persistDB();
}

export async function getByIndex(storeName, indexName, value) {
    await initDB();
    const table = tableMap[storeName];
    const stmt = db.prepare(`SELECT * FROM ${table} WHERE ${indexName} = ?`);
    stmt.bind([value]);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

export async function clearStore(storeName) {
    await initDB();
    const table = tableMap[storeName];
    db.run(`DELETE FROM ${table}`);
    await persistDB();
}

export async function initializeDefaultData() {
    await initDB();
}
