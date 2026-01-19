import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    orderBy,
    writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { FirestoreService } from './FirestoreService';

export interface FileNode {
    id: string;
    name: string;
    type: 'folder' | 'file';
    parentId: string | null;
    projectId: string;
    userId: string;
    fileType?: 'image' | 'video' | 'audio' | 'document' | 'other';
    data?: {
        url?: string;
        storagePath?: string;
        size?: number;
        mimeType?: string;
        [key: string]: any;
    };
    createdAt: number;
    updatedAt: number;
}

export class FileSystemService extends FirestoreService<FileNode> {
    constructor() {
        super('file_nodes');
    }

    async getProjectNodes(projectId: string): Promise<FileNode[]> {
        try {
            const q = query(
                this.collection,
                where('projectId', '==', projectId),
                orderBy('createdAt', 'asc')
            );

            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as FileNode));
        } catch (error: any) {
            // Fallback for missing index error
            if (error.code === 'failed-precondition') {
                console.warn('Firestore index missing, falling back to client-side sort', error);
                const q = query(this.collection, where('projectId', '==', projectId));
                const snapshot = await getDocs(q);
                return snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as FileNode)).sort((a, b) => a.createdAt - b.createdAt);
            }
            console.error('Error fetching project nodes:', error);
            throw error;
        }
    }

    async createNode(node: Omit<FileNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<FileNode> {
        try {
            const docRef = await addDoc(this.collection, {
                ...node,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            return {
                id: docRef.id,
                ...node,
                createdAt: Date.now(),
                updatedAt: Date.now()
            } as FileNode;
        } catch (error) {
            console.error('Error creating node:', error);
            throw error;
        }
    }

    async updateNode(id: string, updates: Partial<FileNode>): Promise<void> {
        try {
            const docRef = doc(db, this.collectionPath, id);
            await updateDoc(docRef, {
                ...updates,
                updatedAt: Date.now()
            });
        } catch (error) {
            console.error('Error updating node:', error);
            throw error;
        }
    }

    async deleteNode(id: string): Promise<void> {
        try {
            const docRef = doc(db, this.collectionPath, id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error('Error deleting node:', error);
            throw error;
        }
    }

    /**
     * Efficiently deletes multiple nodes in batches (limit 500 per batch)
     */
    async batchDelete(ids: string[]): Promise<void> {
        if (ids.length === 0) return;

        const CHUNK_SIZE = 500;
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
            const chunk = ids.slice(i, i + CHUNK_SIZE);
            const batch = writeBatch(db);

            chunk.forEach(id => {
                const docRef = doc(db, this.collectionPath, id);
                batch.delete(docRef);
            });

            await batch.commit();
        }
    }

    // Helper to delete recursively
    async deleteFolderRecursive(folderId: string, allNodes: FileNode[]): Promise<void> {
        // Optimization: Build adjacency list for O(N) traversal instead of O(N^2)
        const childrenMap = new Map<string, FileNode[]>();
        allNodes.forEach(node => {
            if (node.parentId) {
                const existing = childrenMap.get(node.parentId) || [];
                existing.push(node);
                childrenMap.set(node.parentId, existing);
            }
        });

        const idsToDelete = new Set<string>();
        idsToDelete.add(folderId);

        const stack = [folderId];
        while (stack.length > 0) {
            const currentId = stack.pop()!;
            const children = childrenMap.get(currentId) || [];

            for (const child of children) {
                if (!idsToDelete.has(child.id)) {
                    idsToDelete.add(child.id);
                    if (child.type === 'folder') {
                        stack.push(child.id);
                    }
                }
            }
        }

        try {
            await this.batchDelete(Array.from(idsToDelete));
        } catch (error) {
            console.error('Error batch deleting nodes:', error);
            throw error;
        }
    }
}

export const fileSystemService = new FileSystemService();
