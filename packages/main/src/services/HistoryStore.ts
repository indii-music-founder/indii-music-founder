import Store from 'electron-store';
import { app } from 'electron';
import log from 'electron-log';


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
        // @ts-expect-error
        const sessions = this.store.get('sessions');
        return sessions[sessionId] || null;
    }

    getAll(): SessionData[] {
        // @ts-expect-error
        const sessions = this.store.get('sessions');
        return Object.values(sessions);
    }

    save(sessionId: string, data: SessionData): void {
        // @ts-expect-error
        const sessions = this.store.get('sessions');
        const existing = sessions[sessionId] || {};
        sessions[sessionId] = { ...existing, ...data };
        // @ts-expect-error
        this.store.set('sessions', sessions);
    }

    delete(sessionId: string): void {
        // @ts-expect-error
        const sessions = this.store.get('sessions');
        delete sessions[sessionId];
        // @ts-expect-error
        this.store.set('sessions', sessions);
    }

    clearAll(): void {
        // @ts-expect-error
        this.store.clear();
    }
}

export const historyStore = new HistoryStore();
