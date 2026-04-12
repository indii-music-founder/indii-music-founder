import Store from 'electron-store';
import { app } from 'electron';
import log from 'electron-log';

// Define a type-safe interface for the underlying store methods to bypass electron-store type resolution issues
interface IElectronStore {
    get(key: string): unknown;
    set(key: string, value: unknown): void;
    clear(): void;
}

/**
 * Schema for session data persisted via electron-store.
 * Each session is keyed by its unique ID and stores an arbitrary JSON payload.
 */
interface SessionData {
    id?: string;
    title?: string;
    messages?: unknown[];
    createdAt?: number;
    updatedAt?: number;
    [key: string]: unknown;
}

interface HistorySchema {
    sessions: Record<string, SessionData>;
}

export class HistoryStore {
    private _store: Store<HistorySchema> | undefined;

    private get store(): Store<HistorySchema> {
        if (!this._store) {
            this._store = new Store<HistorySchema>({
                name: 'chat-history',
                cwd: app.getPath('userData'),
                defaults: {
                    sessions: {},
                },
            });
            log.info('[HistoryStore] Initialized at:', (this._store as unknown as { path: string }).path);
        }
        return this._store;
    }

    constructor() {
        // Initialization is lazy to prevent calling app.getPath before app is ready
    }

    get(sessionId: string): SessionData | null {
        const storeSafe = this.store as unknown as IElectronStore;
        const sessions = storeSafe.get('sessions') as Record<string, SessionData>;
        return sessions[sessionId] || null;
    }

    getAll(): SessionData[] {
        const storeSafe = this.store as unknown as IElectronStore;
        const sessions = storeSafe.get('sessions') as Record<string, SessionData>;
        return Object.values(sessions);
    }

    save(sessionId: string, data: SessionData): void {
        const storeSafe = this.store as unknown as IElectronStore;
        const sessions = storeSafe.get('sessions') as Record<string, SessionData>;
        const existing = sessions[sessionId] || {};
        const updated = { ...existing, ...data };
        storeSafe.set(`sessions.${sessionId}`, updated);
    }

    delete(sessionId: string): void {
        const storeSafe = this.store as unknown as IElectronStore;
        const sessions = storeSafe.get('sessions') as Record<string, SessionData>;
        delete sessions[sessionId];
        storeSafe.set('sessions', sessions);
    }

    clearAll(): void {
        const storeSafe = this.store as unknown as IElectronStore;
        storeSafe.clear();
    }
}

export const historyStore = new HistoryStore();
