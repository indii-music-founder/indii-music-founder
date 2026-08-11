import {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    collection,
    query,
    where,
    getDocs,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    addDoc,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateDoc,
    orderBy
} from 'firebase/firestore';
import { FirestoreService } from './FirestoreService';
import { events } from '@/core/events';
import { logger } from '@/utils/logger';
import { DEFAULT_PROJECT_ID, LEGACY_DEFAULT_PROJECT_ID, isDefaultProject } from '@/core/constants';

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
        [key: string]: unknown;
    };
    createdAt: number;
    updatedAt: number;
    isTrashed?: boolean;
}

export class FileSystemService extends FirestoreService<FileNode> {
    constructor() {
        super('file_nodes');
    }

    async getProjectNodes(projectId: string): Promise<FileNode[]> {
        // The default/unassigned bucket historically carries TWO sentinel values
        // ('default' from appSlice, 'default-project' from StorageService) — both
        // exist in production data, so default-bucket reads must match both.
        const projectFilter = isDefaultProject(projectId)
            ? where('projectId', 'in', [DEFAULT_PROJECT_ID, LEGACY_DEFAULT_PROJECT_ID])
            : where('projectId', '==', projectId);

        try {
            const q = query(
                this.collection,
                projectFilter,
                orderBy('createdAt', 'asc')
            );

            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as FileNode)).filter(node => !node.isTrashed);
        } catch (error: unknown) {
            // Fallback for missing index error
            if (error && typeof error === 'object' && 'code' in error && error.code === 'failed-precondition') {
                logger.warn('Firestore index missing, falling back to client-side sort', error);
                const q = query(this.collection, projectFilter);
                const snapshot = await getDocs(q);
                return snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as FileNode)).filter(node => !node.isTrashed).sort((a, b) => a.createdAt - b.createdAt);
            }
            logger.error('Error fetching project nodes:', error);
            events.emit('SYSTEM_ALERT', { level: 'error', message: 'Failed to load project files' });
            throw error;
        }
    }

    async createNode(node: Omit<FileNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<FileNode> {
        try {
            // Use this.add to ensure pruneUndefined is applied, preventing "invalid nested entity" errors
            const id = await this.add(node);
            return {
                id,
                ...node,
                createdAt: Date.now(),
                updatedAt: Date.now()
            } as FileNode;
        } catch (error: unknown) {
            logger.error('Error creating node:', error);
            events.emit('SYSTEM_ALERT', { level: 'error', message: 'Failed to create file/folder' });
            throw error;
        }
    }

    async updateNode(id: string, updates: Partial<FileNode>): Promise<void> {
        try {
            await this.update(id, {
                ...updates,
                updatedAt: Date.now()
            });
        } catch (error: unknown) {
            logger.error('Error updating node:', error);
            events.emit('SYSTEM_ALERT', { level: 'error', message: 'Failed to update file/folder' });
            throw error;
        }
    }

    async deleteNode(id: string): Promise<void> {
        try {
            const { trashService } = await import('./trash/TrashService');
            await trashService.moveToTrash(
                { type: 'file_nodes', targetId: id },
                { actor: 'user', reason: 'User requested node deletion' }
            );
        } catch (error: unknown) {
            logger.error('Error moving node to trash:', error);
            events.emit('SYSTEM_ALERT', { level: 'error', message: 'Failed to move item to trash' });
            throw error;
        }
    }

    // Helper to move a folder tree to Trash recursively
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
            const { trashService } = await import('./trash/TrashService');
            // Children first keeps the tree navigable if any individual move fails.
            for (const id of Array.from(idsToDelete).reverse()) {
                await trashService.moveToTrash(
                    { type: 'file_nodes', targetId: id },
                    { actor: 'user', reason: 'User moved a file or folder tree to Trash' }
                );
            }
            events.emit('SYSTEM_ALERT', { level: 'success', message: `Moved ${idsToDelete.size} items to Trash` });
        } catch (error: unknown) {
            logger.error('Error moving folder tree to trash:', error);
            events.emit('SYSTEM_ALERT', { level: 'error', message: 'Failed to move all folder contents to Trash' });
            throw error;
        }
    }
}

export const fileSystemService = new FileSystemService();
