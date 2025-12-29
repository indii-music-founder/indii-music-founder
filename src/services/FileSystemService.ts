import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    orderBy
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

    // Helper to delete recursively
    async deleteFolderRecursive(folderId: string, allNodes: FileNode[]): Promise<void> {
        const children = allNodes.filter(n => n.parentId === folderId);
        for (const child of children) {
            if (child.type === 'folder') {
                await this.deleteFolderRecursive(child.id, allNodes);
            }
            await this.deleteNode(child.id);
        }
        await this.deleteNode(folderId);
    }
}

export const fileSystemService = new FileSystemService();
