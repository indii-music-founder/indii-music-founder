import { clearAllAccountBoundOAuthSessions } from './AccountBoundOAuthSession';
import { logger } from '@/utils/logger';

const CLEANUP_SCHEMA_KEY = 'indii:account-boundary-cleanup';
const CLEANUP_SCHEMA_VERSION = '1';
const LAST_ACCOUNT_KEY = 'indii:last-authenticated-account';

const ACCOUNT_OWNED_LOCAL_STORAGE_KEYS = new Set([
    'workflow_draft',
    'indii_community_webhook_config',
    'indii_custom_entry_commands_v1',
    'indii_custom_dashboard_widgets',
    'indii_visa_checklist_entries',
    'indii_wallet_address',
    'indii_wallet_chain',
    'indii_p2p_passcode',
    'indii_exec_approvals',
    'indii_founder_funnel_active',
    'indii_founder_preview_pending',
    'indii_founder_funnel_queue',
    'indii_founder_funnel_session_id',
]);

const ACCOUNT_OWNED_LOCAL_STORAGE_PREFIXES = [
    'indii_events_',
    'indii:video-session:',
    'indii:social-account-setup:',
    'indii-screenwriter-draft-v2:',
];

const ACCOUNT_OWNED_SESSION_STORAGE_PREFIXES = [
    'yt_google_access_token',
    'yt_google_token_expiry',
];

const ACCOUNT_OWNED_DATABASES = new Set([
    'indii-share-target',
    'indii-audio-cache',
    'indii_media_cache',
    'indii-AI-Cache',
    'rndr-ai-db',
]);

function removeMatchingStorageEntries(
    storage: Storage,
    exactKeys: Set<string>,
    prefixes: string[],
): void {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key && (exactKeys.has(key) || prefixes.some(prefix => key.startsWith(prefix)))) {
            keys.push(key);
        }
    }
    keys.forEach(key => storage.removeItem(key));
}

async function clearDatabaseStores(name: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onerror = () => reject(request.error ?? new Error(`Unable to open ${name}`));
        request.onblocked = () => reject(new Error(`Cleanup of ${name} was blocked`));
        request.onsuccess = () => {
            const database = request.result;
            const storeNames = Array.from(database.objectStoreNames);
            if (storeNames.length === 0) {
                database.close();
                resolve();
                return;
            }

            const transaction = database.transaction(storeNames, 'readwrite');
            storeNames.forEach(storeName => transaction.objectStore(storeName).clear());
            transaction.oncomplete = () => {
                database.close();
                resolve();
            };
            transaction.onerror = () => {
                database.close();
                reject(transaction.error ?? new Error(`Unable to clear ${name}`));
            };
            transaction.onabort = () => {
                database.close();
                reject(transaction.error ?? new Error(`Cleanup of ${name} was aborted`));
            };
        };
    });
}

async function clearKnownAccountOwnedDatabases(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;

    let databaseNames = [...ACCOUNT_OWNED_DATABASES];
    if (typeof indexedDB.databases === 'function') {
        const existing = await indexedDB.databases();
        const existingNames = new Set(existing.map(database => database.name).filter(Boolean));
        databaseNames = databaseNames.filter(name => existingNames.has(name));
    }

    const results = await Promise.allSettled(databaseNames.map(clearDatabaseStores));
    const failures: unknown[] = [];
    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            failures.push(result.reason);
            logger.warn(`[AccountBoundary] Failed to clear ${databaseNames[index]}:`, result.reason);
        }
    });
    if (failures.length > 0) {
        throw new Error(`Failed to clear ${failures.length} account-owned database(s)`);
    }
}

function clearSynchronousAccountOwnedStorage(): void {
    removeMatchingStorageEntries(
        localStorage,
        ACCOUNT_OWNED_LOCAL_STORAGE_KEYS,
        ACCOUNT_OWNED_LOCAL_STORAGE_PREFIXES,
    );
    removeMatchingStorageEntries(
        sessionStorage,
        new Set(['indii_exec_approvals_session']),
        ACCOUNT_OWNED_SESSION_STORAGE_PREFIXES,
    );
    clearAllAccountBoundOAuthSessions();
}

/**
 * Enforce a hard privacy boundary between Firebase identities using the same
 * browser profile. The first run also removes legacy unscoped caches because
 * their owner cannot be established safely.
 */
async function performAccountBoundaryCleanup(currentUid: string | null): Promise<void> {
    const previousUid = localStorage.getItem(LAST_ACCOUNT_KEY);
    const needsSchemaMigration = localStorage.getItem(CLEANUP_SCHEMA_KEY) !== CLEANUP_SCHEMA_VERSION;
    const identityChanged = previousUid !== null && previousUid !== currentUid;

    if (needsSchemaMigration || identityChanged) {
        clearSynchronousAccountOwnedStorage();

        const cleanupTasks = [
            clearKnownAccountOwnedDatabases(),
            import('@/services/intelligence/IntelligenceResponseCache').then(({ aiCache }) => aiCache.clear()),
            import('@/services/audio/OfflineStorageService').then(({ offlineStorageService }) => offlineStorageService.clear()),
            import('@/services/cache/MediaCacheManager').then(({ clearInitializedMediaCache }) => clearInitializedMediaCache()),
            import('@/services/storage/repository').then(({ clearAccountBoundRepositoryState }) => clearAccountBoundRepositoryState()),
            import('@/services/memory/EventLogger').then(({ eventLogger }) => eventLogger.clear()),
            import('@/services/agent/AgentService').then(({ agentService }) => agentService.clearAccountBoundary()),
            import('@/services/security/E2EEncryptionService').then(({ e2eEncryptionService }) => e2eEncryptionService.clearKeys()),
            import('@/services/agent/ContextStackService').then(({ clearContextStackServiceIfInitialized }) => clearContextStackServiceIfInitialized()),
            import('@/services/agent/WebSocketControlPlane').then(({ wcpInstance }) => wcpInstance.clearAccountBoundary()),
            import('@/services/agent/a2a/A2ARouter').then(({ a2aRouter }) => a2aRouter.resetAccountBoundary()),
            import('@/services/agent/a2a/A2AClient').then(({ a2aClient }) => a2aClient.resetAccountBoundary()),
            import('@/services/cache/CacheService').then(({ cacheService }) => cacheService.clear()),
            import('@/services/dashboard/DashboardService').then(({ DashboardService }) => DashboardService.resetCache()),
        ];
        const cleanupResults = await Promise.allSettled(cleanupTasks);
        const cleanupFailures: unknown[] = [];
        cleanupResults.forEach(result => {
            if (result.status === 'rejected') {
                cleanupFailures.push(result.reason);
                logger.warn('[AccountBoundary] Account-owned cache cleanup failed:', result.reason);
            }
        });
        if (cleanupFailures.length > 0) {
            throw new Error(`Failed to clear ${cleanupFailures.length} account-owned cache(s)`);
        }
    }

    const { execApprovalService } = await import('@/services/security/ExecApprovalService');
    execApprovalService.bindAccount(currentUid);

    localStorage.setItem(CLEANUP_SCHEMA_KEY, CLEANUP_SCHEMA_VERSION);
    if (currentUid) localStorage.setItem(LAST_ACCOUNT_KEY, currentUid);
    else localStorage.removeItem(LAST_ACCOUNT_KEY);
}

let accountBoundaryCleanupQueue: Promise<void> = Promise.resolve();

export function enforceAccountBoundaryCleanup(currentUid: string | null): Promise<void> {
    // Identity changes can arrive while IndexedDB/service cleanup for the
    // previous transition is still running. Serialize them so an older pass
    // can never finish last and rebind approvals or the owner marker to the
    // wrong account.
    const cleanup = accountBoundaryCleanupQueue
        .catch(() => undefined)
        .then(() => performAccountBoundaryCleanup(currentUid));
    accountBoundaryCleanupQueue = cleanup;
    return cleanup;
}
