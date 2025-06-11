const DB_NAME = "CipherCommsDB";
const DB_VERSION = 1;
const KEYS_STORE_NAME = "userKeys";

interface StoredKey {
  userId: string;
  type: "privateKey" | "publicKey";
  key: CryptoKey | JsonWebKey;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(KEYS_STORE_NAME)) {
        db.createObjectStore(KEYS_STORE_NAME, { keyPath: ["userId", "type"] });
      }
    };
  });
}

async function getKeyFromDB(userId: string, type: "privateKey" | "publicKey"): Promise<CryptoKey | JsonWebKey | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(KEYS_STORE_NAME, "readonly");
    const store = transaction.objectStore(KEYS_STORE_NAME);
    const request = store.get([userId, type]);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      resolve(request.result ? request.result.key : null);
    };
  });
}

async function storeKeyInDB(userId: string, type: "privateKey" | "publicKey", key: CryptoKey | JsonWebKey): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(KEYS_STORE_NAME, "readwrite");
    const store = transaction.objectStore(KEYS_STORE_NAME);
    const storedKey: StoredKey = { userId, type, key };
    const request = store.put(storedKey);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function storePrivateKey(userId: string, privateKey: CryptoKey): Promise<void> {
  // Private keys are stored as CryptoKey objects directly as they are not easily serializable for export outside Web Crypto.
  await storeKeyInDB(userId, "privateKey", privateKey);
}

export async function getPrivateKey(userId: string): Promise<CryptoKey | null> {
  const key = await getKeyFromDB(userId, "privateKey");
  return key instanceof CryptoKey ? key : null; // Ensure it's a CryptoKey
}

export async function storePublicKey(userId: string, publicKey: JsonWebKey): Promise<void> {
  // Public keys are stored in JWK format as they are typically shared.
  await storeKeyInDB(userId, "publicKey", publicKey);
}

export async function getPublicKey(userId: string): Promise<JsonWebKey | null> {
  const key = await getKeyFromDB(userId, "publicKey");
  // Check if it's a valid JWK structure (basic check)
  if (key && typeof key === 'object' && 'kty' in key) {
    return key as JsonWebKey;
  }
  return null;
}

export async function clearUserKeys(userId: string): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(KEYS_STORE_NAME, "readwrite");
    const store = transaction.objectStore(KEYS_STORE_NAME);
    
    const privateKeyRequest = store.delete([userId, "privateKey"]);
    privateKeyRequest.onerror = () => reject(privateKeyRequest.error);
    
    const publicKeyRequest = store.delete([userId, "publicKey"]);
    publicKeyRequest.onerror = () => reject(publicKeyRequest.error);

    let completed = 0;
    const checkCompletion = () => {
      completed++;
      if (completed === 2) {
        resolve();
      }
    };
    privateKeyRequest.onsuccess = checkCompletion;
    publicKeyRequest.onsuccess = checkCompletion;

    transaction.oncomplete = () => resolve(); // Fallback if individual onsuccess doesn't cover all cases
    transaction.onerror = () => reject(transaction.error);
  });
}
