import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_PREFIX = 'scrypt';
const SCRYPT_KEY_LENGTH = 64;

function getScryptHash(password, salt) {
  return scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString('hex');
}

export async function hashPassword(password) {
  if (typeof password !== 'string' || !password) {
    throw new Error('Password is required');
  }

  const salt = randomBytes(16).toString('hex');
  const hash = getScryptHash(password, salt);
  return `${SCRYPT_PREFIX}$${salt}$${hash}`;
}

function verifyScryptHash(storedHash, password) {
  const parts = storedHash.split('$');
  if (parts.length !== 3) {
    return false;
  }

  const [, salt, expectedHash] = parts;
  const calculatedHash = getScryptHash(password, salt);

  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const calculatedBuffer = Buffer.from(calculatedHash, 'hex');
  if (expectedBuffer.length !== calculatedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, calculatedBuffer);
}

async function verifyArgon2Hash(storedHash, password) {
  try {
    const argon2Module = await import('argon2');
    const verify = argon2Module.verify || argon2Module.default?.verify;
    if (typeof verify !== 'function') {
      return false;
    }
    return Boolean(await verify(storedHash, password));
  } catch {
    return false;
  }
}

export async function verifyPassword(storedHash, password) {
  if (typeof storedHash !== 'string' || typeof password !== 'string') {
    return false;
  }

  if (storedHash.startsWith(`${SCRYPT_PREFIX}$`)) {
    return verifyScryptHash(storedHash, password);
  }

  if (storedHash.startsWith('$argon2')) {
    return verifyArgon2Hash(storedHash, password);
  }

  return false;
}
