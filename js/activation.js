// js/activation.js - النسخة الأصلية مع التفعيل عبر الإنترنت
import { CryptoService } from './crypto-service.js';
const LICENSE_STORAGE_KEY = 'alrajhi_license_v11';
const SERVER_URL = 'http://localhost:5000/activate';
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtYFtFvxKfv/HSDvR0HIw
HMzi4tk5oVUT8D0ilxQd+ENJE/C1oauaBCkwPN/9waUJAvRHbA5o3QR/A17NT2SK
jKUCxZiUZ3rcqZPKXcKaaUc09iE7yNu0zZh90INpfmZY2gJbCpSdpE7exku8PuNr
5gTlHKW6lHozN7cOh58GlvE6grBOtrKLPAVKcQoedGqlvRQKrsj+mR2g2jdSve/O
lGULbb0SWrVHdiCVivptUx4stF/W5jplIv6QeZAecijal7JQb2EIsoY3jhg7pxd1
gMy4GlMuK8Zx0SYsDysvlGKX1a0rlvslanIzPabHJXqvu0r5G8ncFY7C+LIpYfU4
ewIDAQAB
-----END PUBLIC KEY-----`;
const OFFLINE_GRACE_DAYS = 7;
const PASSWORD = 'hawaa-sham-2026-secure-key';

async function migrateOldLicense() {
    const oldKey = 'alrajhi_license_v10';
    const oldEncrypted = localStorage.getItem(oldKey);
    if (!oldEncrypted) return false;
    try {
        const xorDecrypt = (encrypted, key) => {
            const decoded = atob(encrypted);
            let result = '';
            for (let i = 0; i < decoded.length; i++) {
                result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
            }
            return result;
        };
        const decrypted = xorDecrypt(oldEncrypted, 'Alrajhi-License-2024-S3cr3t!K3y#');
        const licenseData = JSON.parse(decrypted);
        const newEncrypted = await CryptoService.encrypt(licenseData, PASSWORD);
        localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(newEncrypted));
        localStorage.removeItem(oldKey);
        return true;
    } catch(e) { return false; }
}

function getDeviceId() {
    let id = localStorage.getItem('hawaa_device_id');
    if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36);
        localStorage.setItem('hawaa_device_id', id);
    }
    return id;
}
export function getSecureFingerprint() { return getDeviceId(); }

async function verifyRsaSignature(data, signatureBase64) {
    const encoder = new TextEncoder();
    const pem = PUBLIC_KEY_PEM.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, '');
    const binaryKey = Uint8Array.from(atob(pem), c=>c.charCodeAt(0));
    const publicKey = await crypto.subtle.importKey('spki', binaryKey, { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' }, false, ['verify']);
    const signature = Uint8Array.from(atob(signatureBase64), c=>c.charCodeAt(0));
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, encoder.encode(data));
}

export async function onlineActivate(licenseCode) {
    const fingerprint = getDeviceId();
    const response = await fetch(SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseCode, fingerprint })
    });
    if (!response.ok) throw new Error(await response.text() || 'فشل التفعيل');
    const result = await response.json();
    const dataToVerify = fingerprint + '|' + result.expirationDate;
    const isValid = await verifyRsaSignature(dataToVerify, result.signature);
    if (!isValid) throw new Error('توقيع غير صالح');
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
    const encrypted = await CryptoService.encrypt(licenseData, PASSWORD);
    localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(encrypted));
    return true;
}

async function fetchServerTime() {
    try {
        const res = await fetch('https://worldtimeapi.org/api/timezone/Asia/Riyadh');
        const data = await res.json();
        return new Date(data.datetime).getTime();
    } catch { return null; }
}

export async function checkActivation() {
    await migrateOldLicense();
    const encryptedStr = localStorage.getItem(LICENSE_STORAGE_KEY);
    if (!encryptedStr) return { valid: false };
    let licenseData;
    try {
        const encrypted = JSON.parse(encryptedStr);
        licenseData = await CryptoService.decrypt(encrypted, PASSWORD);
    } catch { return { valid: false }; }
    const now = Date.now();
    if (licenseData.device !== getDeviceId()) return { valid: false };
    const isOnline = navigator.onLine;
    const isExpired = now > licenseData.expirationDate;
    if (isExpired && isOnline) return { valid: false };
    if (isExpired && !isOnline) {
        const offlineExpiry = licenseData.expirationDate + (OFFLINE_GRACE_DAYS * 86400000);
        if (now > offlineExpiry) return { valid: false };
        return { valid: true, offline: true, warning: 'لا يوجد إنترنت، الترخيص صالح مؤقتاً' };
    }
    if (isOnline && licenseData.lastOpened && now < licenseData.lastOpened - 60000) {
        const serverTime = await fetchServerTime();
        if (serverTime && Math.abs(now - serverTime) > 300000) return { valid: false };
    }
    licenseData.lastOpened = now;
    licenseData.remainingSeconds = Math.max(0, Math.floor((licenseData.expirationDate - now) / 1000));
    const newEncrypted = await CryptoService.encrypt(licenseData, PASSWORD);
    localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(newEncrypted));
    return { valid: true };
}

export function schedulePeriodicVerification() {
    setInterval(async () => {
        if (navigator.onLine) {
            const status = await checkActivation();
            if (!status.valid) {
                const { showToast } = await import('./utils.js');
                showToast('انتهت صلاحية الترخيص، سيتم إعادة التحميل', 'error');
                setTimeout(() => location.reload(), 3000);
            }
        }
    }, 6 * 60 * 60 * 1000);
}
