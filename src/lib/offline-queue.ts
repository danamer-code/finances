/**
 * Cua de moviments desats al mòbil quan no hi ha connexió (IndexedDB, només al navegador).
 * Cada moviment porta el seu UUID: quan s'envia, el servidor no el duplica encara que arribi dues vegades.
 */
export type QueuedTransaction = {
  id: string;
  amount: string;
  concept: string;
  categoryId: string;
  date: string;
  queuedAt: string;
};

const DB_NAME = "finances";
const STORE = "pending-transactions";
export const QUEUE_EVENT = "finances:queue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = fn(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

const changed = () => window.dispatchEvent(new Event(QUEUE_EVENT));

export async function enqueueTransaction(t: Omit<QueuedTransaction, "queuedAt">) {
  await run("readwrite", (s) => s.put({ ...t, queuedAt: new Date().toISOString() }));
  changed();
}

export async function queuedTransactions(): Promise<QueuedTransaction[]> {
  const all = await run<QueuedTransaction[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedTransaction[]>);
  return all.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

export async function removeQueued(id: string) {
  await run("readwrite", (s) => s.delete(id));
  changed();
}

/** Error de xarxa (sense connexió) en cridar una acció del servidor, a diferència d'un error de validació. */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return error instanceof TypeError || (error instanceof Error && /fetch|network|load failed/i.test(error.message));
}
