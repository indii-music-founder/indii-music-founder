import { COPYRIGHT_PORTAL_HOSTS } from '@indii/shared';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
interface AuthCookie { name: string; value: string; domain: string; path: string; expires: number; httpOnly: boolean; secure: boolean; sameSite: 'Strict' | 'Lax' | 'None' }
const consentRef = (uid: string) => getFirestore().doc(`users/${uid}/rightsPortalConsents/loc_copyright`);
const aad = (uid: string, version: number) => Buffer.from(JSON.stringify({ uid, portal: 'loc_copyright', version }));
const vaultReady = () => Boolean(process.env.RIGHTS_VAULT_BUCKET && process.env.RIGHTS_KMS_KEY && process.env.RIGHTS_AUTH_COOKIE_NAMES && COPYRIGHT_PORTAL_HOSTS.includes(process.env.RIGHTS_AUTH_COOKIE_HOST ?? ''));

/** No general storageState blobs: only reviewed eCO authentication cookies. */
export async function rememberCookies(uid: string, raw: unknown): Promise<void> {
  if (!vaultReady() || !Array.isArray(raw)) return;
  const before = (await consentRef(uid).get()).data();
  if (!before?.enabled || before.expiresAtMs <= Date.now()) return;
  const allow = new Set(process.env.RIGHTS_AUTH_COOKIE_NAMES!.split(',').map(s => s.trim()));
  const cookies: AuthCookie[] = raw.filter(c => c && typeof c === 'object' && allow.has(c.name)
    && typeof c.domain === 'string' && c.domain.replace(/^\./, '') === process.env.RIGHTS_AUTH_COOKIE_HOST && c.secure && c.httpOnly && typeof c.value === 'string' && c.value.length <= 4096)
    .map(c => ({ name: c.name, value: c.value, domain: c.domain, path: c.path, expires: c.expires, httpOnly: c.httpOnly, secure: c.secure, sameSite: c.sameSite }));
  if (!cookies.length || cookies.length > 20) return;
  const key = randomBytes(32), iv = randomBytes(12);
  try {
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad(uid, before.version));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify({ cookies, origins: [] })), cipher.final()]);
  const wrapped = await auth.request<{ ciphertext: string }>({ url: `https://cloudkms.googleapis.com/v1/${process.env.RIGHTS_KMS_KEY}:encrypt`, method: 'POST', data: { plaintext: key.toString('base64') } });
  const current = (await consentRef(uid).get()).data();
  if (!current?.enabled || current.version !== before.version || current.expiresAtMs <= Date.now()) return;
  const file = getStorage().bucket(process.env.RIGHTS_VAULT_BUCKET).file(`auth/${uid}/loc_copyright/v${before.version}.json`);
  await file.save(JSON.stringify({ version: before.version, expiresAtMs: before.expiresAtMs, ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), wrappedKey: wrapped.data.ciphertext }), { resumable: false, metadata: { contentType: 'application/json', cacheControl: 'no-store' } });
  const after = (await consentRef(uid).get()).data();
  if (!after?.enabled || after.version !== before.version) await file.delete({ ignoreNotFound: true });
  } finally { key.fill(0); }
}

export async function restoreCookies(uid: string): Promise<unknown | undefined> {
  if (!vaultReady()) return undefined;
  const consent = (await consentRef(uid).get()).data();
  if (!consent?.enabled || consent.expiresAtMs <= Date.now()) return undefined;
  const file = getStorage().bucket(process.env.RIGHTS_VAULT_BUCKET).file(`auth/${uid}/loc_copyright/v${consent.version}.json`);
  if (!(await file.exists())[0]) return undefined;
  const [data] = await file.download();
  const envelope = JSON.parse(data.toString());
  if (envelope.version !== consent.version || envelope.expiresAtMs <= Date.now()) return undefined;
  const result = await auth.request<{ plaintext: string }>({ url: `https://cloudkms.googleapis.com/v1/${process.env.RIGHTS_KMS_KEY}:decrypt`, method: 'POST', data: { ciphertext: envelope.wrappedKey } });
  const key = Buffer.from(result.data.plaintext, 'base64');
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
    decipher.setAAD(aad(uid, consent.version)); decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    const state = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString());
    const latest = (await consentRef(uid).get()).data();
    return latest?.enabled && latest.version === consent.version && latest.expiresAtMs > Date.now() ? state : undefined;
  } finally { key.fill(0); }
}
