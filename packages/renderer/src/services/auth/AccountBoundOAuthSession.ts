const OAUTH_SESSION_MAX_AGE_MS = 10 * 60 * 1000;

const ACCOUNT_BOUND_OAUTH_PROVIDERS: AccountBoundOAuthProvider[] = [
    'spotify',
    'instagram',
    'tiktok',
    'gmail',
    'outlook',
];

export type AccountBoundOAuthProvider = 'spotify' | 'instagram' | 'tiktok' | 'gmail' | 'outlook';

interface StoredOAuthSession {
    state: string;
    ownerUid: string;
    createdAt: number;
    codeVerifier?: string;
}

function storageKey(provider: AccountBoundOAuthProvider): string {
    return `indii:oauth:${provider}`;
}

export function beginAccountBoundOAuthSession(
    provider: AccountBoundOAuthProvider,
    ownerUid: string,
    options: { codeVerifier?: string } = {},
): StoredOAuthSession {
    if (!ownerUid) throw new Error('Sign in before connecting an external account.');
    const session: StoredOAuthSession = {
        state: crypto.randomUUID(),
        ownerUid,
        createdAt: Date.now(),
        ...(options.codeVerifier ? { codeVerifier: options.codeVerifier } : {}),
    };
    sessionStorage.setItem(storageKey(provider), JSON.stringify(session));
    return session;
}

export function requireAccountBoundOAuthSession(
    provider: AccountBoundOAuthProvider,
    returnedState: string,
    currentUid: string | undefined,
): StoredOAuthSession {
    if (!currentUid) throw new Error('Sign in with the account that started this connection.');

    const raw = sessionStorage.getItem(storageKey(provider));
    let session: StoredOAuthSession | null = null;
    try {
        session = raw ? JSON.parse(raw) as StoredOAuthSession : null;
    } catch {
        clearAccountBoundOAuthSession(provider);
    }

    if (
        !session
        || typeof session.state !== 'string'
        || typeof session.ownerUid !== 'string'
        || typeof session.createdAt !== 'number'
        || session.state !== returnedState
    ) {
        clearAccountBoundOAuthSession(provider);
        throw new Error('OAuth state mismatch — possible CSRF attack. Start the connection again.');
    }
    if (session.ownerUid !== currentUid) {
        clearAccountBoundOAuthSession(provider);
        throw new Error('The signed-in account changed during authorization. Start the connection again.');
    }
    if (Date.now() - session.createdAt > OAUTH_SESSION_MAX_AGE_MS) {
        clearAccountBoundOAuthSession(provider);
        throw new Error('The authorization request expired. Start the connection again.');
    }
    return session;
}

export function clearAccountBoundOAuthSession(provider: AccountBoundOAuthProvider): void {
    sessionStorage.removeItem(storageKey(provider));
}

export function clearAllAccountBoundOAuthSessions(): void {
    ACCOUNT_BOUND_OAUTH_PROVIDERS.forEach(clearAccountBoundOAuthSession);
}
