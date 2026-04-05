
import Store from 'electron-store';
import { app } from 'electron';
import path from 'path';

interface HistorySchema {
    sessions: Record<string, any>; // Session ID -> Session Data
}

export class HistoryStore {
    private _store: Store<HistorySchema> | undefined;

    private get store(): Store<HistorySchema> {
        if (!this._store) {
            this._store = new Store<HistorySchema>({
                name: 'chat-history',
                cwd: app.getPath('userData'), // Explicitly set path
                defaults: {
                    sessions: {}
                }
            });
            console.log('[HistoryStore] Initialized at:', (this._store as any).path);
        }
        return this._store;
    }

    constructor() {
        // Initialization is lazy to prevent calling app.getPath before app is ready
    }

    get(sessionId: string): any | null {
        const sessions = (this.store as any).get('sessions');
        return sessions[sessionId] || null;
    }

    getAll(): any[] {
        const sessions = (this.store as any).get('sessions');
        return Object.values(sessions);
    }

    save(sessionId: string, data: any): void {
        const sessions = (this.store as any).get('sessions');

        // Merge if exists, or overwrite?
        // Usually we want to overwrite with latest state or merge messages.
        // For simplicity and correctness with the store logic, we'll assume 'data' is the full session object
        // or a significant partial update.
        // If it's a partial update, we should fetch first.

        const existing = sessions[sessionId] || {};
        const updated = { ...existing, ...data };

        (this.store as any).set(`sessions.${sessionId}`, updated);
    }

    delete(sessionId: string): void {
        const sessions = (this.store as any).get('sessions');
        delete sessions[sessionId];
        (this.store as any).set('sessions', sessions);
    }

    clearAll(): void {
        (this.store as any).clear();
    }
}

export const historyStore = new HistoryStore();
