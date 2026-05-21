// crypto-service.js - خدمة تشفير بسيطة (للاستخدام المحلي)
export class CryptoService {
    // تشفير بسيط (لأغراض الاختبار فقط - لا تستخدم في الإنتاج الحقيقي)
    static async encrypt(data, password) {
        const json = JSON.stringify(data);
        // تحويل بسيط: base64 مع XOR على الباسوورد (للتجربة)
        let result = '';
        for (let i = 0; i < json.length; i++) {
            result += String.fromCharCode(json.charCodeAt(i) ^ password.charCodeAt(i % password.length));
        }
        return btoa(result);
    }

    static async decrypt(encrypted, password) {
        try {
            const decoded = atob(encrypted);
            let result = '';
            for (let i = 0; i < decoded.length; i++) {
                result += String.fromCharCode(decoded.charCodeAt(i) ^ password.charCodeAt(i % password.length));
            }
            return JSON.parse(result);
        } catch(e) {
            throw new Error('فك التشفير فشل');
        }
    }
}
