
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
    DocumentData
} from 'firebase/firestore';
import { db } from './firebase';

export class FirestoreService<T extends DocumentData = DocumentData> {
    constructor(protected collectionPath: string) { }

    protected get collection() {
        return collection(db, this.collectionPath);
    }

    async add(data: Omit<T, 'id'>): Promise<string> {
        try {
            const docRef = await addDoc(this.collection, {
                ...data,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            return docRef.id;
        } catch (error) {
            console.error(`Error adding document to ${this.collectionPath}:`, error);
            throw error;
        }
    }

    async update(id: string, data: Partial<T>): Promise<void> {
        try {
            const docRef = doc(db, this.collectionPath, id);
            await updateDoc(docRef, {
                ...data,
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            console.error(`Error updating document ${this.collectionPath}/${id}:`, error);
            throw error;
        }
    }

    async delete(id: string): Promise<void> {
        try {
            const docRef = doc(db, this.collectionPath, id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error(`Error deleting document ${this.collectionPath}/${id}:`, error);
            throw error;
        }
    }

    async get(id: string): Promise<T | null> {
        try {
            const docRef = doc(db, this.collectionPath, id);
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                return { id: snapshot.id, ...snapshot.data() } as unknown as T;
            }
            return null;
        } catch (error) {
            console.error(`Error getting document ${this.collectionPath}/${id}:`, error);
            throw error;
        }
    }

    async list(constraints: QueryConstraint[] = []): Promise<T[]> {
        try {
            const q = query(this.collection, ...constraints);
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as unknown as T));
        } catch (error) {
            console.error(`Error listing documents in ${this.collectionPath}:`, error);
            throw error;
        }
    }

    // Specialized query method that allows flexible sorting client-side if needed (for small datasets)
    async query(constraints: QueryConstraint[] = [], sorter?: (a: T, b: T) => number): Promise<T[]> {
        const results = await this.list(constraints);
        if (sorter) {
            return results.sort(sorter);
        }
        return results;
    }
}

// Deprecated: Legacy singleton export to maintain backward compatibility during migration
// TODO: Remove after full migration
// export const firestoreService = new FirestoreService<any>('legacy_fallback');
