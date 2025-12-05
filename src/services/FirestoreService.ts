
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

export class FirestoreService {

    async add(collectionPath: string, data: DocumentData): Promise<string> {
        try {
            const colRef = collection(db, collectionPath);
            const docRef = await addDoc(colRef, {
                ...data,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            return docRef.id;
        } catch (error) {
            console.error(`Error adding document to ${collectionPath}:`, error);
            throw error;
        }
    }

    async update(collectionPath: string, id: string, data: Partial<DocumentData>): Promise<void> {
        try {
            const docRef = doc(db, collectionPath, id);
            await updateDoc(docRef, {
                ...data,
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            console.error(`Error updating document ${collectionPath}/${id}:`, error);
            throw error;
        }
    }

    async delete(collectionPath: string, id: string): Promise<void> {
        try {
            const docRef = doc(db, collectionPath, id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error(`Error deleting document ${collectionPath}/${id}:`, error);
            throw error;
        }
    }

    async get<T = DocumentData>(collectionPath: string, id: string): Promise<T | null> {
        try {
            const docRef = doc(db, collectionPath, id);
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                return { id: snapshot.id, ...snapshot.data() } as T;
            }
            return null;
        } catch (error) {
            console.error(`Error getting document ${collectionPath}/${id}:`, error);
            throw error;
        }
    }

    async list<T = DocumentData>(collectionPath: string, constraints: QueryConstraint[] = []): Promise<T[]> {
        try {
            const colRef = collection(db, collectionPath);
            const q = query(colRef, ...constraints);
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as T));
        } catch (error) {
            console.error(`Error listing documents in ${collectionPath}:`, error);
            throw error;
        }
    }
}

export const firestoreService = new FirestoreService();
