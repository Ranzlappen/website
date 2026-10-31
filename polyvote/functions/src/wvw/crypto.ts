/**
 * Crypto helpers (Node `crypto` only — no dependencies).
 *
 * - AES-256-GCM for GW2 API keys at rest (`wvwKeys`, server-only). Keys are
 *   kept so the relink sweep can re-verify a member's team automatically.
 * - Ed25519 verification of Discord interaction signatures.
 * - HMAC-SHA256 for the voice-worker → function channel.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  createPublicKey,
  randomBytes,
  timingSafeEqual,
  verify as cryptoVerify,
} from 'node:crypto';

export interface Sealed {
  v: 1;
  iv: string;
  tag: string;
  data: string;
}

/**
 * `keyEncryptionKey` may be a base64 32-byte key OR any passphrase of at least
 * 16 characters (hashed to 32 bytes with SHA-256) — so admins can set it in the
 * Secret Manager web console without generating a key on the command line.
 */
export function keyFrom(secret: string): Buffer {
  const s = (secret ?? '').trim();
  if (/^[A-Za-z0-9+/]{43}=$/.test(s)) {
    const key = Buffer.from(s, 'base64');
    if (key.length === 32) return key;
  }
  if (s.length < 16) throw new Error('keyEncryptionKey must be a base64 32-byte key or a passphrase of at least 16 characters.');
  return createHash('sha256').update(s, 'utf8').digest();
}

export function seal(plaintext: string, keyB64: string): Sealed {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(keyB64), iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    v: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  };
}

export function unseal(sealed: Sealed, keyB64: string): string {
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(keyB64), Buffer.from(sealed.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(sealed.data, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

// DER prefix that wraps a raw 32-byte Ed25519 public key as SPKI.
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/**
 * Verify a Discord interaction: signature = Ed25519(timestamp + rawBody).
 * https://discord.com/developers/docs/interactions/overview#setting-up-an-endpoint-validating-security-request-headers
 */
export function verifyDiscordSignature(
  rawBody: Buffer | string,
  signatureHex: string | undefined,
  timestamp: string | undefined,
  publicKeyHex: string,
): boolean {
  if (!signatureHex || !timestamp || !/^[0-9a-f]{128}$/i.test(signatureHex)) return false;
  if (!/^[0-9a-f]{64}$/i.test(publicKeyHex)) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyHex, 'hex')]),
      format: 'der',
      type: 'spki',
    });
    const body = typeof rawBody === 'string' ? Buffer.from(rawBody) : rawBody;
    return cryptoVerify(
      null,
      Buffer.concat([Buffer.from(timestamp), body]),
      key,
      Buffer.from(signatureHex, 'hex'),
    );
  } catch {
    return false;
  }
}

export function hmacHex(body: Buffer | string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

/** Human-friendly random code, e.g. "7KQ2PF". */
export function randomCode(length = 6): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}
