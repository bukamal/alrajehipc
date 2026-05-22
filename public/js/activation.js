// js/activation.js — تفعيل عبر الإنترنت مع معرف جهاز ثابت
const LICENSE_STORAGE_KEY = 'alrajhi_license_v10';
const SERVER_URL = '/activate';
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAm5ExNGSd3T3MbpSeucSE\nKXi+b/yKGSpXMJeH/EgCi+Fyek1CN8Irixf3q99QpwRMMhhuzGutv6G9ZE38mner\nxfbGlgXIg9xKeRf+aFfGjvpCtIqAFX/mU1QDoSSrPKlzBt+zjp1/JGLCag9JAZch\nKeKgkKwKANWnKxl756BHSOJeo/MQEqXg6nfsduiqnJPIvJXTI3nHC5BZOyXPePTj\nKVLtevR3vmT8ym3qT0MPjJQF3v/TgKUSeaPbVSxOjTOWrwE0jN8swWmScAkgLNTm\nSLsaJGpAvU6b84uoEsLiDY6heEngHAu1Wfunkkpc6wA6MFHgjjuNimNTB2xi9tLK\n5wIDAQAB\n-----END PUBLIC KEY-----`;

// معرف الجهاز الثابت: يتم إنشاؤه مرة واحدة ويبقى
function getOrCreateDeviceId() {
    let deviceId = localStorage.getItem('hawaa_device_id');
    if (!deviceId) {
        if (window.crypto && window.crypto.randomUUID) {
            deviceId = window.crypto.randomUUID();
        } else {
            deviceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        }
        localStorage.setItem('hawaa_device_id', deviceId);
    }
    return deviceId;
}

export function getSecureFingerprint() {
    return getOrCreateDeviceId();
}

function xorEncrypt(data, key) {
    let result = '';
    for (let i = 0; i < data.length; i++) {
        result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(result);
}

function xorDecrypt(encrypted, key) {
    try {
        const decoded = atob(encrypted);
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
            result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return result;
    } catch(e) { return ''; }
}

async function verifyRsaSignature(data, signatureBase64) {
    const encoder = new TextEncoder();
    const pemContents = PUBLIC_KEY_PEM.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, '');
    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    const publicKey = await crypto.subtle.importKey('spki', binaryKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const signature = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, encoder.encode(data));
}

export async function onlineActivate(licenseCode) {
    const fingerprint = getSecureFingerprint();
    const response = await fetch(SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseCode, fingerprint })
    });
    if (!response.ok) {
        let errMsg = await response.text();
        throw new Error(errMsg || 'فشل التفعيل عبر الإنترنت');
    }
    const result = await response.json();
    const dataToVerify = fingerprint + '|' + result.expirationDate;
    const isValid = await verifyRsaSignature(dataToVerify, result.signature);
    if (!isValid) throw new Error('توقيع غير صالح من الخادم');
    
    const now = Date.now();
    const licenseData = {
        key: licenseCode,
        device: fingerprint,
        activationDate: now,
        expirationDate: result.expirationDate,
        lastOpened: now,
        remainingSeconds: result.durationHours * 3600,
        onlineActivated: true
    };
    const encrypted = xorEncrypt(JSON.stringify(licenseData), 'Alrajhi-License-2024-S3cr3t!K3y#');
    localStorage.setItem(LICENSE_STORAGE_KEY, encrypted);
    return true;
}

export async function checkActivation() {
    const encrypted = localStorage.getItem(LICENSE_STORAGE_KEY);
    if (!encrypted) return { valid: false, reason: 'no_license' };
    let data;
    try {
        const decrypted = xorDecrypt(encrypted, 'Alrajhi-License-2024-S3cr3t!K3y#');
        data = JSON.parse(decrypted);
    } catch(e) {
        localStorage.removeItem(LICENSE_STORAGE_KEY);
        return { valid: false, reason: 'corrupted' };
    }
    const now = Date.now();
    const currentFingerprint = getSecureFingerprint();
    if (data.device !== currentFingerprint) {
        localStorage.removeItem(LICENSE_STORAGE_KEY);
        return { valid: false, reason: 'device_mismatch' };
    }
    if (now > data.expirationDate + 60*1000) {
        localStorage.removeItem(LICENSE_STORAGE_KEY);
        return { valid: false, reason: 'expired' };
    }
    if (data.lastOpened && now < data.lastOpened - 60*1000) {
        localStorage.removeItem(LICENSE_STORAGE_KEY);
        return { valid: false, reason: 'clock_tampered' };
    }
    data.lastOpened = now;
    data.remainingSeconds = Math.max(0, Math.floor((data.expirationDate - now) / 1000));
    localStorage.setItem(LICENSE_STORAGE_KEY, xorEncrypt(JSON.stringify(data), 'Alrajhi-License-2024-S3cr3t!K3y#'));
    return { valid: true, remainingSeconds: data.remainingSeconds };
}

export function getRemainingTime() {
    const encrypted = localStorage.getItem(LICENSE_STORAGE_KEY);
    if (!encrypted) return null;
    try {
        const decrypted = xorDecrypt(encrypted, 'Alrajhi-License-2024-S3cr3t!K3y#');
        const data = JSON.parse(decrypted);
        const now = Date.now();
        if (now > data.expirationDate) return 0;
        return Math.floor((data.expirationDate - now) / 1000);
    } catch(e) { return null; }
}
