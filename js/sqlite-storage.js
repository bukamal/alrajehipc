// js/sqlite-storage.js - تخزين قاعدة البيانات في IndexedDB
const DB_NAME = 'AlrajhiSQLiteStorage';
const STORE_NAME = 'files';
const KEY = 'alrajhi_database.db';

function openStorage() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

export async function loadDatabase() {
    const idb = await openStorage();
    return new Promise((resolve) => {
        const tx = idb.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const get = store.get(KEY);
        get.onsuccess = () => resolve(get.result ? new Uint8Array(get.result) : null);
        get.onerror = () => resolve(null);
    });
}

export async function saveDatabase(data) {
    const idb = await openStorage();
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const put = store.put(data, KEY);
        put.onsuccess = () => resolve();
        put.onerror = () => reject(put.error);
    });
}
