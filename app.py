#!/usr/bin/env python3
# app.py - خادم Flask الكامل لنظام الراجحي للمحاسبة (مع تفعيل محلي)
import os
import json
import sqlite3
import datetime
import base64
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from Crypto.PublicKey import RSA
from Crypto.Signature import pkcs1_15
from Crypto.Hash import SHA256

app = Flask(__name__, static_folder='public', static_url_path='')
CORS(app)

DB_PATH = 'alrajhi.db'

# -------------------- مساعدة قاعدة البيانات --------------------
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.executescript('''
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
        ''')
        # الحسابات الافتراضية
        default_accounts = [('الصندوق','asset'),('المبيعات','income'),('المشتريات','expense'),('المخزون','asset'),('مصاريف عامة','expense'),('رأس المال','equity')]
        for name, typ in default_accounts:
            conn.execute('INSERT OR IGNORE INTO accounts (user_id, name, type, balance) VALUES (?,?,?,0)', ('local_user', name, typ))
        # مستخدم افتراضي
        conn.execute('INSERT OR IGNORE INTO users (id, first_name, username) VALUES (?,?,?)', ('local_user', 'مستخدم محلي', 'local'))

init_db()
USER_ID = 'local_user'

# -------------------- دوال المخزون والأرصدة --------------------
def apply_purchase(item_id, qty, cost):
    with get_db() as conn:
        row = conn.execute('SELECT quantity, average_cost FROM items WHERE id = ?', (item_id,)).fetchone()
        if not row: return
        old_qty = row['quantity'] or 0
        old_avg = row['average_cost'] or 0
        new_qty = old_qty + qty
        new_avg = (old_qty * old_avg + qty * cost) / new_qty if new_qty > 0 else 0
        conn.execute('UPDATE items SET quantity = ?, average_cost = ? WHERE id = ?', (new_qty, new_avg, item_id))

def reverse_purchase(item_id, qty, cost):
    with get_db() as conn:
        row = conn.execute('SELECT quantity, average_cost FROM items WHERE id = ?', (item_id,)).fetchone()
        if not row: return
        old_qty = row['quantity'] or 0
        old_avg = row['average_cost'] or 0
        new_qty = old_qty - qty
        new_avg = (old_qty * old_avg - qty * cost) / new_qty if new_qty > 0 else 0
        conn.execute('UPDATE items SET quantity = ?, average_cost = ? WHERE id = ?', (new_qty, new_avg, item_id))

def apply_sale(item_id, qty):
    with get_db() as conn:
        row = conn.execute('SELECT quantity, average_cost FROM items WHERE id = ?', (item_id,)).fetchone()
        if not row: return 0
        if row['quantity'] < qty: raise Exception('كمية غير كافية')
        new_qty = row['quantity'] - qty
        conn.execute('UPDATE items SET quantity = ? WHERE id = ?', (new_qty, item_id))
        return qty * (row['average_cost'] or 0)

def reverse_sale(item_id, qty):
    with get_db() as conn:
        conn.execute('UPDATE items SET quantity = quantity + ? WHERE id = ?', (qty, item_id))

def update_customer_balance(customer_id, change):
    with get_db() as conn:
        conn.execute('UPDATE customers SET balance = balance + ? WHERE id = ?', (change, customer_id))

def update_supplier_balance(supplier_id, change):
    with get_db() as conn:
        conn.execute('UPDATE suppliers SET balance = balance + ? WHERE id = ?', (change, supplier_id))

# -------------------- العملاء --------------------
@app.route('/api/customers', methods=['GET'])
def get_customers():
    with get_db() as conn:
        rows = conn.execute('SELECT * FROM customers WHERE user_id = ? ORDER BY name', (USER_ID,)).fetchall()
        return jsonify([dict(row) for row in rows])

@app.route('/api/customers', methods=['POST'])
def add_customer():
    data = request.json
    name = data.get('name')
    if not name: return jsonify({'error': 'اسم العميل مطلوب'}), 400
    with get_db() as conn:
        cur = conn.execute('INSERT INTO customers (user_id, name, phone, address, balance) VALUES (?,?,?,?,0)',
                           (USER_ID, name, data.get('phone'), data.get('address')))
        conn.commit()
        row = conn.execute('SELECT * FROM customers WHERE id = ?', (cur.lastrowid,)).fetchone()
        return jsonify(dict(row))

@app.route('/api/customers/<int:id>', methods=['PUT'])
def update_customer(id):
    data = request.json
    with get_db() as conn:
        conn.execute('''UPDATE customers SET name=COALESCE(?,name), phone=COALESCE(?,phone), address=COALESCE(?,address)
                        WHERE id=? AND user_id=?''', (data.get('name'), data.get('phone'), data.get('address'), id, USER_ID))
        conn.commit()
        row = conn.execute('SELECT * FROM customers WHERE id = ?', (id,)).fetchone()
        return jsonify(dict(row))

@app.route('/api/customers/<int:id>', methods=['DELETE'])
def delete_customer(id):
    with get_db() as conn:
        if conn.execute('SELECT id FROM invoices WHERE customer_id=? LIMIT 1', (id,)).fetchone():
            return jsonify({'error': 'مرتبط بفواتير'}), 400
        if conn.execute('SELECT id FROM payments WHERE customer_id=? LIMIT 1', (id,)).fetchone():
            return jsonify({'error': 'مرتبط بدفعات'}), 400
        conn.execute('DELETE FROM customers WHERE id=? AND user_id=?', (id, USER_ID))
        return jsonify({'success': True})

# -------------------- الموردين --------------------
@app.route('/api/suppliers', methods=['GET'])
def get_suppliers():
    with get_db() as conn:
        rows = conn.execute('SELECT * FROM suppliers WHERE user_id = ? ORDER BY name', (USER_ID,)).fetchall()
        return jsonify([dict(row) for row in rows])

@app.route('/api/suppliers', methods=['POST'])
def add_supplier():
    data = request.json
    name = data.get('name')
    if not name: return jsonify({'error': 'اسم المورد مطلوب'}), 400
    with get_db() as conn:
        cur = conn.execute('INSERT INTO suppliers (user_id, name, phone, address, balance) VALUES (?,?,?,?,0)',
                           (USER_ID, name, data.get('phone'), data.get('address')))
        conn.commit()
        row = conn.execute('SELECT * FROM suppliers WHERE id = ?', (cur.lastrowid,)).fetchone()
        return jsonify(dict(row))

@app.route('/api/suppliers/<int:id>', methods=['PUT'])
def update_supplier(id):
    data = request.json
    with get_db() as conn:
        conn.execute('''UPDATE suppliers SET name=COALESCE(?,name), phone=COALESCE(?,phone), address=COALESCE(?,address)
                        WHERE id=? AND user_id=?''', (data.get('name'), data.get('phone'), data.get('address'), id, USER_ID))
        conn.commit()
        row = conn.execute('SELECT * FROM suppliers WHERE id = ?', (id,)).fetchone()
        return jsonify(dict(row))

@app.route('/api/suppliers/<int:id>', methods=['DELETE'])
def delete_supplier(id):
    with get_db() as conn:
        if conn.execute('SELECT id FROM invoices WHERE supplier_id=? LIMIT 1', (id,)).fetchone():
            return jsonify({'error': 'مرتبط بفواتير'}), 400
        if conn.execute('SELECT id FROM payments WHERE supplier_id=? LIMIT 1', (id,)).fetchone():
            return jsonify({'error': 'مرتبط بدفعات'}), 400
        conn.execute('DELETE FROM suppliers WHERE id=? AND user_id=?', (id, USER_ID))
        return jsonify({'success': True})

# -------------------- التصنيفات والوحدات --------------------
@app.route('/api/definitions', methods=['GET'])
def get_definitions():
    type_ = request.args.get('type')
    with get_db() as conn:
        if type_ == 'category':
            rows = conn.execute('SELECT * FROM categories WHERE user_id=? ORDER BY name', (USER_ID,)).fetchall()
        elif type_ == 'unit':
            rows = conn.execute('SELECT * FROM units WHERE user_id=? ORDER BY name', (USER_ID,)).fetchall()
        else: return jsonify({'error': 'نوع غير معروف'}), 400
        return jsonify([dict(row) for row in rows])

@app.route('/api/definitions', methods=['POST'])
def add_definition():
    data = request.json
    type_ = data.get('type')
    name = data.get('name')
    if not name: return jsonify({'error': 'الاسم مطلوب'}), 400
    with get_db() as conn:
        if type_ == 'category':
            cur = conn.execute('INSERT INTO categories (user_id, name) VALUES (?,?)', (USER_ID, name))
        elif type_ == 'unit':
            cur = conn.execute('INSERT INTO units (user_id, name, abbreviation) VALUES (?,?,?)', (USER_ID, name, data.get('abbreviation')))
        else: return jsonify({'error': 'نوع غير معروف'}), 400
        conn.commit()
        row = conn.execute('SELECT * FROM categories WHERE id=?', (cur.lastrowid,)).fetchone() if type_=='category' else conn.execute('SELECT * FROM units WHERE id=?', (cur.lastrowid,)).fetchone()
        return jsonify(dict(row))

@app.route('/api/definitions', methods=['PUT'])
def update_definition():
    data = request.json
    type_ = data.get('type')
    id_ = data.get('id')
    name = data.get('name')
    if not id_: return jsonify({'error': 'المعرف مطلوب'}), 400
    with get_db() as conn:
        if type_ == 'category':
            conn.execute('UPDATE categories SET name=? WHERE id=? AND user_id=?', (name, id_, USER_ID))
            row = conn.execute('SELECT * FROM categories WHERE id=?', (id_,)).fetchone()
        elif type_ == 'unit':
            conn.execute('UPDATE units SET name=?, abbreviation=? WHERE id=? AND user_id=?', (name, data.get('abbreviation'), id_, USER_ID))
            row = conn.execute('SELECT * FROM units WHERE id=?', (id_,)).fetchone()
        else: return jsonify({'error': 'نوع غير معروف'}), 400
        conn.commit()
        return jsonify(dict(row))

@app.route('/api/definitions', methods=['DELETE'])
def delete_definition():
    type_ = request.args.get('type')
    id_ = request.args.get('id')
    if not id_: return jsonify({'error': 'المعرف مطلوب'}), 400
    with get_db() as conn:
        if type_ == 'category':
            if conn.execute('SELECT id FROM items WHERE category_id=? LIMIT 1', (id_,)).fetchone():
                return jsonify({'error': 'لا يمكن حذف التصنيف لاستخدامه في مواد'}), 400
            conn.execute('DELETE FROM categories WHERE id=? AND user_id=?', (id_, USER_ID))
        elif type_ == 'unit':
            if conn.execute('SELECT id FROM items WHERE base_unit_id=? LIMIT 1', (id_,)).fetchone():
                return jsonify({'error': 'الوحدة مستخدمة كوحدة أساسية'}), 400
            if conn.execute('SELECT id FROM item_units WHERE unit_id=? LIMIT 1', (id_,)).fetchone():
                return jsonify({'error': 'الوحدة مستخدمة في وحدات فرعية'}), 400
            conn.execute('DELETE FROM units WHERE id=? AND user_id=?', (id_, USER_ID))
        else: return jsonify({'error': 'نوع غير معروف'}), 400
        conn.commit()
        return jsonify({'success': True})

# -------------------- المواد --------------------
@app.route('/api/items', methods=['GET'])
def get_items():
    with get_db() as conn:
        items = conn.execute('SELECT * FROM items WHERE user_id=? ORDER BY name', (USER_ID,)).fetchall()
        result = []
        for it in items:
            d = dict(it)
            cat = conn.execute('SELECT name FROM categories WHERE id=?', (d['category_id'],)).fetchone()
            d['category'] = dict(cat) if cat else None
            base = conn.execute('SELECT name, abbreviation FROM units WHERE id=?', (d['base_unit_id'],)).fetchone()
            d['base_unit'] = dict(base) if base else None
            ius = conn.execute('SELECT * FROM item_units WHERE item_id=?', (d['id'],)).fetchall()
            d['item_units'] = []
            for iu in ius:
                iud = dict(iu)
                u = conn.execute('SELECT name, abbreviation FROM units WHERE id=?', (iud['unit_id'],)).fetchone()
                iud['unit'] = dict(u) if u else None
                d['item_units'].append(iud)
            d['available'] = d['quantity']
            d['total_value'] = d['quantity'] * (d['average_cost'] or 0)
            d['purchase_qty'] = d['sale_qty'] = d['purchase_count'] = d['sale_count'] = 0
            result.append(d)
        return jsonify(result)

@app.route('/api/items', methods=['POST'])
def add_item():
    data = request.json
    name = data.get('name')
    if not name: return jsonify({'error': 'اسم المادة مطلوب'}), 400
    with get_db() as conn:
        cur = conn.execute('''INSERT INTO items (user_id, name, category_id, item_type, purchase_price, selling_price, quantity, base_unit_id, average_cost)
                              VALUES (?,?,?,?,?,?,?,?,?)''',
                           (USER_ID, name, data.get('category_id'), data.get('item_type','مخزون'),
                            data.get('purchase_price',0), data.get('selling_price',0),
                            data.get('quantity',0), data.get('base_unit_id'), data.get('purchase_price',0)))
        item_id = cur.lastrowid
        for iu in data.get('item_units', []):
            conn.execute('INSERT INTO item_units (item_id, unit_id, conversion_factor) VALUES (?,?,?)',
                         (item_id, iu['unit_id'], iu.get('conversion_factor',1)))
        conn.commit()
        row = conn.execute('SELECT * FROM items WHERE id=?', (item_id,)).fetchone()
        return jsonify(dict(row))

@app.route('/api/items/<int:id>', methods=['PUT'])
def update_item(id):
    data = request.json
    with get_db() as conn:
        conn.execute('''UPDATE items SET
            name=COALESCE(?,name),
            category_id=COALESCE(?,category_id),
            item_type=COALESCE(?,item_type),
            purchase_price=COALESCE(?,purchase_price),
            selling_price=COALESCE(?,selling_price),
            quantity=COALESCE(?,quantity),
            base_unit_id=COALESCE(?,base_unit_id),
            average_cost=COALESCE(?,average_cost)
            WHERE id=? AND user_id=?''',
            (data.get('name'), data.get('category_id'), data.get('item_type'),
             data.get('purchase_price'), data.get('selling_price'), data.get('quantity'),
             data.get('base_unit_id'), data.get('purchase_price'), id, USER_ID))
        conn.execute('DELETE FROM item_units WHERE item_id=?', (id,))
        for iu in data.get('item_units', []):
            conn.execute('INSERT INTO item_units (item_id, unit_id, conversion_factor) VALUES (?,?,?)',
                         (id, iu['unit_id'], iu.get('conversion_factor',1)))
        conn.commit()
        row = conn.execute('SELECT * FROM items WHERE id=?', (id,)).fetchone()
        return jsonify(dict(row))

@app.route('/api/items/<int:id>', methods=['DELETE'])
def delete_item(id):
    with get_db() as conn:
        if conn.execute('SELECT id FROM invoice_lines WHERE item_id=? LIMIT 1', (id,)).fetchone():
            return jsonify({'error': 'المادة مستخدمة في فواتير'}), 400
        conn.execute('DELETE FROM item_units WHERE item_id=?', (id,))
        conn.execute('DELETE FROM items WHERE id=? AND user_id=?', (id, USER_ID))
        return jsonify({'success': True})

# -------------------- الفواتير --------------------
@app.route('/api/invoices', methods=['GET'])
def get_invoices():
    with get_db() as conn:
        invoices = conn.execute('SELECT * FROM invoices WHERE user_id=? ORDER BY date DESC', (USER_ID,)).fetchall()
        result = []
        for inv in invoices:
            d = dict(inv)
            if d['customer_id']:
                c = conn.execute('SELECT name FROM customers WHERE id=?', (d['customer_id'],)).fetchone()
                d['customer'] = dict(c) if c else None
            if d['supplier_id']:
                s = conn.execute('SELECT name FROM suppliers WHERE id=?', (d['supplier_id'],)).fetchone()
                d['supplier'] = dict(s) if s else None
            lines = conn.execute('SELECT * FROM invoice_lines WHERE invoice_id=?', (d['id'],)).fetchall()
            d['invoice_lines'] = []
            for line in lines:
                l = dict(line)
                if l['item_id']:
                    item = conn.execute('SELECT name FROM items WHERE id=?', (l['item_id'],)).fetchone()
                    l['item'] = dict(item) if item else None
                if l['unit_id']:
                    unit = conn.execute('SELECT name, abbreviation FROM units WHERE id=?', (l['unit_id'],)).fetchone()
                    l['unit'] = dict(unit) if unit else None
                d['invoice_lines'].append(l)
            payments = conn.execute('SELECT amount FROM payments WHERE invoice_id=?', (d['id'],)).fetchall()
            d['paid'] = sum(p['amount'] for p in payments) if payments else 0
            d['balance'] = d['total'] - d['paid']
            result.append(d)
        return jsonify(result)

@app.route('/api/invoices', methods=['POST'])
def create_invoice():
    data = request.json
    with get_db() as conn:
        total = sum(line['total'] for line in data.get('lines', []))
        cur = conn.execute('''INSERT INTO invoices (user_id, type, customer_id, supplier_id, date, reference, notes, total, status)
                              VALUES (?,?,?,?,?,?,?,?,'posted')''',
                           (USER_ID, data['type'], data.get('customer_id'), data.get('supplier_id'),
                            data.get('date'), data.get('reference'), data.get('notes'), total))
        inv_id = cur.lastrowid
        for line in data['lines']:
            base_qty = line['quantity'] * line.get('conversion_factor', 1)
            conn.execute('''INSERT INTO invoice_lines (invoice_id, item_id, description, quantity, unit_price, total, unit_id, quantity_in_base, unit_cost, cost_amount)
                            VALUES (?,?,?,?,?,?,?,?,?,?)''',
                         (inv_id, line.get('item_id'), line.get('description'), line['quantity'],
                          line['unit_price'], line['total'], line.get('unit_id'), base_qty, None, None))
            if line.get('item_id'):
                if data['type'] == 'purchase':
                    unit_cost = line['unit_price'] / (line.get('conversion_factor',1))
                    apply_purchase(line['item_id'], base_qty, unit_cost)
                    conn.execute('UPDATE invoice_lines SET unit_cost=? WHERE id=?', (unit_cost, inv_id))
                else:
                    cost_amt = apply_sale(line['item_id'], base_qty)
                    conn.execute('UPDATE invoice_lines SET cost_amount=? WHERE id=?', (cost_amt, inv_id))
        paid = float(data.get('paid_amount',0))
        if paid > 0:
            conn.execute('''INSERT INTO payments (user_id, invoice_id, customer_id, supplier_id, amount, payment_date, notes)
                            VALUES (?,?,?,?,?,?,?)''',
                         (USER_ID, inv_id, data.get('customer_id'), data.get('supplier_id'),
                          paid, data.get('date'), 'دفعة تلقائية'))
        if data['type'] == 'sale' and data.get('customer_id'):
            update_customer_balance(data['customer_id'], total - paid)
        elif data['type'] == 'purchase' and data.get('supplier_id'):
            update_supplier_balance(data['supplier_id'], total - paid)
        conn.commit()
        return jsonify({'id': inv_id, 'total': total})

@app.route('/api/invoices/<int:id>', methods=['DELETE'])
def delete_invoice(id):
    with get_db() as conn:
        # عكس تأثيرات المخزون والأرصدة يمكن إضافته لاحقاً - للتطبيق المبسط نكتفي بالحذف
        conn.execute('DELETE FROM invoice_lines WHERE invoice_id=?', (id,))
        conn.execute('DELETE FROM payments WHERE invoice_id=?', (id,))
        conn.execute('DELETE FROM invoices WHERE id=? AND user_id=?', (id, USER_ID))
        conn.commit()
        return jsonify({'success': True})

# -------------------- المصاريف --------------------
@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    with get_db() as conn:
        rows = conn.execute('SELECT * FROM expenses WHERE user_id=? ORDER BY expense_date DESC', (USER_ID,)).fetchall()
        return jsonify([dict(row) for row in rows])

@app.route('/api/expenses', methods=['POST'])
def add_expense():
    data = request.json
    with get_db() as conn:
        cur = conn.execute('INSERT INTO expenses (user_id, amount, expense_date, description) VALUES (?,?,?,?)',
                           (USER_ID, data['amount'], data.get('expense_date'), data.get('description')))
        conn.commit()
        row = conn.execute('SELECT * FROM expenses WHERE id=?', (cur.lastrowid,)).fetchone()
        return jsonify(dict(row))

@app.route('/api/expenses/<int:id>', methods=['DELETE'])
def delete_expense(id):
    with get_db() as conn:
        conn.execute('DELETE FROM expenses WHERE id=? AND user_id=?', (id, USER_ID))
        return jsonify({'success': True})

# -------------------- السندات والدفعات --------------------
@app.route('/api/payments', methods=['GET'])
def get_payments():
    is_voucher = request.args.get('voucher') == '1'
    with get_db() as conn:
        if is_voucher:
            rows = conn.execute('SELECT * FROM vouchers WHERE user_id=? ORDER BY date DESC', (USER_ID,)).fetchall()
            res = []
            for v in rows:
                d = dict(v)
                if d['customer_id']:
                    c = conn.execute('SELECT name FROM customers WHERE id=?', (d['customer_id'],)).fetchone()
                    d['customer'] = dict(c) if c else None
                if d['supplier_id']:
                    s = conn.execute('SELECT name FROM suppliers WHERE id=?', (d['supplier_id'],)).fetchone()
                    d['supplier'] = dict(s) if s else None
                res.append(d)
            return jsonify(res)
        else:
            rows = conn.execute('SELECT * FROM payments WHERE user_id=? ORDER BY payment_date DESC', (USER_ID,)).fetchall()
            return jsonify([dict(row) for row in rows])

@app.route('/api/payments', methods=['POST'])
def add_payment():
    data = request.json
    is_voucher = data.get('voucher', False)
    with get_db() as conn:
        if is_voucher:
            cur = conn.execute('''INSERT INTO vouchers (user_id, type, date, amount, description, reference, customer_id, supplier_id, invoice_id)
                                  VALUES (?,?,?,?,?,?,?,?,?)''',
                               (USER_ID, data['type'], data['date'], data['amount'], data.get('description'),
                                data.get('reference'), data.get('customer_id'), data.get('supplier_id'), data.get('invoice_id')))
            if data['type'] == 'receipt' and data.get('customer_id'):
                update_customer_balance(data['customer_id'], data['amount'])
            elif data['type'] == 'payment' and data.get('supplier_id'):
                update_supplier_balance(data['supplier_id'], -data['amount'])
            conn.commit()
            row = conn.execute('SELECT * FROM vouchers WHERE id=?', (cur.lastrowid,)).fetchone()
            return jsonify(dict(row))
        else:
            return jsonify({'error': 'استخدم السندات'}), 405

@app.route('/api/payments', methods=['DELETE'])
def delete_payment():
    is_voucher = request.args.get('voucher') == '1'
    id_ = request.args.get('id')
    if not id_: return jsonify({'error': 'معرف مطلوب'}), 400
    with get_db() as conn:
        if is_voucher:
            conn.execute('DELETE FROM vouchers WHERE id=? AND user_id=?', (id_, USER_ID))
        else:
            conn.execute('DELETE FROM payments WHERE id=? AND user_id=?', (id_, USER_ID))
        conn.commit()
        return jsonify({'success': True})

# -------------------- الملخص والتقارير الأساسية --------------------
@app.route('/api/summary', methods=['GET'])
def summary():
    with get_db() as conn:
        total_sales = conn.execute('SELECT COALESCE(SUM(total),0) FROM invoices WHERE type="sale" AND user_id=?', (USER_ID,)).fetchone()[0]
        total_purchases = conn.execute('SELECT COALESCE(SUM(total),0) FROM invoices WHERE type="purchase" AND user_id=?', (USER_ID,)).fetchone()[0]
        total_expenses = conn.execute('SELECT COALESCE(SUM(amount),0) FROM expenses WHERE user_id=?', (USER_ID,)).fetchone()[0]
        net_profit = total_sales - total_purchases - total_expenses
        receivables = conn.execute('SELECT COALESCE(SUM(balance),0) FROM customers WHERE user_id=?', (USER_ID,)).fetchone()[0]
        payables = conn.execute('SELECT COALESCE(SUM(balance),0) FROM suppliers WHERE user_id=?', (USER_ID,)).fetchone()[0]
        cash_balance = 0
        return jsonify({
            'net_profit': net_profit,
            'cash_balance': cash_balance,
            'receivables': receivables,
            'payables': payables,
            'daily_cash_balance': 0,
            'total_sales': total_sales,
            'total_purchases': total_purchases,
            'cost_of_sales': total_purchases,
            'total_expenses': total_expenses,
            'monthly': {'labels': [], 'sales': [], 'purchases': [], 'net_profit': [], 'expenses': []},
            'daily': {'dates': [], 'profits': []}
        })

# -------------------- الحسابات --------------------
@app.route('/api/accounts', methods=['GET'])
def get_accounts():
    with get_db() as conn:
        rows = conn.execute('SELECT * FROM accounts WHERE user_id=? ORDER BY name', (USER_ID,)).fetchall()
        return jsonify([dict(row) for row in rows])

# -------------------- التحقق --------------------
@app.route('/api/verify', methods=['POST'])
def verify():
    return jsonify({'verified': True, 'user_id': USER_ID})

# -------------------- نظام التفعيل المحلي --------------------
# إنشاء أو تحميل مفتاح خاص
KEY_FILE = 'private.pem'
if os.path.exists(KEY_FILE):
    with open(KEY_FILE, 'rb') as f:
        private_key = RSA.import_key(f.read())
else:
    private_key = RSA.generate(2048)
    with open(KEY_FILE, 'wb') as f:
        f.write(private_key.export_key())
    with open('public.pem', 'wb') as f:
        f.write(private_key.publickey().export_key())

@app.route('/activate', methods=['POST'])
def activate_local():
    data = request.json
    license_code = data.get('licenseCode')
    fingerprint = data.get('fingerprint')
    if not license_code or not license_code.startswith('TEST-'):
        return jsonify({'error': 'رمز التفعيل غير صالح (يجب أن يبدأ بـ TEST-)'}), 400
    expiration = (datetime.datetime.utcnow() + datetime.timedelta(days=30)).isoformat() + 'Z'
    duration_hours = 30 * 24
    data_to_sign = fingerprint + '|' + expiration
    h = SHA256.new(data_to_sign.encode('utf-8'))
    signature = pkcs1_15.new(private_key).sign(h)
    signature_b64 = base64.b64encode(signature).decode('utf-8')
    return jsonify({
        'expirationDate': expiration,
        'signature': signature_b64,
        'durationHours': duration_hours
    })

@app.route('/public-key', methods=['GET'])
def get_public_key():
    if os.path.exists('public.pem'):
        with open('public.pem', 'r') as f:
            return f.read(), 200, {'Content-Type': 'text/plain'}
    else:
        return "لم يتم إنشاء المفتاح بعد", 404

# -------------------- الملفات الثابتة --------------------
@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('public', path)

if __name__ == '__main__':
    print('🚀 خادم الراجحي للمحاسبة (الإصدار الكامل مع تفعيل محلي)')
    print('يعمل على: http://localhost:5000')
    print('أي رمز يبدأ بـ TEST- سيكون مقبولاً (مثال: TEST-12345)')
    app.run(host='0.0.0.0', port=5000, debug=True)
