import type { WaveformData } from './audioModel';

const memory = new Map<string, WaveformData>();
function remember(key: string, value: WaveformData) {
    memory.delete(key); memory.set(key, value);
    while (memory.size > 4) memory.delete(memory.keys().next().value!);
}
async function database(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('kieran-document-studio-audio-waveforms', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('peaks', { keyPath: 'key' });
        let settled = false;
        const fail = (error: unknown) => { if (settled) return; settled = true; clearTimeout(timer); reject(error); };
        const timer = setTimeout(() => fail(new Error('Cache unavailable')), 1200);
        request.onsuccess = () => {
            if (settled) { request.result.close(); return; }
            settled = true; clearTimeout(timer); resolve(request.result);
        };
        request.onerror = () => fail(request.error);
        request.onblocked = () => fail(new Error('Cache blocked'));
    });
}
export async function getWaveform(key: string): Promise<WaveformData | undefined> {
    if (memory.has(key)) return memory.get(key);
    let db: IDBDatabase | undefined;
    try {
        db = await database();
        const value = await new Promise<{ value: WaveformData } | undefined>((resolve, reject) => {
            const request = db!.transaction('peaks').objectStore('peaks').get(key);
            request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        });
        if (value) remember(key, value.value);
        return value?.value;
    } catch { return undefined; } finally { db?.close(); }
}
export async function putWaveform(key: string, value: WaveformData) {
    remember(key, value);
    let db: IDBDatabase | undefined;
    try {
        db = await database();
        await new Promise<void>((resolve, reject) => {
            const tx = db!.transaction('peaks', 'readwrite'); const store = tx.objectStore('peaks');
            store.put({ key, value, updated: Date.now() });
            const request = store.getAll();
            request.onsuccess = () => request.result.sort((a, b) => b.updated - a.updated).slice(8).forEach(row => store.delete(row.key));
            tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
        });
    } catch { /* Caching is optional; playback and waveform remain usable. */ } finally { db?.close(); }
}
