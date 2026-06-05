/* eslint-disable @typescript-eslint/no-explicit-any -- Service layer uses dynamic types for external API responses */

import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDoc,
    getDocs,
    query,
    where,
    QueryConstraint,
    Timestamp,
    DocumentData,
    onSnapshot,
    Unsubscribe,
    setDoc,
    orderBy,
    OrderByDirection,
    WhereFilterOp,
    writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';

export class FirestoreService<T extends DocumentData = DocumentData> {
    private static e2eCache: Record<string, any> = {};

    constructor(protected collectionPath: string) { }

    private getCacheKey(id: string): string {
        return `${this.collectionPath}/${id}`;
    }

    protected get collection() {
        return collection(db, this.collectionPath);
    }

    // Helper for where clause
    protected where(field: string, op: WhereFilterOp, value: any): QueryConstraint {
        return where(field, op, value);
    }

    // Helper for order by
    protected orderBy(field: string, direction: OrderByDirection = 'asc'): QueryConstraint {
        return orderBy(field, direction);
    }

    /** E2E test mode: skip real Firestore writes to avoid offline-mode hangs. */
    private get isE2EMode(): boolean {
        return isFirebaseE2EMockEnabled();
    }

    async add(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const id = `mock-doc-${Date.now()}`;
        if (this.isE2EMode) {
            const mockDoc = {
                ...data,
                id,
                createdAt: Date.now(),
                updatedAt: Date.now()
            } as any;
            FirestoreService.e2eCache[this.getCacheKey(id)] = mockDoc;
            return id;
        }
        const docRef = await addDoc(this.collection, this.pruneUndefined({
            ...data,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        }));
        return docRef.id;
    }

    async set(id: string, data: T): Promise<void> {
        if (this.isE2EMode) {
            FirestoreService.e2eCache[this.getCacheKey(id)] = {
                ...data,
                updatedAt: Date.now()
            };
            return;
        }
        const docRef = doc(db, this.collectionPath, id);
        await setDoc(docRef, this.pruneUndefined({
            ...data,
            updatedAt: Timestamp.now()
        }), { merge: true });
    }

    async update(id: string, data: Partial<T>): Promise<void> {
        if (this.isE2EMode) {
            const key = this.getCacheKey(id);
            const existing = FirestoreService.e2eCache[key] || {};
            FirestoreService.e2eCache[key] = {
                ...existing,
                ...data,
                updatedAt: Date.now()
            };
            return;
        }
        const docRef = doc(db, this.collectionPath, id);
        await updateDoc(docRef, this.pruneUndefined({
            ...data,
            updatedAt: Timestamp.now()
        }));
    }

    private pruneUndefined(obj: any): any {
        if (obj === null || typeof obj !== 'object' || (typeof Timestamp === 'function' && obj instanceof Timestamp)) return obj;
        if (Array.isArray(obj)) return obj.map(item => this.pruneUndefined(item));

        const pruned: any = {};
        Object.keys(obj).forEach(key => {
            if (obj[key] !== undefined) {
                pruned[key] = this.pruneUndefined(obj[key]);
            }
        });
        return pruned;
    }

    async delete(id: string): Promise<void> {
        if (this.isE2EMode) {
            delete FirestoreService.e2eCache[this.getCacheKey(id)];
            return;
        }
        const docRef = doc(db, this.collectionPath, id);
        await deleteDoc(docRef);
    }

    /**
     * Deletes multiple documents in batches.
     * Firestore batches are limited to 500 operations.
     */
    async deleteMany(ids: string[]): Promise<void> {
        if (ids.length === 0) return;
        if (this.isE2EMode) {
            ids.forEach(id => {
                delete FirestoreService.e2eCache[this.getCacheKey(id)];
            });
            return;
        }

        const CHUNK_SIZE = 500;
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
            const chunk = ids.slice(i, i + CHUNK_SIZE);
            const batch = writeBatch(db);
            chunk.forEach((id) => {
                const docRef = doc(db, this.collectionPath, id);
                batch.delete(docRef);
            });
            await batch.commit();
        }
    }

    /**
     * Updates multiple documents in batches.
     * Firestore batches are limited to 500 operations.
     */
    async updateMany(updates: { id: string; data: Partial<T> }[]): Promise<void> {
        if (updates.length === 0) return;
        if (this.isE2EMode) {
            const now = Date.now();
            updates.forEach(({ id, data }) => {
                const key = this.getCacheKey(id);
                const existing = FirestoreService.e2eCache[key] || {};
                FirestoreService.e2eCache[key] = {
                    ...existing,
                    ...data,
                    updatedAt: now
                };
            });
            return;
        }

        const CHUNK_SIZE = 500;
        for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
            const chunk = updates.slice(i, i + CHUNK_SIZE);
            const batch = writeBatch(db);
            const now = Timestamp.now();

            chunk.forEach(({ id, data }) => {
                const docRef = doc(db, this.collectionPath, id);
                batch.update(docRef, this.pruneUndefined({
                    ...data,
                    updatedAt: now
                }));
            });
            await batch.commit();
        }
    }

    async get(id: string): Promise<T | null> {
        if (this.isE2EMode) {
            const cached = FirestoreService.e2eCache[this.getCacheKey(id)];
            if (cached) return cached as T;
            return null;
        }
        const docRef = doc(db, this.collectionPath, id);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            return { id: snapshot.id, ...snapshot.data() } as unknown as T;
        }
        return null;
    }

    async list(constraints: QueryConstraint[] = []): Promise<T[]> {
        if (this.isE2EMode) {
            const prefix = `${this.collectionPath}/`;
            const results: T[] = [];
            for (const [key, value] of Object.entries(FirestoreService.e2eCache)) {
                if (key.startsWith(prefix)) {
                    results.push(value as T);
                }
            }
            return results;
        }
        const q = query(this.collection, ...constraints);
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as unknown as T));
    }

    // Specialized query method that allows flexible sorting client-side if needed (for small datasets)
    async query(constraints: QueryConstraint[] = [], sorter?: (a: T, b: T) => number): Promise<T[]> {
        const results = await this.list(constraints);
        if (sorter) {
            return results.sort(sorter);
        }
        return results;
    }

    /**
     * Subscribes to real-time updates for a query.
     */
    subscribe(constraints: QueryConstraint[], callback: (data: T[]) => void, onError?: (error: Error) => void): Unsubscribe {
        if (this.isE2EMode) {
            const prefix = `${this.collectionPath}/`;
            const getResults = () => {
                const results: T[] = [];
                for (const [key, value] of Object.entries(FirestoreService.e2eCache)) {
                    if (key.startsWith(prefix)) {
                        results.push(value as T);
                    }
                }
                return results;
            };
            setTimeout(() => callback(getResults()), 0);
            return () => {};
        }
        const q = query(this.collection, ...constraints);
        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as unknown as T));
            callback(data);
        }, (error) => {
            if (onError) onError(error as Error);
        });
    }

    /**
     * Subscribes to real-time updates for a single document.
     */
    subscribeDoc(id: string, callback: (data: T | null) => void, onError?: (error: Error) => void): Unsubscribe {
        if (this.isE2EMode) {
            setTimeout(() => {
                const cached = FirestoreService.e2eCache[this.getCacheKey(id)];
                callback(cached ? cached as T : null);
            }, 0);
            return () => {};
        }
        const docRef = doc(db, this.collectionPath, id);
        return onSnapshot(docRef, (snapshot) => {
            if (snapshot.exists()) {
                callback({ id: snapshot.id, ...snapshot.data() } as unknown as T);
            } else {
                callback(null);
            }
        }, (error) => {
            if (onError) onError(error as Error);
        });
    }
}

// Note: Each service that needs Firestore should instantiate its own typed FirestoreService
// Example: const userService = new FirestoreService<User>('users');
