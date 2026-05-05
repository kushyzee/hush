const subtle = globalThis.crypto.subtle;

const RSA_ALGORITHM = "RSA-OAEP";
const RSA_MODULUS_LENGTH = 4096;
const RSA_PUBLIC_EXPONENT = new Uint8Array([1, 0, 1]);
const RSA_HASH = "SHA-256";

const AES_GCM_ALGORITHM = "AES-GCM";
const AES_KEY_LENGTH = 256;
const AES_IV_LENGTH = 12;

const AES_KW_ALGORITHM = "AES-KW";
const AES_KW_LENGTH = 256;

const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_HASH = "SHA-256";
const PBKDF2_SALT_LENGTH = 16;

export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ================ RSA-OAEP keypair generation =============== //
export interface GeneratedKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyBase64: string;
}
export async function generateKeyPair(): Promise<GeneratedKeyPair> {
  const keyPair = await subtle.generateKey(
    {
      name: RSA_ALGORITHM,
      modulusLength: RSA_MODULUS_LENGTH,
      publicExponent: RSA_PUBLIC_EXPONENT,
      hash: RSA_HASH,
    },
    true,
    ["encrypt", "decrypt"],
  );

  const publicKeyDer = await subtle.exportKey("spki", keyPair.publicKey);

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    publicKeyBase64: bufferToBase64(publicKeyDer),
  };
}
export async function importPublicKey(base64: string): Promise<CryptoKey> {
  return subtle.importKey(
    "spki",
    base64ToBuffer(base64),
    { name: RSA_ALGORITHM, hash: RSA_HASH },
    false,
    ["encrypt"],
  );
}
export const importOwnPublicKey = importPublicKey;
export function generateSalt(): { salt: Uint8Array; saltBase64: string } {
  const salt = globalThis.crypto.getRandomValues(
    new Uint8Array(PBKDF2_SALT_LENGTH),
  );
  return { salt, saltBase64: bufferToBase64(salt.buffer) };
}
export async function deriveWrappingKey(
  password: string,
  saltBase64: string,
): Promise<CryptoKey> {
  const salt = base64ToBuffer(saltBase64);
  const passwordKey = await subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    passwordKey,
    { name: AES_KW_ALGORITHM, length: AES_KW_LENGTH },
    false,
    ["wrapKey", "unwrapKey"],
  );
}
export async function wrapPrivateKey(
  privateKey: CryptoKey,
  wrappingKey: CryptoKey,
): Promise<string> {
  const wrapped = await subtle.wrapKey("pkcs8", privateKey, wrappingKey, {
    name: AES_KW_ALGORITHM,
  });
  return bufferToBase64(wrapped);
}
export async function unwrapPrivateKey(
  wrappedBase64: string,
  wrappingKey: CryptoKey,
): Promise<CryptoKey> {
  return subtle.unwrapKey(
    "pkcs8",
    base64ToBuffer(wrappedBase64),
    wrappingKey,
    { name: AES_KW_ALGORITHM },
    { name: RSA_ALGORITHM, hash: RSA_HASH },
    false,
    ["decrypt"],
  );
}

// =============== AES-GCM message encryption =============== //
export interface EncryptedMessage {
  ciphertextBase64: string;
  ivBase64: string;
  aesKey: CryptoKey;
}

export async function encryptMessage(
  plaintext: string,
): Promise<EncryptedMessage> {
  const aesKey = await subtle.generateKey(
    { name: AES_GCM_ALGORITHM, length: AES_KEY_LENGTH },
    true,
    ["encrypt", "decrypt"],
  );

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(AES_IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await subtle.encrypt(
    { name: AES_GCM_ALGORITHM, iv },
    aesKey,
    encoded,
  );

  return {
    ciphertextBase64: bufferToBase64(ciphertext),
    ivBase64: bufferToBase64(iv.buffer),
    aesKey,
  };
}

export async function decryptMessage(
  ciphertextBase64: string,
  ivBase64: string,
  aesKey: CryptoKey,
): Promise<string | null> {
  try {
    const plaintext = await subtle.decrypt(
      { name: AES_GCM_ALGORITHM, iv: base64ToBuffer(ivBase64) },
      aesKey,
      base64ToBuffer(ciphertextBase64),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}

// =============== RSA-OAEP key encryption =============== //

export async function encryptAesKey(
  aesKey: CryptoKey,
  rsaPublicKey: CryptoKey,
): Promise<string> {
  const rawAesKey = await subtle.exportKey("raw", aesKey);
  const encrypted = await subtle.encrypt(
    { name: RSA_ALGORITHM },
    rsaPublicKey,
    rawAesKey,
  );
  return bufferToBase64(encrypted);
}

export async function decryptAesKey(
  encryptedKeyBase64: string,
  rsaPrivateKey: CryptoKey,
): Promise<CryptoKey | null> {
  try {
    const rawAesKey = await subtle.decrypt(
      { name: RSA_ALGORITHM },
      rsaPrivateKey,
      base64ToBuffer(encryptedKeyBase64),
    );

    return subtle.importKey(
      "raw",
      rawAesKey,
      { name: AES_GCM_ALGORITHM, length: AES_KEY_LENGTH },
      false,
      ["decrypt"],
    );
  } catch {
    return null;
  }
}

// =============== High-level compose helpers =============== //
import type { EncryptedPayload } from "@/shared/types";

export async function buildEncryptedPayload(
  plaintext: string,
  recipientPublicKeyBase64: string,
  ownPublicKeyBase64: string,
): Promise<EncryptedPayload> {
  const [recipientRsaKey, ownRsaKey] = await Promise.all([
    importPublicKey(recipientPublicKeyBase64),
    importOwnPublicKey(ownPublicKeyBase64),
  ]);

  const { ciphertextBase64, ivBase64, aesKey } =
    await encryptMessage(plaintext);

  const [encryptedKey, encryptedKeyForSelf] = await Promise.all([
    encryptAesKey(aesKey, recipientRsaKey),
    encryptAesKey(aesKey, ownRsaKey),
  ]);

  return {
    ciphertext: ciphertextBase64,
    iv: ivBase64,
    encryptedKey,
    encryptedKeyForSelf,
  };
}

export async function decryptPayload(
  payload: EncryptedPayload,
  rsaPrivateKey: CryptoKey,
  isSender: boolean,
): Promise<string | null> {
  const encryptedKeyBase64 = isSender
    ? payload.encryptedKeyForSelf
    : payload.encryptedKey;

  const aesKey = await decryptAesKey(encryptedKeyBase64, rsaPrivateKey);
  if (!aesKey) return null;

  return decryptMessage(payload.ciphertext, payload.iv, aesKey);
}
