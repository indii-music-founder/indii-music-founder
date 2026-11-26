import { createHash } from 'node:crypto';

const VERIFIED_UID_CACHE_MAX_TTL_MS = 5 * 60_000;
const VERIFIED_UID_CACHE_MAX_ENTRIES = 16;
const VERIFIED_UID_TIMEOUT_MS = 4_000;

interface VerifiedUidCacheEntry {
    uid: string;
    expiresAt: number;
}

const verifiedUidCache = new Map<string, VerifiedUidCacheEntry>();
const inFlightVerifications = new Map<string, Promise<string>>();

function tokenCacheKey(idToken: string): string {
    return createHash('sha256').update(idToken).digest('hex');
}

function readJwtExpiryMs(idToken: string): number | null {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    try {
        const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as { exp?: unknown };
        if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) {
            return payload.exp * 1000;
        }
    } catch {
        return null;
    }
    return null;
}

function cacheVerifiedUid(key: string, uid: string, idToken: string): void {
    const now = Date.now();
    const jwtExpiryMs = readJwtExpiryMs(idToken);
    const maxAllowedExpiry = jwtExpiryMs ? Math.min(now + VERIFIED_UID_CACHE_MAX_TTL_MS, jwtExpiryMs - 30_000) : now + VERIFIED_UID_CACHE_MAX_TTL_MS;
    if (maxAllowedExpiry <= now) return;

    if (verifiedUidCache.has(key)) {
        verifiedUidCache.delete(key);
    } else if (verifiedUidCache.size >= VERIFIED_UID_CACHE_MAX_ENTRIES) {
        const oldestKey = verifiedUidCache.keys().next().value;
        if (oldestKey !== undefined) {
            verifiedUidCache.delete(oldestKey);
        }
    }
    verifiedUidCache.set(key, { uid, expiresAt: maxAllowedExpiry });
}

export function clearVerifiedAgentKnowledgeCache(): void {
    verifiedUidCache.clear();
    inFlightVerifications.clear();
}

/** Resolve a Firebase ID token through the existing server-owned profile API.
 * The installed desktop app does not carry Firebase Admin service credentials.
 * Caches verified token hashes briefly and deduplicates concurrent Boardroom seat calls.
 */
export async function verifiedAgentKnowledgeUid(idToken: string, appCheckToken?: string): Promise<string> {
    const key = tokenCacheKey(idToken);
    const cached = verifiedUidCache.get(key);
    if (cached) {
        if (cached.expiresAt > Date.now()) {
            return cached.uid;
        }
        verifiedUidCache.delete(key);
    }

    const existing = inFlightVerifications.get(key);
    if (existing) {
        return existing;
    }

    const verifyPromise = (async () => {
        const headers: Record<string, string> = {
            Authorization: `Bearer ${idToken}`,
            Origin: 'https://indii.music',
            Referer: 'https://indii.music/',
            'X-App-Client-Type': 'electron-desktop-app',
        };
        if (typeof appCheckToken === 'string' && appCheckToken.trim().length > 0) {
            headers['X-Firebase-AppCheck'] = appCheckToken.trim();
        }
        const response = await fetch('https://us-central1-indii-music-founder.cloudfunctions.net/getProfile', {
            method: 'GET',
            headers,
            redirect: 'error',
            signal: AbortSignal.timeout(VERIFIED_UID_TIMEOUT_MS),
        });
        if (!response.ok) throw new Error(`Signed-in account verification failed (${response.status})`);
        const envelope: unknown = await response.json();
        const data = envelope && typeof envelope === 'object' && 'success' in envelope && envelope.success === true &&
            'data' in envelope ? envelope.data : undefined;
        const uid = data && typeof data === 'object' && 'id' in data ? data.id : undefined;
        if (typeof uid !== 'string' || !uid || uid.length > 128 || uid.includes('/')) {
            throw new Error('Account verification returned an invalid identity');
        }
        cacheVerifiedUid(key, uid, idToken);
        return uid;
    })().finally(() => {
        inFlightVerifications.delete(key);
    });

    inFlightVerifications.set(key, verifyPromise);
    return verifyPromise;
}
