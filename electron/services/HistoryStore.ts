
import Store from 'electron-store';
import { app } from 'electron';
import path from 'path';

interface HistorySchema {
    sessions: Record<string, any>; // Session ID -> Session Data
}

class HistoryStore {
    private store: Store<HistorySchema>;

    constructor() {
        this.store = new Store<HistorySchema>({
            name: 'chat-history',
            cwd: app.getPath('userData'), // Explicitly set path
            defaults: {
                sessions: {}
            }
        });
        console.log('[HistoryStore] Initialized at:', this.store.path);
    }

    get(sessionId: string): any | null {
        const sessions = this.store.get('sessions');
        return sessions[sessionId] || null;
    }

    getAll(): any[] {
        const sessions = this.store.get('sessions');
        return Object.values(sessions);
    }

    save(sessionId: string, data: any): void {
        const sessions = this.store.get('sessions');

        // Merge if exists, or overwrite?
        // Usually we want to overwrite with latest state or merge messages.
        // For simplicity and correctness with the store logic, we'll assume 'data' is the full session object
        // or a significant partial update.
        // If it's a partial update, we should fetch first.

        const existing = sessions[sessionId] || {};
        const updated = { ...existing, ...data };

        this.store.set(`sessions.${sessionId}`, updated);
    }

    delete(sessionId: string): void {
        this.store.delete(`sessions.${sessionId}` as any);
    }

    clearAll(): void {
        this.store.clear();
    }
}

export const historyStore = new HistoryStore();
