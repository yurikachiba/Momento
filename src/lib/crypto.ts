/**
 * AES-GCM encryption/decryption using Web Crypto API.
 * Password → PBKDF2 → AES-256-GCM key.
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 100_000;
const VERIFICATION_TEXT = 'momento-verified';

let currentKey: CryptoKey | null = null;

export function setKey(key: CryptoKey | null): void {
  currentKey = key;
}

export function getKey(): CryptoKey | null {
  return currentKey;
}

export function isEncryptionEnabled(): boolean {
  return localStorage.getItem('momento-crypto-salt') !== null;
}

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBlob(blob: Blob): Promise<ArrayBuffer> {
  if (!currentKey) throw new Error('Encryption key not set');
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const data = await blob.arrayBuffer();
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    currentKey,
    data,
  );
  // Prepend IV to ciphertext
  const result = new Uint8Array(IV_LENGTH + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), IV_LENGTH);
  return result.buffer;
}

export async function decryptToBlob(data: ArrayBuffer, type: string): Promise<Blob> {
  if (!currentKey) throw new Error('Encryption key not set');
  const iv = new Uint8Array(data, 0, IV_LENGTH);
  const encrypted = new Uint8Array(data, IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    currentKey,
    encrypted,
  );
  return new Blob([decrypted], { type });
}

export async function createVerification(key: CryptoKey): Promise<{ iv: Uint8Array; data: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const data = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    new TextEncoder().encode(VERIFICATION_TEXT),
  );
  return { iv, data };
}

export async function verifyPassword(
  key: CryptoKey,
  iv: Uint8Array,
  data: ArrayBuffer,
): Promise<boolean> {
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: iv.buffer as ArrayBuffer },
      key,
      data,
    );
    return new TextDecoder().decode(decrypted) === VERIFICATION_TEXT;
  } catch {
    return false;
  }
}

// --- Config persistence (salt & verification are not secrets) ---

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface CryptoConfig {
  salt: Uint8Array;
  verifyIv: Uint8Array;
  verifyData: ArrayBuffer;
}

export function saveCryptoConfig(salt: Uint8Array, verifyIv: Uint8Array, verifyData: ArrayBuffer): void {
  localStorage.setItem('momento-crypto-salt', toBase64(salt));
  localStorage.setItem('momento-crypto-iv', toBase64(verifyIv));
  localStorage.setItem('momento-crypto-verify', toBase64(verifyData));
}

export function getCryptoConfig(): CryptoConfig | null {
  const s = localStorage.getItem('momento-crypto-salt');
  const i = localStorage.getItem('momento-crypto-iv');
  const v = localStorage.getItem('momento-crypto-verify');
  if (!s || !i || !v) return null;
  return {
    salt: fromBase64(s),
    verifyIv: fromBase64(i),
    verifyData: fromBase64(v).buffer as ArrayBuffer,
  };
}

export function removeCryptoConfig(): void {
  localStorage.removeItem('momento-crypto-salt');
  localStorage.removeItem('momento-crypto-iv');
  localStorage.removeItem('momento-crypto-verify');
}
