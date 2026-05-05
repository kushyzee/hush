import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "hush-keystore";

const DB_VERSION = 1;

const STORE_NAME = "keys";

export type KeyName = "privateKey" | "publicKey";

interface KeyRecord {
  name: KeyName;
  value: CryptoKey;
}

interface HushDB {
  [STORE_NAME]: {
    key: KeyName;
    value: KeyRecord;
  };
}

let _db: IDBPDatabase<HushDB> | null = null;

async function getDB(): Promise<IDBPDatabase<HushDB>> {
  if (_db) return _db;

  _db = await openDB<HushDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "name" });
      }
    },

    blocked() {
      console.warn(
        "[keyStore] IndexedDB upgrade blocked; another tab may have an older schema open.",
      );
    },
    blocking() {
      console.warn(
        "[keyStore] Closing DB connection to unblock schema upgrade in another tab.",
      );
      _db?.close();
      _db = null;
    },
    terminated() {
      console.warn(
        "[keyStore] IndexedDB connection was terminated unexpectedly.",
      );
      _db = null;
    },
  });

  return _db;
}

export async function storeKey(
  name: KeyName,
  cryptoKey: CryptoKey,
): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, { name, value: cryptoKey });
}

export async function getKey(name: KeyName): Promise<CryptoKey | null> {
  const db = await getDB();
  const record = await db.get(STORE_NAME, name);
  return record?.value ?? null;
}

export async function hasKey(name: KeyName): Promise<boolean> {
  const db = await getDB();
  const record = await db.getKey(STORE_NAME, name);
  return record !== undefined;
}

export async function deleteKey(name: KeyName): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, name);
}

export async function clearKeys(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
}

export async function storeKeyPair(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<void> {
  const db = await getDB();

  // Open a readwrite transaction scoped to the store.
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  // Both puts go into the same transaction atomically.
  await Promise.all([
    store.put({ name: "privateKey", value: privateKey }),
    store.put({ name: "publicKey", value: publicKey }),
    tx.done, // resolves when the transaction commits, rejects on abort
  ]);
}
export function isIndexedDBAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.indexedDB !== "undefined" &&
    window.indexedDB !== null
  );
}
