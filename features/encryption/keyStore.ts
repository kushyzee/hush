/**
 * keyStore.ts
 * -----------
 * IndexedDB-backed storage for the user's RSA-OAEP CryptoKey objects.
 *
 * Why IndexedDB and not localStorage?
 *   - IndexedDB can store CryptoKey objects natively (structured clone algorithm).
 *     This means the private key is stored as a non-extractable opaque handle —
 *     even JavaScript cannot read the raw key bytes once it's in the store.
 *   - localStorage only holds strings, so you'd have to export the key to base64
 *     first (extractable = true), which defeats the security model entirely.
 *   - localStorage has a ~5 MB quota and is synchronous. IndexedDB is async and
 *     has generous quota (hundreds of MB), which matters when storing key material.
 *
 * What we store:
 *   - "privateKey"  — the RSA-OAEP CryptoKey (non-extractable) unwrapped from the
 *                     server's wrapped_private_key blob using the user's password.
 *   - "publicKey"   — the RSA-OAEP CryptoKey (extractable) imported from the
 *                     server's public_key blob. Cached here so every send doesn't
 *                     need to re-import. Used when generating encryptedKeyForSelf.
 *
 * Lifecycle:
 *   - Store both keys after successful login / registration.
 *   - Retrieve privateKey when decrypting received messages or history.
 *   - Retrieve publicKey when encrypting the AES key for self.
 *   - Clear both on logout — keys should never outlive the session in storage.
 *
 * Dependencies:
 *   - `idb` library (npm install idb) — thin Promise wrapper over IndexedDB.
 *     Provides openDB(), IDBPDatabase, and typed store access.
 */

import { openDB, type IDBPDatabase } from "idb";

// ---------------------------------------------------------------------------
// DB schema
// ---------------------------------------------------------------------------

/** Name of the IndexedDB database. */
const DB_NAME = "hush-keystore";

/** Current schema version. Increment + add upgrade logic if schema changes. */
const DB_VERSION = 1;

/** Name of the object store that holds CryptoKey entries. */
const STORE_NAME = "keys";

/**
 * The two keys we persist. Using a const union keeps typos impossible —
 * TypeScript will error if you pass anything else to get/set/clear helpers.
 */
export type KeyName = "privateKey" | "publicKey";

/**
 * Shape of a record in the object store.
 * `name` is the key path (primary key), `value` holds the CryptoKey itself.
 */
interface KeyRecord {
  name: KeyName;
  value: CryptoKey;
}

/**
 * Typed DB schema for `idb`.
 * Maps store name → { key type, value type, index definitions }.
 */
interface HushDB {
  [STORE_NAME]: {
    key: KeyName;
    value: KeyRecord;
  };
}

// ---------------------------------------------------------------------------
// DB singleton
// ---------------------------------------------------------------------------

/**
 * Module-level cached DB connection.
 * We open once and reuse — openDB is idempotent if the DB is already open.
 */
let _db: IDBPDatabase<HushDB> | null = null;

/**
 * Open (or reuse) the Hush IndexedDB database.
 *
 * The `upgrade` callback runs when the DB is created for the first time or
 * when DB_VERSION increases. It's the only place you can create/modify stores.
 *
 * @throws If the browser blocks IndexedDB (e.g. private mode in some browsers,
 *         or StorageManager.persist() denied). Callers should handle the error.
 */
async function getDB(): Promise<IDBPDatabase<HushDB>> {
  if (_db) return _db;

  _db = await openDB<HushDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create the object store if it doesn't exist yet.
      // keyPath: "name" means the `name` field of each record IS the primary key.
      // No autoIncrement — we use explicit string keys.
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "name" });
      }
    },
    blocked() {
      // Another tab has an older version of the DB open. The upgrade is blocked
      // until that tab closes or calls db.close(). Log a warning — we can't
      // do much else here without a UI reference, but the caller's promise will
      // stay pending until unblocked.
      console.warn(
        "[keyStore] IndexedDB upgrade blocked — another tab may have an older schema open.",
      );
    },
    blocking() {
      // THIS tab's connection is blocking a newer version opening in another tab.
      // Close gracefully so the other tab can upgrade.
      console.warn(
        "[keyStore] Closing DB connection to unblock schema upgrade in another tab.",
      );
      _db?.close();
      _db = null;
    },
    terminated() {
      // The browser force-closed the connection (e.g. disk pressure).
      // Reset so the next call to getDB() re-opens.
      console.warn(
        "[keyStore] IndexedDB connection was terminated unexpectedly.",
      );
      _db = null;
    },
  });

  return _db;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Persist a CryptoKey to IndexedDB under the given name.
 *
 * Uses `put` (upsert) so calling this twice with the same name simply
 * overwrites — useful when re-logging in without clearing first.
 *
 * @param name    — "privateKey" or "publicKey"
 * @param cryptoKey — the CryptoKey to store
 *
 * @example
 * ```ts
 * const { privateKey, publicKey } = await generateKeyPair();
 * await storeKey("privateKey", privateKey);
 * await storeKey("publicKey", publicKey);
 * ```
 */
export async function storeKey(
  name: KeyName,
  cryptoKey: CryptoKey,
): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, { name, value: cryptoKey });
}

/**
 * Retrieve a CryptoKey from IndexedDB.
 *
 * Returns `null` if the key doesn't exist (e.g. first load before login,
 * or after a clearKeys() call). Callers must handle the null case — typically
 * by redirecting to login.
 *
 * @param name — "privateKey" or "publicKey"
 * @returns The stored CryptoKey, or null if not found.
 *
 * @example
 * ```ts
 * const privateKey = await getKey("privateKey");
 * if (!privateKey) {
 *   // Session expired or never established — redirect to login
 *   router.push("/login");
 *   return;
 * }
 * const plaintext = await decryptMessage(payload, privateKey);
 * ```
 */
export async function getKey(name: KeyName): Promise<CryptoKey | null> {
  const db = await getDB();
  const record = await db.get(STORE_NAME, name);
  return record?.value ?? null;
}

/**
 * Check whether a specific key exists in the store without retrieving it.
 *
 * Useful for quick session-restore checks on app load without pulling the
 * full CryptoKey object into memory unnecessarily.
 *
 * @param name — "privateKey" or "publicKey"
 * @returns true if the key is present, false otherwise.
 */
export async function hasKey(name: KeyName): Promise<boolean> {
  const db = await getDB();
  // `getKey` from idb returns the record or undefined — count is 0 or 1.
  const record = await db.getKey(STORE_NAME, name);
  return record !== undefined;
}

/**
 * Delete a single key from the store.
 *
 * Call this if you need to replace a key (e.g. after a key rotation) without
 * wiping everything. For full logout, prefer `clearKeys()`.
 *
 * @param name — "privateKey" or "publicKey"
 */
export async function deleteKey(name: KeyName): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, name);
}

/**
 * Clear ALL keys from the store.
 *
 * MUST be called on logout. Leaves the DB open and the object store intact —
 * just empties it. The next login will repopulate via `storeKey`.
 *
 * @example
 * ```ts
 * // In useAuth logout handler:
 * await clearKeys();
 * setAccessToken(null);
 * setUser(null);
 * router.push("/login");
 * ```
 */
export async function clearKeys(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
}

// ---------------------------------------------------------------------------
// Convenience: store both keys in one call
// ---------------------------------------------------------------------------

/**
 * Store the RSA keypair (private + public) atomically in a single transaction.
 *
 * Preferred over two separate `storeKey` calls because both writes happen in
 * the same IndexedDB transaction — either both succeed or neither does. This
 * prevents an inconsistent state where only one key is stored.
 *
 * @param privateKey — non-extractable RSA-OAEP private CryptoKey
 * @param publicKey  — extractable RSA-OAEP public CryptoKey
 *
 * @example
 * ```ts
 * // After registration:
 * const { privateKey, publicKey } = await generateKeyPair();
 * await storeKeyPair(privateKey, publicKey);
 *
 * // After login (unwrapping):
 * const privateKey = await unwrapPrivateKey(wrappedKey, password, salt);
 * const publicKey = await importPublicKey(publicKeyBase64);
 * await storeKeyPair(privateKey, publicKey);
 * ```
 */
export async function storeKeyPair(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<void> {
  const db = await getDB();

  // Open a readwrite transaction scoped to our store.
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  // Both puts go into the same transaction — atomic.
  await Promise.all([
    store.put({ name: "privateKey", value: privateKey }),
    store.put({ name: "publicKey", value: publicKey }),
    tx.done, // resolves when the transaction commits, rejects on abort
  ]);
}

// ---------------------------------------------------------------------------
// Utility: check if IndexedDB is available
// ---------------------------------------------------------------------------

/**
 * Returns true if IndexedDB is available in the current environment.
 *
 * IndexedDB is unavailable in:
 *   - Some browsers in private/incognito mode (Firefox, older Safari)
 *   - Non-browser environments (SSR — this code should only run client-side)
 *   - Environments where storage is blocked by policy
 *
 * Call this on app init and show a warning if false — the app won't be able
 * to store or retrieve keys, making E2EE impossible.
 *
 * @example
 * ```ts
 * if (!isIndexedDBAvailable()) {
 *   toast.error("Your browser doesn't support secure key storage. Try a different browser.");
 * }
 * ```
 */
export function isIndexedDBAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.indexedDB !== "undefined" &&
    window.indexedDB !== null
  );
}
