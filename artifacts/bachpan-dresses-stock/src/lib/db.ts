export type Item = {
  id: string;
  name: string;
  category: string;
  sizes: string[];
  createdAt: string;
  updatedAt: string;
};

export type StockEntry = {
  id: string;
  itemId: string;
  date: string;
  challanNumber: string;
  quantities: Record<string, number>;
  createdAt: string;
  updatedAt: string;
};

export type BackupData = { version: 1; exportedAt: string; items: Item[]; entries: StockEntry[] };

const DB_NAME = 'bachpan-dresses-register';
const DB_VERSION = 2;
const now = () => new Date().toISOString();
const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const seedItems: Item[] = [
  { id: 'item_summer_uniform', name: 'Summer Uniform Set', category: 'Uniform Set', sizes: ['22', '24', '26', '28', '30', '32'], createdAt: '2025-04-06T08:00:00.000Z', updatedAt: '2025-04-06T08:00:00.000Z' },
  { id: 'item_white_shirt', name: 'White School Shirt', category: 'Shirts', sizes: ['24', '26', '28', '30', '32', '34'], createdAt: '2025-04-06T08:10:00.000Z', updatedAt: '2025-04-06T08:10:00.000Z' },
  { id: 'item_navy_trouser', name: 'Navy Trousers', category: 'Bottoms', sizes: ['24', '26', '28', '30', '32', '34'], createdAt: '2025-04-06T08:20:00.000Z', updatedAt: '2025-04-06T08:20:00.000Z' },
  { id: 'item_house_tshirt', name: 'House T-shirt — Blue', category: 'Sportswear', sizes: ['26', '28', '30', '32', '34', '36'], createdAt: '2025-04-06T08:30:00.000Z', updatedAt: '2025-04-06T08:30:00.000Z' },
];
const seedEntries: StockEntry[] = [
  { id: 'entry_summer_1', itemId: 'item_summer_uniform', date: '2025-04-04', challanNumber: 'CH-1042', quantities: { '22': 12, '24': 18, '26': 24, '28': 20, '30': 15, '32': 8 }, createdAt: '2025-04-04T08:00:00.000Z', updatedAt: '2025-04-04T08:00:00.000Z' },
  { id: 'entry_summer_2', itemId: 'item_summer_uniform', date: '2025-04-06', challanNumber: 'CH-1051', quantities: { '22': 6, '24': 12, '26': 10, '28': 14, '30': 8, '32': 5 }, createdAt: '2025-04-06T09:00:00.000Z', updatedAt: '2025-04-06T09:00:00.000Z' },
  { id: 'entry_shirt_1', itemId: 'item_white_shirt', date: '2025-04-05', challanNumber: 'CH-1047', quantities: { '24': 9, '26': 14, '28': 18, '30': 16, '32': 11, '34': 4 }, createdAt: '2025-04-05T08:00:00.000Z', updatedAt: '2025-04-05T08:00:00.000Z' },
  { id: 'entry_trouser_1', itemId: 'item_navy_trouser', date: '2025-04-02', challanNumber: 'CH-1033', quantities: { '24': 7, '26': 13, '28': 16, '30': 12, '32': 9, '34': 3 }, createdAt: '2025-04-02T08:00:00.000Z', updatedAt: '2025-04-02T08:00:00.000Z' },
];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const items = db.objectStoreNames.contains('items') ? request.transaction!.objectStore('items') : db.createObjectStore('items', { keyPath: 'id' });
      if (!items.indexNames.contains('updatedAt')) items.createIndex('updatedAt', 'updatedAt');
      const entries = db.objectStoreNames.contains('entries') ? request.transaction!.objectStore('entries') : db.createObjectStore('entries', { keyPath: 'id' });
      if (!entries.indexNames.contains('itemId')) entries.createIndex('itemId', 'itemId');
      if (!entries.indexNames.contains('updatedAt')) entries.createIndex('updatedAt', 'updatedAt');
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function seedIfEmpty(db: IDBDatabase) {
  const seeded = await new Promise<boolean>((resolve, reject) => {
    if (!db.objectStoreNames.contains('meta')) { resolve(false); return; }
    const request = db.transaction('meta', 'readonly').objectStore('meta').get('seeded');
    request.onsuccess = () => resolve(request.result?.value === true);
    request.onerror = () => reject(request.error);
  });
  if (seeded) return;
  const count = await new Promise<number>((resolve, reject) => {
    const request = db.transaction('items', 'readonly').objectStore('items').count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (count > 0) {
    await requestAll(db.transaction('meta', 'readwrite').objectStore('meta').put({ key: 'seeded', value: true }));
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['items', 'entries', 'meta'], 'readwrite');
    seedItems.forEach((item) => tx.objectStore('items').put(item));
    seedEntries.forEach((entry) => tx.objectStore('entries').put(entry));
    tx.objectStore('meta').put({ key: 'seeded', value: true });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function ready() { const db = await openDb(); await seedIfEmpty(db); return db; }
function requestAll<T>(request: IDBRequest<T>) { return new Promise<T>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }

export async function getItems() { const db = await ready(); return requestAll<Item[]>(db.transaction('items', 'readonly').objectStore('items').getAll()); }
export async function getItem(id: string) { const db = await ready(); return requestAll<Item | undefined>(db.transaction('items', 'readonly').objectStore('items').get(id)); }
export async function getEntries(itemId?: string) {
  const db = await ready();
  const store = db.transaction('entries', 'readonly').objectStore('entries');
  return requestAll<StockEntry[]>(itemId ? store.index('itemId').getAll(itemId) : store.getAll());
}
export async function putItem(item: Item) { const db = await ready(); await requestAll(db.transaction('items', 'readwrite').objectStore('items').put(item)); return item; }
export async function putEntry(entry: StockEntry) { const db = await ready(); await requestAll(db.transaction('entries', 'readwrite').objectStore('entries').put(entry)); return entry; }
export async function deleteItem(id: string) {
  const db = await ready();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['items', 'entries'], 'readwrite');
    tx.objectStore('items').delete(id);
    const index = tx.objectStore('entries').index('itemId');
    index.openCursor(id).onsuccess = (event) => { const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null; if (cursor) { cursor.delete(); cursor.continue(); } };
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}
export async function deleteEntry(id: string) { const db = await ready(); await requestAll(db.transaction('entries', 'readwrite').objectStore('entries').delete(id)); }
export async function replaceAll(items: Item[], entries: StockEntry[]) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['items', 'entries'], 'readwrite');
    tx.objectStore('items').clear(); tx.objectStore('entries').clear();
    items.forEach((item) => tx.objectStore('items').put(item));
    entries.forEach((entry) => tx.objectStore('entries').put(entry));
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}
export async function exportData(): Promise<BackupData> { return { version: 1, exportedAt: now(), items: await getItems(), entries: await getEntries() }; }
export { makeId, now };