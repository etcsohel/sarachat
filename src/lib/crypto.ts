
// RSA Key Generation
export async function generateRsaKeyPair(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
  return window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: "SHA-256",
    },
    true, // extractable
    ["encrypt", "decrypt"] // key usages for private key
  ); // Public key usages are inferred for RSA-OAEP (encrypt only)
}

// Export/Import Keys
export async function exportKeyToJwk(key: CryptoKey): Promise<JsonWebKey> {
  return window.crypto.subtle.exportKey("jwk", key);
}

export async function importRsaPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true, // extractable, though not strictly necessary for public keys for encryption
    ["encrypt"]
  );
}

export async function importRsaPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true, // extractable
    ["decrypt"]
  );
}

// RSA Encryption/Decryption
async function rsaEncrypt(data: ArrayBuffer, publicKey: CryptoKey): Promise<ArrayBuffer> {
  return window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    data
  );
}

async function rsaDecrypt(data: ArrayBuffer, privateKey: CryptoKey): Promise<ArrayBuffer> {
  return window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    data
  );
}

// AES Key Generation
export async function generateAesKey(): Promise<CryptoKey> {
  return window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // extractable
    ["encrypt", "decrypt"]
  );
}

export async function importAesKey(jwk: JsonWebKey): Promise<CryptoKey> {
    return window.crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"]
    );
}


// AES Encryption/Decryption
async function aesEncrypt(data: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<ArrayBuffer> {
  return window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
}

async function aesDecrypt(data: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<ArrayBuffer> {
  return window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
}

// Helper to convert string to ArrayBuffer and vice-versa
function stringToArrayBuffer(str: string): ArrayBuffer {
  return new TextEncoder().encode(str);
}

function arrayBufferToString(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}


// Combined E2EE Message Encryption Flow
export async function encryptMessage(
  messageContent: string,
  participantPublicKeysMap: { [userId: string]: JsonWebKey } // Map of userId to their JWK public key
): Promise<{ encryptedContent: string; encryptedSessionKeys: { [userId: string]: string } }> {
  const sessionAesKey = await generateAesKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM

  const messageBuffer = stringToArrayBuffer(messageContent);
  const encryptedMessageBuffer = await aesEncrypt(messageBuffer, sessionAesKey, iv);

  // Combine IV with encrypted message: IV + Ciphertext
  const ivAndCiphertext = new Uint8Array(iv.length + encryptedMessageBuffer.byteLength);
  ivAndCiphertext.set(iv);
  ivAndCiphertext.set(new Uint8Array(encryptedMessageBuffer), iv.length);
  
  const sessionAesKeyJwk = await exportKeyToJwk(sessionAesKey);
  const sessionKeyString = JSON.stringify(sessionAesKeyJwk);
  const sessionKeyBuffer = stringToArrayBuffer(sessionKeyString);

  const encryptedSessionKeys: { [userId: string]: string } = {};

  for (const userId in participantPublicKeysMap) {
    const publicKeyJwk = participantPublicKeysMap[userId];
    if (publicKeyJwk) { // Ensure publicKeyJwk is not undefined
      try {
        const rsaPublicKey = await importRsaPublicKey(publicKeyJwk);
        const encryptedKeyBuffer = await rsaEncrypt(sessionKeyBuffer, rsaPublicKey);
        encryptedSessionKeys[userId] = arrayBufferToBase64(encryptedKeyBuffer);
      } catch (error) {
        console.error(`Failed to encrypt session key for user ${userId}:`, error);
        // Decide on error handling: throw, or skip this user, or mark as failed
        // For now, we'll rethrow to make the problem visible.
        throw new Error(`Failed to process public key for user ${userId}: ${error}`);
      }
    } else {
        console.warn(`Public key for user ${userId} is undefined. Skipping session key encryption for this user.`);
    }
  }

  return {
    encryptedContent: arrayBufferToBase64(ivAndCiphertext.buffer),
    encryptedSessionKeys,
  };
}

// Combined E2EE Message Decryption Flow
export async function decryptMessage(
  encryptedContentBase64: string,
  encryptedSessionKeyForCurrentUserBase64: string,
  currentUserPrivateKey: CryptoKey,
  _senderPublicKeyJwk?: JsonWebKey // May be used for signature verification later
): Promise<string> {
  const encryptedSessionKeyBuffer = base64ToArrayBuffer(encryptedSessionKeyForCurrentUserBase64);
  const sessionKeyBuffer = await rsaDecrypt(encryptedSessionKeyBuffer, currentUserPrivateKey);
  const sessionAesKeyJwk = JSON.parse(arrayBufferToString(sessionKeyBuffer)) as JsonWebKey;
  const sessionAesKey = await importAesKey(sessionAesKeyJwk);

  const ivAndCiphertextBuffer = base64ToArrayBuffer(encryptedContentBase64);
  const iv = new Uint8Array(ivAndCiphertextBuffer.slice(0, 12));
  const encryptedMessageBuffer = ivAndCiphertextBuffer.slice(12);
  
  const decryptedMessageBuffer = await aesDecrypt(encryptedMessageBuffer, sessionAesKey, iv);
  return arrayBufferToString(decryptedMessageBuffer);
}
