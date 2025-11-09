/**
 * Cryptography utilities for offline license validation
 * Uses Web Crypto API for RSA signature verification
 */

/**
 * RSA Public Key (PEM format)
 * This public key is embedded in the extension
 * The corresponding private key is kept offline for signing licenses
 *
 * NOTE: This is a placeholder key for demonstration.
 * In production, generate a real RSA-2048 key pair using:
 * openssl genrsa -out private_key.pem 2048
 * openssl rsa -in private_key.pem -pubout -out public_key.pem
 */
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1LfVLPHCozMxH2Mo
4lgOEePzNm0tRgeLezV6ffAt0gunVTLw7onLRnrq0/IzW7yWR7QkrmBL7jTKEn5u
+qKhbwKfBstIs+bMY2Zkp18gnTxKLxoS2tFczGkPLPgizskuemMghRniWaoLcyeh
kd3qqGElvW/VDL5AaWTg0nLVkjRo9z+40RQzuVaE8AkAFmxZzow3x+VJYKdjykkJ
0iT9wCS0DRTXu269V264Vf/3jvredZiKRkgwlL9xNAwxXFg0x/XFw005UWVRIkdg
cKWTjpBP2dPwVZ4WWC+9aGVd+Gyn1o0CLelf4rEjGoXbAAEgAqeGUxrcIlbjXfbc
mwIDAQAB
-----END PUBLIC KEY-----`;

/**
 * Import RSA public key for verification
 * @returns {Promise<CryptoKey>}
 */
async function importPublicKey() {
  try {
    // Remove PEM header/footer and decode base64
    const pemContents = PUBLIC_KEY_PEM
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '');

    const binaryDer = base64ToArrayBuffer(pemContents);

    const key = await crypto.subtle.importKey(
      'spki',
      binaryDer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      true,
      ['verify']
    );

    return key;
  } catch (error) {
    console.error('Failed to import public key:', error);
    throw new Error('Invalid public key');
  }
}

/**
 * Convert base64 string to ArrayBuffer
 * @param {string} base64
 * @returns {ArrayBuffer}
 */
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert string to ArrayBuffer
 * @param {string} str
 * @returns {ArrayBuffer}
 */
function stringToArrayBuffer(str) {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

/**
 * Verify RSA signature
 * @param {string} data - Original data
 * @param {string} signatureBase64 - Base64-encoded signature
 * @returns {Promise<boolean>}
 */
export async function verifySignature(data, signatureBase64) {
  try {
    const publicKey = await importPublicKey();
    const dataBuffer = stringToArrayBuffer(data);
    const signatureBuffer = base64ToArrayBuffer(signatureBase64);

    const isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      signatureBuffer,
      dataBuffer
    );

    return isValid;
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

/**
 * Generate SHA-256 hash of data
 * @param {string} data
 * @returns {Promise<string>} Hex string of hash
 */
export async function sha256Hash(data) {
  const buffer = stringToArrayBuffer(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Generate a random string for nonces/tokens
 * @param {number} length
 * @returns {string}
 */
export function generateRandomString(length = 32) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time string comparison to prevent timing attacks
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function constantTimeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Simple obfuscation for storing sensitive data (not encryption!)
 * @param {string} data
 * @returns {string}
 */
export function obfuscate(data) {
  return btoa(data);
}

/**
 * Deobfuscate data
 * @param {string} obfuscatedData
 * @returns {string}
 */
export function deobfuscate(obfuscatedData) {
  return atob(obfuscatedData);
}
