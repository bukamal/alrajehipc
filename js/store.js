// js/store.js - cache and reactivity
const cache = new Map();
const listeners = new Map();

function notify(key) {
    if (listeners.has(key)) listeners.get(key).forEach(cb => { try { cb(); } catch(e) { console.error(e); } });
}

export async function getAll(storeName) {
    const { getAll: dbGetAll } = await import('./db.js');
    const data = await dbGetAll(storeName);
    cache.set(storeName, data);
    return data;
}

export async function get(storeName, id) {
    const { get: dbGet } = await import('./db.js');
    return dbGet(storeName, id);
}

export async function save(storeName, data) {
    const { save: dbSave } = await import('./db.js');
    const id = await dbSave(storeName, data);
    await invalidate(storeName);
    return id;
}

export async function del(storeName, id) {
    const { del: dbDel } = await import('./db.js');
    await dbDel(storeName, id);
    await invalidate(storeName);
}

export async function getByIndex(storeName, indexName, value) {
    const { getByIndex: dbGetByIndex } = await import('./db.js');
    return dbGetByIndex(storeName, indexName, value);
}

export async function invalidate(key) {
    cache.delete(key);
    notify(key);
}

export function subscribe(key, callback) {
    if (!listeners.has(key)) listeners.set(key, []);
    listeners.get(key).push(callback);
    return () => {
        const arr = listeners.get(key);
        if (arr) listeners.set(key, arr.filter(cb => cb !== callback));
    };
}

export function getCached(key) {
    return cache.get(key);
}

export function setCached(key, data) {
    cache.set(key, data);
    notify(key);
}

export async function fetchAndCache(storeName) {
    const data = await getAll(storeName);
    return data;
}
