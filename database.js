const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');

const dbPath = path.join(app.getPath('userData'), 'alrajhi.sqlite');
const db = new sqlite3.Database(dbPath);

// ======================= دوال مساعدة =======================
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// ======================= إنشاء الجداول =======================
function initTables() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      first_name TEXT,
      username TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      balance REAL DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      balance REAL DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      name TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      name TEXT NOT NULL,
      abbreviation TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      name TEXT NOT NULL,
      category_id INTEGER,
      item_type TEXT DEFAULT 'مخزون',
      purchase_price REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      quantity REAL DEFAULT 0,
      base_unit_id INTEGER,
      average_cost REAL DEFAULT 0,
      FOREIGN KEY(category_id) REFERENCES categories(id),
      FOREIGN KEY(base_unit_id) REFERENCES units(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS item_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER,
      unit_id INTEGER,
      conversion_factor REAL DEFAULT 1,
      FOREIGN KEY(item_id) REFERENCES items(id),
      FOREIGN KEY(unit_id) REFERENCES units(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      type TEXT CHECK(type IN ('sale','purchase')),
      customer_id INTEGER,
      supplier_id INTEGER,
      date TEXT,
      reference TEXT,
      notes TEXT,
      total REAL,
      status TEXT DEFAULT 'posted',
      FOREIGN KEY(customer_id) REFERENCES customers(id),
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS invoice_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER,
      item_id INTEGER,
      description TEXT,
      quantity REAL,
      unit_price REAL,
      total REAL,
      unit_id INTEGER,
      quantity_in_base REAL,
      unit_cost REAL,
      cost_amount REAL,
      FOREIGN KEY(invoice_id) REFERENCES invoices(id),
      FOREIGN KEY(item_id) REFERENCES items(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      invoice_id INTEGER,
      customer_id INTEGER,
      supplier_id INTEGER,
      amount REAL,
      payment_date TEXT,
      notes TEXT,
      voucher_id INTEGER,
      FOREIGN KEY(invoice_id) REFERENCES invoices(id),
      FOREIGN KEY(customer_id) REFERENCES customers(id),
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      type TEXT CHECK(type IN ('receipt','payment','expense')),
      date TEXT,
      amount REAL,
      description TEXT,
      reference TEXT,
      customer_id INTEGER,
      supplier_id INTEGER,
      invoice_id INTEGER,
      FOREIGN KEY(customer_id) REFERENCES customers(id),
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY(invoice_id) REFERENCES invoices(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      amount REAL,
      expense_date TEXT,
      description TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS account_balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_type TEXT,
      entity_id INTEGER,
      as_of_date TEXT,
      balance REAL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      name TEXT NOT NULL,
      type TEXT,
      balance REAL DEFAULT 0
    )`);
  });
}

// ======================= عمليات العملاء =======================
async function getCustomers(userId) {
  return await all(`SELECT * FROM customers WHERE user_id = ? ORDER BY name`, [userId]);
}

async function addCustomer(userId, { name, phone, address }) {
  const result = await run(
    `INSERT INTO customers (user_id, name, phone, address, balance) VALUES (?, ?, ?, ?, 0)`,
    [userId, name, phone || null, address || null]
  );
  const id = result.lastID;
  return await get(`SELECT * FROM customers WHERE id = ?`, [id]);
}

async function updateCustomer(userId, id, { name, phone, address }) {
  await run(
    `UPDATE customers SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address) WHERE id = ? AND user_id = ?`,
    [name, phone, address, id, userId]
  );
  return await get(`SELECT * FROM customers WHERE id = ?`, [id]);
}

async function deleteCustomer(userId, id) {
  const inv = await get(`SELECT id FROM invoices WHERE customer_id = ? LIMIT 1`, [id]);
  if (inv) throw new Error('لا يمكن حذف العميل لارتباطه بفواتير');
  const pay = await get(`SELECT id FROM payments WHERE customer_id = ? LIMIT 1`, [id]);
  if (pay) throw new Error('لا يمكن حذف العميل لارتباطه بدفعات');
  await run(`DELETE FROM customers WHERE id = ? AND user_id = ?`, [id, userId]);
  return { success: true };
}

// ======================= عمليات الموردين =======================
async function getSuppliers(userId) {
  return await all(`SELECT * FROM suppliers WHERE user_id = ? ORDER BY name`, [userId]);
}

async function addSupplier(userId, { name, phone, address }) {
  const result = await run(
    `INSERT INTO suppliers (user_id, name, phone, address, balance) VALUES (?, ?, ?, ?, 0)`,
    [userId, name, phone || null, address || null]
  );
  const id = result.lastID;
  return await get(`SELECT * FROM suppliers WHERE id = ?`, [id]);
}

async function updateSupplier(userId, id, { name, phone, address }) {
  await run(
    `UPDATE suppliers SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address) WHERE id = ? AND user_id = ?`,
    [name, phone, address, id, userId]
  );
  return await get(`SELECT * FROM suppliers WHERE id = ?`, [id]);
}

async function deleteSupplier(userId, id) {
  const inv = await get(`SELECT id FROM invoices WHERE supplier_id = ? LIMIT 1`, [id]);
  if (inv) throw new Error('لا يمكن حذف المورد لارتباطه بفواتير');
  const pay = await get(`SELECT id FROM payments WHERE supplier_id = ? LIMIT 1`, [id]);
  if (pay) throw new Error('لا يمكن حذف المورد لارتباطه بدفعات');
  await run(`DELETE FROM suppliers WHERE id = ? AND user_id = ?`, [id, userId]);
  return { success: true };
}

// ======================= عمليات التصنيفات =======================
async function getCategories(userId) {
  return await all(`SELECT * FROM categories WHERE user_id = ? ORDER BY name`, [userId]);
}

async function addCategory(userId, name) {
  const result = await run(`INSERT INTO categories (user_id, name) VALUES (?, ?)`, [userId, name]);
  const id = result.lastID;
  return await get(`SELECT * FROM categories WHERE id = ?`, [id]);
}

async function updateCategory(userId, id, name) {
  await run(`UPDATE categories SET name = ? WHERE id = ? AND user_id = ?`, [name, id, userId]);
  return await get(`SELECT * FROM categories WHERE id = ?`, [id]);
}

async function deleteCategory(userId, id) {
  const used = await get(`SELECT id FROM items WHERE category_id = ? LIMIT 1`, [id]);
  if (used) throw new Error('لا يمكن حذف التصنيف لاستخدامه في مواد');
  await run(`DELETE FROM categories WHERE id = ? AND user_id = ?`, [id, userId]);
  return { success: true };
}

// ======================= عمليات الوحدات =======================
async function getUnits(userId) {
  return await all(`SELECT * FROM units WHERE user_id = ? ORDER BY name`, [userId]);
}

async function addUnit(userId, name, abbreviation) {
  const result = await run(`INSERT INTO units (user_id, name, abbreviation) VALUES (?, ?, ?)`, [userId, name, abbreviation]);
  const id = result.lastID;
  return await get(`SELECT * FROM units WHERE id = ?`, [id]);
}

async function updateUnit(userId, id, name, abbreviation) {
  await run(`UPDATE units SET name = ?, abbreviation = ? WHERE id = ? AND user_id = ?`, [name, abbreviation, id, userId]);
  return await get(`SELECT * FROM units WHERE id = ?`, [id]);
}

async function deleteUnit(userId, id) {
  const base = await get(`SELECT id FROM items WHERE base_unit_id = ? LIMIT 1`, [id]);
  if (base) throw new Error('لا يمكن حذف الوحدة لأنها وحدة أساسية لمواد');
  const itemUnit = await get(`SELECT id FROM item_units WHERE unit_id = ? LIMIT 1`, [id]);
  if (itemUnit) throw new Error('لا يمكن حذف الوحدة لاستخدامها في وحدات فرعية لمواد');
  await run(`DELETE FROM units WHERE id = ? AND user_id = ?`, [id, userId]);
  return { success: true };
}

// ======================= عمليات المواد =======================
async function getItems(userId) {
  const items = await all(`SELECT * FROM items WHERE user_id = ? ORDER BY name`, [userId]);
  for (const item of items) {
    const category = await get(`SELECT name FROM categories WHERE id = ?`, [item.category_id]);
    item.category = category;
    const baseUnit = await get(`SELECT name, abbreviation FROM units WHERE id = ?`, [item.base_unit_id]);
    item.base_unit = baseUnit;
    const itemUnits = await all(`SELECT * FROM item_units WHERE item_id = ?`, [item.id]);
    for (const iu of itemUnits) {
      const unit = await get(`SELECT name, abbreviation FROM units WHERE id = ?`, [iu.unit_id]);
      iu.unit = unit;
    }
    item.item_units = itemUnits;
    const stats = await getItemStats(item.id);
    Object.assign(item, stats);
  }
  return items;
}

async function getItemStats(itemId) {
  const purchase = await get(`
    SELECT SUM(il.quantity_in_base) as purchase_qty, COUNT(*) as purchase_count, MAX(i.date) as last_purchase_date
    FROM invoice_lines il
    JOIN invoices i ON il.invoice_id = i.id
    WHERE il.item_id = ? AND i.type = 'purchase'
  `, [itemId]);
  const sale = await get(`
    SELECT SUM(il.quantity_in_base) as sale_qty, COUNT(*) as sale_count, MAX(i.date) as last_sale_date
    FROM invoice_lines il
    JOIN invoices i ON il.invoice_id = i.id
    WHERE il.item_id = ? AND i.type = 'sale'
  `, [itemId]);
  const qtyRow = await get(`SELECT quantity, average_cost FROM items WHERE id = ?`, [itemId]);
  return {
    purchase_qty: purchase?.purchase_qty || 0,
    purchase_count: purchase?.purchase_count || 0,
    last_purchase_date: purchase?.last_purchase_date || null,
    sale_qty: sale?.sale_qty || 0,
    sale_count: sale?.sale_count || 0,
    last_sale_date: sale?.last_sale_date || null,
    available: qtyRow?.quantity || 0,
    total_value: (qtyRow?.quantity || 0) * (qtyRow?.average_cost || 0)
  };
}

async function addItem(userId, itemData) {
  const { name, category_id, item_type, purchase_price, selling_price, quantity, base_unit_id, item_units } = itemData;
  const avgCost = purchase_price || 0;
  const result = await run(`
    INSERT INTO items (user_id, name, category_id, item_type, purchase_price, selling_price, quantity, base_unit_id, average_cost)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [userId, name, category_id || null, item_type || 'مخزون', purchase_price || 0, selling_price || 0, quantity || 0, base_unit_id || null, avgCost]);
  const newId = result.lastID;
  if (item_units && item_units.length) {
    for (const iu of item_units) {
      await run(`INSERT INTO item_units (item_id, unit_id, conversion_factor) VALUES (?, ?, ?)`,
        [newId, iu.unit_id, iu.conversion_factor]);
    }
  }
  return await get(`SELECT * FROM items WHERE id = ?`, [newId]);
}

async function updateItem(userId, id, itemData) {
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
  `, [name, category_id || null, item_type, purchase_price, selling_price, quantity, base_unit_id || null, purchase_price, id, userId]);
  await run(`DELETE FROM item_units WHERE item_id = ?`, [id]);
  if (item_units && item_units.length) {
    for (const iu of item_units) {
      await run(`INSERT INTO item_units (item_id, unit_id, conversion_factor) VALUES (?, ?, ?)`,
        [id, iu.unit_id, iu.conversion_factor]);
    }
  }
  return await get(`SELECT * FROM items WHERE id = ?`, [id]);
}

async function deleteItem(userId, id) {
  const used = await get(`SELECT id FROM invoice_lines WHERE item_id = ? LIMIT 1`, [id]);
  if (used) throw new Error('لا يمكن حذف المادة لأنها مستخدمة في فواتير');
  await run(`DELETE FROM item_units WHERE item_id = ?`, [id]);
  await run(`DELETE FROM items WHERE id = ? AND user_id = ?`, [id, userId]);
  return { success: true };
}

// ======================= عمليات المخزون (تطبيق الشراء والبيع) =======================
async function applyPurchaseToItem(itemId, userId, qtyPurchased, unitCost) {
  const row = await get(`SELECT quantity, average_cost FROM items WHERE id = ? AND user_id = ?`, [itemId, userId]);
  if (!row) throw new Error('المادة غير موجودة');
  const oldQty = row.quantity || 0;
  const oldAvg = row.average_cost || 0;
  const newQty = oldQty + qtyPurchased;
  const newAvg = (oldQty * oldAvg + qtyPurchased * unitCost) / newQty;
  await run(`UPDATE items SET quantity = ?, average_cost = ? WHERE id = ? AND user_id = ?`,
    [newQty, newAvg, itemId, userId]);
  return { success: true };
}

async function reversePurchaseFromItem(itemId, userId, qtyPurchased, unitCost) {
  const row = await get(`SELECT quantity, average_cost FROM items WHERE id = ? AND user_id = ?`, [itemId, userId]);
  if (!row) throw new Error('المادة غير موجودة');
  const oldQty = row.quantity || 0;
  const oldAvg = row.average_cost || 0;
  const newQty = oldQty - qtyPurchased;
  let newAvg = oldAvg;
  if (newQty > 0) {
    newAvg = (oldQty * oldAvg - qtyPurchased * unitCost) / newQty;
  } else {
    newAvg = 0;
  }
  await run(`UPDATE items SET quantity = ?, average_cost = ? WHERE id = ? AND user_id = ?`,
    [newQty, newAvg, itemId, userId]);
  return { success: true };
}

async function applySaleToItem(itemId, userId, qtySold) {
  const row = await get(`SELECT quantity FROM items WHERE id = ? AND user_id = ?`, [itemId, userId]);
  if (!row) throw new Error('المادة غير موجودة');
  if (row.quantity < qtySold) throw new Error('كمية غير كافية في المخزون');
  const newQty = row.quantity - qtySold;
  await run(`UPDATE items SET quantity = ? WHERE id = ? AND user_id = ?`, [newQty, itemId, userId]);
  const cost = await get(`SELECT average_cost FROM items WHERE id = ?`, [itemId]);
  const costAmount = qtySold * (cost?.average_cost || 0);
  return costAmount;
}

async function reverseSaleFromItem(itemId, userId, qtySold) {
  const row = await get(`SELECT quantity FROM items WHERE id = ? AND user_id = ?`, [itemId, userId]);
  if (!row) throw new Error('المادة غير موجودة');
  const newQty = row.quantity + qtySold;
  await run(`UPDATE items SET quantity = ? WHERE id = ? AND user_id = ?`, [newQty, itemId, userId]);
  return { success: true };
}

async function updateCustomerBalance(customerId, userId, change) {
  await run(`UPDATE customers SET balance = balance + ? WHERE id = ? AND user_id = ?`, [change, customerId, userId]);
}

async function updateSupplierBalance(supplierId, userId, change) {
  await run(`UPDATE suppliers SET balance = balance + ? WHERE id = ? AND user_id = ?`, [change, supplierId, userId]);
}

// ======================= عمليات الفواتير =======================
async function getInvoices(userId) {
  const invoices = await all(`SELECT * FROM invoices WHERE user_id = ? ORDER BY date DESC`, [userId]);
  for (const inv of invoices) {
    if (inv.customer_id) {
      inv.customer = await get(`SELECT name, phone, address FROM customers WHERE id = ?`, [inv.customer_id]);
    }
    if (inv.supplier_id) {
      inv.supplier = await get(`SELECT name, phone, address FROM suppliers WHERE id = ?`, [inv.supplier_id]);
    }
    inv.invoice_lines = await all(`SELECT * FROM invoice_lines WHERE invoice_id = ?`, [inv.id]);
    for (const line of inv.invoice_lines) {
      if (line.item_id) {
        line.item = await get(`SELECT name FROM items WHERE id = ?`, [line.item_id]);
      }
      if (line.unit_id) {
        line.unit = await get(`SELECT name, abbreviation FROM units WHERE id = ?`, [line.unit_id]);
      }
    }
    const payments = await all(`SELECT amount FROM payments WHERE invoice_id = ?`, [inv.id]);
    inv.paid = payments.reduce((s, p) => s + (p.amount || 0), 0);
    inv.balance = inv.total - inv.paid;
  }
  return invoices;
}

async function createInvoice(userId, { type, customer_id, supplier_id, date, reference, notes, lines, paid_amount }) {
  let total = 0;
  for (const line of lines) total += line.total;
  
  const result = await run(`
    INSERT INTO invoices (user_id, type, customer_id, supplier_id, date, reference, notes, total, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'posted')
  `, [userId, type, customer_id || null, supplier_id || null, date, reference || null, notes || null, total]);
  const invoiceId = result.lastID;
  
  for (const line of lines) {
    const baseQty = line.quantity * (line.conversion_factor || 1);
    await run(`
      INSERT INTO invoice_lines (invoice_id, item_id, description, quantity, unit_price, total, unit_id, quantity_in_base, unit_cost, cost_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [invoiceId, line.item_id || null, line.description || null, line.quantity, line.unit_price, line.total, line.unit_id || null, baseQty, null, null]);
    
    if (line.item_id) {
      if (type === 'purchase') {
        const unitCost = line.unit_price / (line.conversion_factor || 1);
        await applyPurchaseToItem(line.item_id, userId, baseQty, unitCost);
        await run(`UPDATE invoice_lines SET unit_cost = ? WHERE id = ?`, [unitCost, invoiceId]);
      } else if (type === 'sale') {
        const costAmount = await applySaleToItem(line.item_id, userId, baseQty);
        await run(`UPDATE invoice_lines SET cost_amount = ? WHERE id = ?`, [costAmount, invoiceId]);
      }
    }
  }
  
  const paid = parseFloat(paid_amount) || 0;
  if (paid > 0) {
    await run(`
      INSERT INTO payments (user_id, invoice_id, customer_id, supplier_id, amount, payment_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [userId, invoiceId, customer_id || null, supplier_id || null, paid, date, 'دفعة تلقائية من الفاتورة']);
  }
  
  if (type === 'sale' && customer_id) {
    await updateCustomerBalance(customer_id, userId, total - paid);
  } else if (type === 'purchase' && supplier_id) {
    await updateSupplierBalance(supplier_id, userId, total - paid);
  }
  
  return await getInvoiceById(invoiceId);
}

async function updateInvoice(userId, id, { type, customer_id, supplier_id, date, reference, notes, lines, paid_amount }) {
  const oldInvoice = await get(`SELECT * FROM invoices WHERE id = ? AND user_id = ?`, [id, userId]);
  if (!oldInvoice) throw new Error('الفاتورة غير موجودة');
  
  const oldLines = await all(`SELECT * FROM invoice_lines WHERE invoice_id = ?`, [id]);
  for (const line of oldLines) {
    if (line.item_id) {
      const baseQty = line.quantity_in_base || line.quantity;
      if (oldInvoice.type === 'purchase') {
        await reversePurchaseFromItem(line.item_id, userId, baseQty, line.unit_cost);
      } else if (oldInvoice.type === 'sale') {
        await reverseSaleFromItem(line.item_id, userId, baseQty);
      }
    }
  }
  await run(`DELETE FROM invoice_lines WHERE invoice_id = ?`, [id]);
  
  let total = 0;
  for (const line of lines) total += line.total;
  await run(`
    UPDATE invoices SET type = ?, customer_id = ?, supplier_id = ?, date = ?, reference = ?, notes = ?, total = ?
    WHERE id = ? AND user_id = ?
  `, [type, customer_id || null, supplier_id || null, date, reference || null, notes || null, total, id, userId]);
  
  for (const line of lines) {
    const baseQty = line.quantity * (line.conversion_factor || 1);
    await run(`
      INSERT INTO invoice_lines (invoice_id, item_id, description, quantity, unit_price, total, unit_id, quantity_in_base, unit_cost, cost_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, line.item_id || null, line.description || null, line.quantity, line.unit_price, line.total, line.unit_id || null, baseQty, null, null]);
    if (line.item_id) {
      if (type === 'purchase') {
        const unitCost = line.unit_price / (line.conversion_factor || 1);
        await applyPurchaseToItem(line.item_id, userId, baseQty, unitCost);
        await run(`UPDATE invoice_lines SET unit_cost = ? WHERE id = ?`, [unitCost, id]);
      } else if (type === 'sale') {
        const costAmount = await applySaleToItem(line.item_id, userId, baseQty);
        await run(`UPDATE invoice_lines SET cost_amount = ? WHERE id = ?`, [costAmount, id]);
      }
    }
  }
  
  await run(`DELETE FROM payments WHERE invoice_id = ? AND voucher_id IS NULL`, [id]);
  const paid = parseFloat(paid_amount) || 0;
  if (paid > 0) {
    await run(`
      INSERT INTO payments (user_id, invoice_id, customer_id, supplier_id, amount, payment_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [userId, id, customer_id || null, supplier_id || null, paid, date, 'دفعة تلقائية من الفاتورة']);
  }
  
  if (oldInvoice.type === 'sale' && oldInvoice.customer_id) {
    await updateCustomerBalance(oldInvoice.customer_id, userId, -oldInvoice.total);
  } else if (oldInvoice.type === 'purchase' && oldInvoice.supplier_id) {
    await updateSupplierBalance(oldInvoice.supplier_id, userId, -oldInvoice.total);
  }
  if (type === 'sale' && customer_id) {
    await updateCustomerBalance(customer_id, userId, total - paid);
  } else if (type === 'purchase' && supplier_id) {
    await updateSupplierBalance(supplier_id, userId, total - paid);
  }
  
  return await getInvoiceById(id);
}

async function deleteInvoice(userId, id) {
  const invoice = await get(`SELECT * FROM invoices WHERE id = ? AND user_id = ?`, [id, userId]);
  if (!invoice) throw new Error('الفاتورة غير موجودة');
  
  const lines = await all(`SELECT * FROM invoice_lines WHERE invoice_id = ?`, [id]);
  for (const line of lines) {
    if (line.item_id) {
      const baseQty = line.quantity_in_base || line.quantity;
      if (invoice.type === 'purchase') {
        await reversePurchaseFromItem(line.item_id, userId, baseQty, line.unit_cost);
      } else if (invoice.type === 'sale') {
        await reverseSaleFromItem(line.item_id, userId, baseQty);
      }
    }
  }
  
  const payments = await all(`SELECT * FROM payments WHERE invoice_id = ?`, [id]);
  for (const p of payments) {
    if (p.customer_id) await updateCustomerBalance(p.customer_id, userId, p.amount);
    if (p.supplier_id) await updateSupplierBalance(p.supplier_id, userId, p.amount);
  }
  
  if (invoice.type === 'sale' && invoice.customer_id) {
    await updateCustomerBalance(invoice.customer_id, userId, -invoice.total);
  } else if (invoice.type === 'purchase' && invoice.supplier_id) {
    await updateSupplierBalance(invoice.supplier_id, userId, -invoice.total);
  }
  
  await run(`DELETE FROM payments WHERE invoice_id = ?`, [id]);
  await run(`DELETE FROM invoice_lines WHERE invoice_id = ?`, [id]);
  await run(`DELETE FROM invoices WHERE id = ? AND user_id = ?`, [id, userId]);
  return { success: true };
}

async function getInvoiceById(id) {
  const inv = await get(`SELECT * FROM invoices WHERE id = ?`, [id]);
  if (!inv) return null;
  if (inv.customer_id) inv.customer = await get(`SELECT name, phone, address FROM customers WHERE id = ?`, [inv.customer_id]);
  if (inv.supplier_id) inv.supplier = await get(`SELECT name, phone, address FROM suppliers WHERE id = ?`, [inv.supplier_id]);
  inv.invoice_lines = await all(`SELECT * FROM invoice_lines WHERE invoice_id = ?`, [id]);
  for (const line of inv.invoice_lines) {
    if (line.item_id) line.item = await get(`SELECT name FROM items WHERE id = ?`, [line.item_id]);
    if (line.unit_id) line.unit = await get(`SELECT name, abbreviation FROM units WHERE id = ?`, [line.unit_id]);
  }
  const payments = await all(`SELECT amount FROM payments WHERE invoice_id = ?`, [id]);
  inv.paid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  inv.balance = inv.total - inv.paid;
  return inv;
}

// ======================= عمليات المصاريف =======================
async function getExpenses(userId) {
  return await all(`SELECT * FROM expenses WHERE user_id = ? ORDER BY expense_date DESC`, [userId]);
}

async function addExpense(userId, { amount, expense_date, description }) {
  const result = await run(`
    INSERT INTO expenses (user_id, amount, expense_date, description)
    VALUES (?, ?, ?, ?)
  `, [userId, amount, expense_date || new Date().toISOString().split('T')[0], description || null]);
  const id = result.lastID;
  return await get(`SELECT * FROM expenses WHERE id = ?`, [id]);
}

async function deleteExpense(userId, id) {
  await run(`DELETE FROM expenses WHERE id = ? AND user_id = ?`, [id, userId]);
  return { success: true };
}

// ======================= عمليات السندات (vouchers) =======================
async function getVouchers(userId) {
  const vouchers = await all(`SELECT * FROM vouchers WHERE user_id = ? ORDER BY date DESC`, [userId]);
  for (const v of vouchers) {
    if (v.customer_id) v.customer = await get(`SELECT name FROM customers WHERE id = ?`, [v.customer_id]);
    if (v.supplier_id) v.supplier = await get(`SELECT name FROM suppliers WHERE id = ?`, [v.supplier_id]);
  }
  return vouchers;
}

async function createVoucher(userId, { type, date, amount, description, reference, customer_id, supplier_id, invoice_id }) {
  const result = await run(`
    INSERT INTO vouchers (user_id, type, date, amount, description, reference, customer_id, supplier_id, invoice_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [userId, type, date, amount, description || null, reference || null, customer_id || null, supplier_id || null, invoice_id || null]);
  const voucherId = result.lastID;
  
  if (type === 'receipt' && customer_id) {
    await updateCustomerBalance(customer_id, userId, amount);
  } else if (type === 'payment' && supplier_id) {
    await updateSupplierBalance(supplier_id, userId, -amount);
  }
  
  if (invoice_id) {
    await run(`
      INSERT INTO payments (user_id, invoice_id, customer_id, supplier_id, amount, payment_date, notes, voucher_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, invoice_id, customer_id || null, supplier_id || null, amount, date, description || null, voucherId]);
  }
  
  return await get(`SELECT * FROM vouchers WHERE id = ?`, [voucherId]);
}

async function deleteVoucher(userId, voucherId) {
  const voucher = await get(`SELECT * FROM vouchers WHERE id = ? AND user_id = ?`, [voucherId, userId]);
  if (!voucher) throw new Error('السند غير موجود');
  
  if (voucher.type === 'receipt' && voucher.customer_id) {
    await updateCustomerBalance(voucher.customer_id, userId, -voucher.amount);
  } else if (voucher.type === 'payment' && voucher.supplier_id) {
    await updateSupplierBalance(voucher.supplier_id, userId, voucher.amount);
  }
  
  await run(`DELETE FROM payments WHERE voucher_id = ?`, [voucherId]);
  await run(`DELETE FROM vouchers WHERE id = ? AND user_id = ?`, [voucherId, userId]);
  return { success: true };
}

// ======================= عمليات الحسابات (للتقارير) =======================
async function getAccounts(userId) {
  return await all(`SELECT * FROM accounts WHERE user_id = ? ORDER BY name`, [userId]);
}

async function ensureDefaultAccounts(userId) {
  const defaultAccounts = [
    { name: 'الصندوق', type: 'asset' },
    { name: 'المبيعات', type: 'income' },
    { name: 'المشتريات', type: 'expense' },
    { name: 'المخزون', type: 'asset' },
    { name: 'مصاريف عامة', type: 'expense' },
    { name: 'رأس المال', type: 'equity' }
  ];
  for (const acc of defaultAccounts) {
    const existing = await get(`SELECT id FROM accounts WHERE user_id = ? AND name = ?`, [userId, acc.name]);
    if (!existing) {
      await run(`INSERT INTO accounts (user_id, name, type, balance) VALUES (?, ?, ?, 0)`, [userId, acc.name, acc.type]);
    }
  }
}

// ======================= دوال مساعدة للتقارير =======================
async function getBalanceFromTable(accountType, entityId, asOfDate) {
  let sql = `SELECT balance FROM account_balances WHERE account_type = ? AND as_of_date = ?`;
  const params = [accountType, asOfDate];
  if (entityId !== null && entityId !== undefined) {
    sql += ` AND entity_id = ?`;
    params.push(entityId);
  } else {
    sql += ` AND entity_id IS NULL`;
  }
  const row = await get(sql, params);
  return row ? row.balance : 0;
}

async function getTotalCustomerBalance(userId, asOfDate) {
  const total = await get(`SELECT SUM(balance) as total FROM customers WHERE user_id = ?`, [userId]);
  return total?.total || 0;
}

async function getTotalSupplierBalance(userId, asOfDate) {
  const total = await get(`SELECT SUM(balance) as total FROM suppliers WHERE user_id = ?`, [userId]);
  return total?.total || 0;
}

// ======================= التقارير الرئيسية =======================
async function getTrialBalance(userId, asOfDate) {
  const cash = await getBalanceFromTable('cash', null, asOfDate);
  const receivables = await getTotalCustomerBalance(userId, asOfDate);
  const payables = await getTotalSupplierBalance(userId, asOfDate);
  const sales = await getBalanceFromTable('sales', null, asOfDate);
  const purchases = await getBalanceFromTable('purchases', null, asOfDate);
  const expenses = await getBalanceFromTable('expenses', null, asOfDate);
  const totalAssets = cash + receivables;
  const totalLiabilities = payables;
  const equity = totalAssets - totalLiabilities - expenses;
  return [
    { name: 'الصندوق', type: 'asset', total_debit: cash > 0 ? cash : 0, total_credit: cash < 0 ? -cash : 0, balance: cash },
    { name: 'ذمم مدينة (عملاء)', type: 'asset', total_debit: receivables, total_credit: 0, balance: receivables },
    { name: 'ذمم دائنة (موردين)', type: 'liability', total_debit: 0, total_credit: payables, balance: payables },
    { name: 'المبيعات', type: 'income', total_debit: 0, total_credit: sales, balance: sales },
    { name: 'المشتريات', type: 'expense', total_debit: purchases, total_credit: 0, balance: purchases },
    { name: 'مصاريف عامة', type: 'expense', total_debit: expenses, total_credit: 0, balance: expenses },
    { name: 'رأس المال', type: 'equity', total_debit: equity < 0 ? -equity : 0, total_credit: equity > 0 ? equity : 0, balance: equity }
  ];
}

async function getIncomeStatement(userId, asOfDate) {
  const totalIncome = await getBalanceFromTable('sales', null, asOfDate);
  const totalCostOfSales = await getBalanceFromTable('purchases', null, asOfDate);
  const totalGeneralExp = await getBalanceFromTable('expenses', null, asOfDate);
  const totalExpenses = totalCostOfSales + totalGeneralExp;
  const netProfit = totalIncome - totalExpenses;
  return {
    income: [{ name: 'المبيعات', balance: totalIncome }],
    total_income: totalIncome,
    expenses: [
      { name: 'تكلفة المبيعات', balance: totalCostOfSales },
      { name: 'مصاريف عامة', balance: totalGeneralExp }
    ],
    total_expenses: totalExpenses,
    net_profit: netProfit
  };
}

async function getBalanceSheet(userId, asOfDate) {
  const cash = await getBalanceFromTable('cash', null, asOfDate);
  const receivables = await getTotalCustomerBalance(userId, asOfDate);
  const payables = await getTotalSupplierBalance(userId, asOfDate);
  const expenses = await getBalanceFromTable('expenses', null, asOfDate);
  const totalAssets = cash + receivables;
  const totalLiabilities = payables;
  const equity = totalAssets - totalLiabilities - expenses;
  return {
    assets: [{ name: 'الصندوق', balance: cash }, { name: 'ذمم مدينة', balance: receivables }],
    total_assets: totalAssets,
    liabilities: [{ name: 'ذمم دائنة', balance: payables }],
    total_liabilities: payables,
    equity: [{ name: 'رأس المال', balance: equity }],
    total_equity: equity
  };
}

// ======================= ربط المسارات (API Routes) =======================
function setupApiRoutes(app) {
  const getUserId = (initData) => 'local_user';
  
  app.get('/api/customers', async (req, res) => {
    try {
      const userId = getUserId(req.query.initData);
      const data = await getCustomers(userId);
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.post('/api/customers', async (req, res) => {
    try {
      const userId = getUserId(req.body.initData);
      const { name, phone, address } = req.body;
      if (!name) return res.status(400).json({ error: 'اسم العميل مطلوب' });
      const data = await addCustomer(userId, { name, phone, address });
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.put('/api/customers', async (req, res) => {
    try {
      const userId = getUserId(req.body.initData);
      const { id, name, phone, address } = req.body;
      if (!id) return res.status(400).json({ error: 'معرف العميل مطلوب' });
      const data = await updateCustomer(userId, id, { name, phone, address });
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.delete('/api/customers', async (req, res) => {
    try {
      const userId = getUserId(req.query.initData);
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'معرف العميل مطلوب' });
      const result = await deleteCustomer(userId, id);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  
  app.get('/api/suppliers', async (req, res) => {
    try {
      const userId = getUserId(req.query.initData);
      const data = await getSuppliers(userId);
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.post('/api/suppliers', async (req, res) => {
    try {
      const userId = getUserId(req.body.initData);
      const { name, phone, address } = req.body;
      if (!name) return res.status(400).json({ error: 'اسم المورد مطلوب' });
      const data = await addSupplier(userId, { name, phone, address });
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.put('/api/suppliers', async (req, res) => {
    try {
      const userId = getUserId(req.body.initData);
      const { id, name, phone, address } = req.body;
      if (!id) return res.status(400).json({ error: 'معرف المورد مطلوب' });
      const data = await updateSupplier(userId, id, { name, phone, address });
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.delete('/api/suppliers', async (req, res) => {
    try {
      const userId = getUserId(req.query.initData);
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'معرف المورد مطلوب' });
      const result = await deleteSupplier(userId, id);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  
  app.get('/api/definitions', async (req, res) => {
    try {
      const userId = getUserId(req.query.initData);
      const type = req.query.type;
      if (type === 'category') {
        const data = await getCategories(userId);
        res.json(data);
      } else if (type === 'unit') {
        const data = await getUnits(userId);
        res.json(data);
      } else {
        res.status(400).json({ error: 'نوع غير معروف' });
      }
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.post('/api/definitions', async (req, res) => {
    try {
      const userId = getUserId(req.body.initData);
      const { type, name, abbreviation } = req.body;
      if (!name) return res.status(400).json({ error: 'الاسم مطلوب' });
      if (type === 'category') {
        const data = await addCategory(userId, name);
        res.json(data);
      } else if (type === 'unit') {
        const data = await addUnit(userId, name, abbreviation || null);
        res.json(data);
      } else {
        res.status(400).json({ error: 'نوع غير معروف' });
      }
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.put('/api/definitions', async (req, res) => {
    try {
      const userId = getUserId(req.body.initData);
      const { type, id, name, abbreviation } = req.body;
      if (!id) return res.status(400).json({ error: 'المعرف مطلوب' });
      if (type === 'category') {
        const data = await updateCategory(userId, id, name);
        res.json(data);
      } else if (type === 'unit') {
        const data = await updateUnit(userId, id, name, abbreviation);
        res.json(data);
      } else {
        res.status(400).json({ error: 'نوع غير معروف' });
      }
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.delete('/api/definitions', async (req, res) => {
    try {
      const userId = getUserId(req.query.initData);
      const type = req.query.type;
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'المعرف مطلوب' });
      if (type === 'category') {
        const result = await deleteCategory(userId, id);
        res.json(result);
      } else if (type === 'unit') {
        const result = await deleteUnit(userId, id);
        res.json(result);
      } else {
        res.status(400).json({ error: 'نوع غير معروف' });
      }
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  
  app.get('/api/items', async (req, res) => {
    try {
      const userId = getUserId(req.query.initData);
      const data = await getItems(userId);
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.post('/api/items', async (req, res) => {
    try {
      const userId = getUserId(req.body.initData);
      const data = await addItem(userId, req.body);
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.put('/api/items', async (req, res) => {
    try {
      const userId = getUserId(req.body.initData);
      const { id, ...rest } = req.body;
      if (!id) return res.status(400).json({ error: 'معرف المادة مطلوب' });
      const data = await updateItem(userId, id, rest);
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.delete('/api/items', async (req, res) => {
    try {
      const userId = getUserId(req.query.initData);
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'معرف المادة مطلوب' });
      const result = await deleteItem(userId, id);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  
  app.get('/api/invoices', async (req, res) => {
    try {
      const userId = getUserId(req.query.initData);
      const data = await getInvoices(userId);
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.post('/api/invoices', async (req, res) => {
    try {
      const userId = getUserId(req.body.initData);
      const data = await createInvoice(userId, req.body);
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.put('/api/invoices', async (req, res) => {
    try {
      const userId = getUserId(req.body.initData);
      const { id, ...rest } = req.body;
      if (!id) return res.status(400).json({ error: 'معرف الفاتورة مطلوب' });
      const data = await updateInvoice(userId, id, rest);
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.delete('/api/invoices', async (req, res) => {
    try {
      const userId = getUserId(req.query.initData);
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'معرف الفاتورة مطلوب' });
      const result = await deleteInvoice(userId, id);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  
  app.get('/api/expenses', async (req, res) => {
    try {
      const userId = getUserId(req.query.initData);
      const data = await getExpenses(userId);
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.post('/api/expenses', async (req, res) => {
    try {
      const userId = getUserId(req.body.initData);
      const { amount, expense_date, description } = req.body;
      if (!amount) return res.status(400).json({ error: 'المبلغ مطلوب' });
      const data = await addExpense(userId, { amount, expense_date, description });
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.delete('/api/expenses', async (req, res) => {
    try {
      const userId = getUserId(req.query.initData);
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'معرف المصروف مطلوب' });
      const result = await deleteExpense(userId, id);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  
  app.get('/api/payments', async (req, res) => {
    try {
      const userId = getUserId(req.query.initData);
      const isVoucher = req.query.voucher === '1';
      if (isVoucher) {
        const data = await getVouchers(userId);
        res.json(data);
      } else {
        const data = await all(`SELECT * FROM payments WHERE user_id = ? ORDER BY payment_date DESC`, [userId]);
        for (const p of data) {
          if (p.customer_id) p.customer = await get(`SELECT name FROM customers WHERE id = ?`, [p.customer_id]);
          if (p.supplier_id) p.supplier = await get(`SELECT name FROM suppliers WHERE id = ?`, [p.supplier_id]);
          if (p.invoice_id) p.invoice = await get(`SELECT reference, type FROM invoices WHERE id = ?`, [p.invoice_id]);
        }
        res.json(data);
      }
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.post('/api/payments', async (req, res) => {
    try {
      const userId = getUserId(req.body.initData);
      const isVoucher = req.body.voucher === true;
      if (isVoucher) {
        const data = await createVoucher(userId, req.body);
        res.json(data);
      } else {
        res.status(405).json({ error: 'لا يمكن إضافة دفعة مباشرة. استخدم السندات.' });
      }
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.delete('/api/payments', async (req, res) => {
    try {
      const userId = getUserId(req.query.initData);
      const isVoucher = req.query.voucher === '1';
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'معرف مطلوب' });
      if (isVoucher) {
        const result = await deleteVoucher(userId, id);
        res.json(result);
      } else {
        const payment = await get(`SELECT * FROM payments WHERE id = ? AND user_id = ?`, [id, userId]);
        if (!payment) return res.status(404).json({ error: 'الدفعة غير موجودة' });
        if (payment.customer_id) await updateCustomerBalance(payment.customer_id, userId, payment.amount);
        if (payment.supplier_id) await updateSupplierBalance(payment.supplier_id, userId, payment.amount);
        await run(`DELETE FROM payments WHERE id = ? AND user_id = ?`, [id, userId]);
        res.json({ success: true });
      }
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  
  app.get('/api/reports', async (req, res) => {
    try {
      const userId = getUserId(req.query.initData);
      const type = req.query.type;
      const asOfDate = req.query.as_of_date || new Date().toISOString().split('T')[0];
      if (type === 'trial_balance') {
        const data = await getTrialBalance(userId, asOfDate);
        res.json(data);
      } else if (type === 'income_statement') {
        const data = await getIncomeStatement(userId, asOfDate);
        res.json(data);
      } else if (type === 'balance_sheet') {
        const data = await getBalanceSheet(userId, asOfDate);
        res.json(data);
      } else if (type === 'account_ledger') {
        const accountId = req.query.account_id;
        if (!accountId) return res.status(400).json({ error: 'account_id مطلوب' });
        res.json([]);
      } else if (type === 'customer_statement') {
        const customerId = req.query.customer_id;
        if (!customerId) return res.status(400).json({ error: 'customer_id مطلوب' });
        res.json([]);
      } else if (type === 'supplier_statement') {
        const supplierId = req.query.supplier_id;
        if (!supplierId) return res.status(400).json({ error: 'supplier_id مطلوب' });
        res.json([]);
      } else {
        res.status(400).json({ error: 'نوع تقرير غير معروف' });
      }
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  
  app.get('/api/summary', async (req, res) => {
    try {
      const userId = getUserId(req.query.initData);
      const asOfDate = req.query.as_of_date || new Date().toISOString().split('T')[0];
      const cashBalance = await getBalanceFromTable('cash', null, asOfDate);
      const receivables = await getTotalCustomerBalance(userId, asOfDate);
      const payables = await getTotalSupplierBalance(userId, asOfDate);
      const totalSales = await getBalanceFromTable('sales', null, asOfDate);
      const totalPurchases = await getBalanceFromTable('purchases', null, asOfDate);
      const totalGeneralExpenses = await getBalanceFromTable('expenses', null, asOfDate);
      const costOfSales = totalPurchases;
      const netProfit = totalSales - costOfSales - totalGeneralExpenses;
      res.json({
        net_profit: netProfit,
        cash_balance: cashBalance,
        receivables: receivables,
        payables: payables,
        daily_cash_balance: 0,
        total_sales: totalSales,
        total_purchases: totalPurchases,
        cost_of_sales: costOfSales,
        total_expenses: totalGeneralExpenses,
        monthly: { labels: [], sales: [], purchases: [], net_profit: [], expenses: [], payments_in: [], payments_out: [] },
        daily: { dates: [], profits: [] }
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  
  app.get('/api/accounts', async (req, res) => {
    try {
      const userId = getUserId(req.query.initData);
      const data = await getAccounts(userId);
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  
  app.post('/api/verify', async (req, res) => {
    try {
      const userId = 'local_user';
      const userExists = await get(`SELECT id FROM users WHERE id = ?`, [userId]);
      if (!userExists) {
        await run(`INSERT INTO users (id, first_name, username) VALUES (?, ?, ?)`, [userId, 'مستخدم محلي', 'local']);
      }
      await ensureDefaultAccounts(userId);
      res.json({ verified: true, user_id: userId });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  
  app.post('/api/invoices-send', async (req, res) => {
    res.json({ success: true, message: 'تم إرسال الفاتورة إلى التليجرام (محاكاة محلية)' });
  });
}

module.exports = { initTables, setupApiRoutes };
