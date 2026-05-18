#!/usr/bin/env python3
# test_server.py - خادم محلي لاختبار نظام هوى الشام للسياحة
import os
import json
import datetime
import base64
from flask import Flask, request, jsonify, send_from_directory
from Crypto.PublicKey import RSA
from Crypto.Signature import pkcs1_15
from Crypto.Hash import SHA256

app = Flask(__name__, static_folder='.', static_url_path='')

# إنشاء مفتاح RSA خاص (لتوقيع الترخيص)
# سيتم إنشاء ملف private.pem إذا لم يكن موجودًا
private_key = None
if os.path.exists('private.pem'):
    with open('private.pem', 'rb') as f:
        private_key = RSA.import_key(f.read())
else:
    private_key = RSA.generate(2048)
    with open('private.pem', 'wb') as f:
        f.write(private_key.export_key())
    with open('public.pem', 'wb') as f:
        f.write(private_key.publickey().export_key())

PUBLIC_KEY_PEM = private_key.publickey().export_key().decode('utf-8')

# تحديث PUBLIC_KEY_PEM في activation.js (للتطابق مع الخادم المحلي)
activation_js_path = 'js/activation.js'
backup_path = 'js/activation.js.backup'
if os.path.exists(activation_js_path):
    # عمل نسخة احتياطية
    if not os.path.exists(backup_path):
        with open(activation_js_path, 'r', encoding='utf-8') as f:
            with open(backup_path, 'w', encoding='utf-8') as b:
                b.write(f.read())
    # تعديل SERVER_URL إلى الخادم المحلي
    with open(activation_js_path, 'r', encoding='utf-8') as f:
        content = f.read()
    new_content = content.replace(
        "const SERVER_URL = 'https://license.manhal-almasriiii199119.workers.dev/activate';",
        "const SERVER_URL = 'http://localhost:5000/activate';"
    )
    # تحديث المفتاح العام إذا لزم الأمر (يمكن تركه كما هو، لكن الأفضل مزامنته)
    # سنقوم باستبدال PUBLIC_KEY_PEM بالمفتاح العام الجديد
    new_content = new_content.replace(
        content.split("const PUBLIC_KEY_PEM = `")[1].split("`")[0],
        PUBLIC_KEY_PEM
    )
    with open(activation_js_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("[✓] تم تعديل js/activation.js لاستخدام الخادم المحلي.")

# نقطة نهاية التفعيل
@app.route('/activate', methods=['POST'])
def activate():
    data = request.json
    license_code = data.get('licenseCode')
    fingerprint = data.get('fingerprint')
    if not license_code or not license_code.startswith("TEST-"):
        return jsonify({"error": "رمز التفعيل غير صالح (يجب أن يبدأ بـ TEST-)"}), 400
    expiration = (datetime.datetime.utcnow() + datetime.timedelta(days=30)).isoformat() + 'Z'
    duration_hours = 30 * 24
    data_to_sign = fingerprint + '|' + expiration
    h = SHA256.new(data_to_sign.encode('utf-8'))
    signature = pkcs1_15.new(private_key).sign(h)
    signature_b64 = base64.b64encode(signature).decode('utf-8')
    return jsonify({
        "expirationDate": expiration,
        "signature": signature_b64,
        "durationHours": duration_hours
    })

# خدمة الملفات الثابتة
@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def serve_static(path):
    # تجنب المشاكل الأمنية: السماح فقط بملفات المشروع
    if '..' in path or path.startswith('.'):
        return "Forbidden", 403
    return send_from_directory('.', path)

if __name__ == '__main__':
    print("="*50)
    print("خادم الاختبار المحلي لنظام هوى الشام للسياحة")
    print("="*50)
    print("العنوان: http://localhost:5000")
    print("أي رمز تفعيل يبدأ بـ TEST- سيكون مقبولاً (مثل TEST-12345)")
    print("لإيقاف الخادم: Ctrl+C")
    print("="*50)
    app.run(host='0.0.0.0', port=5000, debug=True)

