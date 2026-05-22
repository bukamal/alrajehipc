#!/usr/bin/env python3
# app.py - الخادم المتكامل لنظام الراجحي للمحاسبة (API + تفعيل + خدمة الملفات الثابتة)
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

# ========== قاعدة البيانات ==========
DB_PATH = 'alrajhi.db'

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
        conn.execute('INSERT OR IGNORE INTO users (id, first_name, username) VALUES (?,?,?)', ('local_user', 'مستخدم محلي', 'local'))
    print("[✓] تم تهيئة قاعدة البيانات")

init_db()
USER_ID = 'local_user'

# ========== دوال المخزون والأرصدة ==========
def apply_purchase(item_id, qty, cost):
    with get_db() as conn:
        row = conn.execute('SELECT quantity, average_cost FROM items WHERE id = ?', (item_id,)).fetchone()
        if not row: return
        old_qty = row['quantity'] or 0
        old_avg = row['average_cost'] or 0
        new_qty = old_qty + qty
        new_avg = (old_qty * old_avg + qty * cost) / new_qty if new_qty > 0 else 0
        conn.execute('UPDATE items SET quantity = ?, average_cost = ? WHERE id = ?', (new_qty, new_avg, item_id))

def apply_sale(item_id, qty):
    with get_db() as conn:
        row = conn.execute('SELECT quantity, average_cost FROM items WHERE id = ?', (item_id,)).fetchone()
        if not row: return 0
        if row['quantity'] < qty: raise Exception('كمية غير كافية')
        new_qty = row['quantity'] - qty
        conn.execute('UPDATE items SET quantity = ? WHERE id = ?', (new_qty, item_id))
        return qty * (row['average_cost'] or 0)

def update_customer_balance(customer_id, change):
    with get_db() as conn:
        conn.execute('UPDATE customers SET balance = balance + ? WHERE id = ?', (change, customer_id))

def update_supplier_balance(supplier_id, change):
    with get_db() as conn:
        conn.execute('UPDATE suppliers SET balance = balance + ? WHERE id = ?', (change, supplier_id))

# ========== API endpoints (مختصرة – نفس الـ CRUD السابق) ==========
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
        cur = conn.execute('INSERT INTO customers (user_id, name, phone, address, balance) VALUES (?,?,?,?,0)', (USER_ID, name, data.get('phone'), data.get('address')))
        conn.commit()
        row = conn.execute('SELECT * FROM customers WHERE id = ?', (cur.lastrowid,)).fetchone()
        return jsonify(dict(row))

@app.route('/api/customers/<int:id>', methods=['PUT'])
def update_customer(id):
    data = request.json
    with get_db() as conn:
        conn.execute('UPDATE customers SET name=COALESCE(?,name), phone=COALESCE(?,phone), address=COALESCE(?,address) WHERE id=? AND user_id=?',
                     (data.get('name'), data.get('phone'), data.get('address'), id, USER_ID))
        conn.commit()
        row = conn.execute('SELECT * FROM customers WHERE id = ?', (id,)).fetchone()
        return jsonify(dict(row))

@app.route('/api/customers/<int:id>', methods=['DELETE'])
def delete_customer(id):
    with get_db() as conn:
        if conn.execute('SELECT id FROM invoices WHERE customer_id=? LIMIT 1', (id,)).fetchone():
            return jsonify({'error': 'مرتبط بفواتير'}), 400
        conn.execute('DELETE FROM customers WHERE id=? AND user_id=?', (id, USER_ID))
        return jsonify({'success': True})

# ========== مسارات مشابهة للموردين والتصنيفات والمواد إلخ ==========
# (لإكمال المشروع يجب إضافة جميع المسارات من الملف الأصلي)
# لكن لاختصار المساحة، أذكر أن هذه الدوال موجودة في app.py الأصلي وسيتم دمجها.

# ========== نظام التفعيل والتوقيع ==========
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

PUBLIC_KEY_PEM = private_key.publickey().export_key().decode('utf-8')

@app.route('/activate', methods=['POST'])
def activate():
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
    return jsonify({'expirationDate': expiration, 'signature': signature_b64, 'durationHours': duration_hours})

@app.route('/public-key', methods=['GET'])
def get_public_key():
    if os.path.exists('public.pem'):
        with open('public.pem', 'r') as f:
            return f.read(), 200, {'Content-Type': 'text/plain'}
    return "لم يتم إنشاء المفتاح بعد", 404

# ========== تحديث activation.js تلقائياً ==========
def patch_activation_js():
    js_path = 'public/js/activation.js'
    if not os.path.exists(js_path):
        print("[!] activation.js غير موجود، لن يتم تعديله.")
        return
    with open(js_path, 'r', encoding='utf-8') as f:
        content = f.read()
    # تعديل SERVER_URL
    content = content.replace(
        "const SERVER_URL = 'https://license.manhal-almasriiii199119.workers.dev/activate';",
        "const SERVER_URL = '/activate';"
    )
    # استبدال المفتاح العام
    import re
    pattern = r'(const PUBLIC_KEY_PEM = `)(.*?)(`;)'
    def replacer(m):
        return m.group(1) + PUBLIC_KEY_PEM.replace('\n', '\\n') + m.group(3)
    content = re.sub(pattern, replacer, content, flags=re.DOTALL)
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("[✓] تم تحديث public/js/activation.js للعمل مع الخادم المحلي.")

patch_activation_js()

# ========== خدمة الملفات الثابتة ==========
@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('public', path)

# ========== تشغيل الخادم ==========
if __name__ == '__main__':
    print("="*50)
    print("خادم الراجحي للمحاسبة (متكامل + تفعيل محلي)")
    print("العنوان: http://localhost:5000")
    print("أي رمز تفعيل يبدأ بـ TEST- سيكون مقبولاً (مثل TEST-12345)")
    print("لإيقاف الخادم: Ctrl+C")
    print("="*50)
    app.run(host='0.0.0.0', port=5000, debug=True)
