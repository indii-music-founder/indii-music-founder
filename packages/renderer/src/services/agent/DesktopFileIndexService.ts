import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import type { ElectronAPI } from '@indii/shared/ipc/electron-api.types';

export interface ApprovedAssetFolder {
    id: string;
    label: string;
    path: string;
}

export interface LocalAssetMatch {
    folderId: string;
    folderLabel: string;
    name: string;
    relativePath: string;
    extension: string;
    sizeBytes: number;
    modifiedAt: number;
}

/**
 * Owner-scoped registry for folders a creator deliberately chose in Studio.
 * It does not upload or expose files: all search remains in the local Electron
 * process and only redacted metadata is returned to an agent.
 */
class DesktopFileIndexService {
    private foldersRef(userId: string) {
        return collection(db, 'users', userId, 'desktopAssetFolders');
    }

    async approveFolder(): Promise<ApprovedAssetFolder | null> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Sign in before approving a desktop asset folder.');
        const electron = window.electronAPI as ElectronAPI | undefined;
        if (!electron?.selectDirectory) {
            throw new Error('Desktop asset folders can only be approved in the Studio app.');
        }
        const path = await electron.selectDirectory({ title: 'Choose a folder to make available to your Studio agents' });
        if (!path) return null;
        const label = path.split(/[\\/]/).filter(Boolean).at(-1) || 'Approved assets';
        const ref = await addDoc(this.foldersRef(userId), { label, path, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        return { id: ref.id, label, path };
    }

    async listApprovedFolders(): Promise<ApprovedAssetFolder[]> {
        const userId = auth.currentUser?.uid;
        if (!userId) return [];
        const folders = await getDocs(query(this.foldersRef(userId), orderBy('updatedAt', 'desc')));
        return folders.docs.flatMap(folder => {
            const data = folder.data() as { label?: unknown; path?: unknown };
            return typeof data.label === 'string' && typeof data.path === 'string'
                ? [{ id: folder.id, label: data.label, path: data.path }]
                : [];
        });
    }

    async revokeFolder(folderId: string): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Sign in before removing a desktop asset folder.');
        await deleteDoc(doc(db, 'users', userId, 'desktopAssetFolders', folderId));
    }

    async search(queryText: string, extensions?: string[], maxResults = 25): Promise<LocalAssetMatch[]> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Sign in before searching desktop assets.');
        const electron = window.electronAPI as ElectronAPI | undefined;
        if (!electron?.searchApprovedAssets) {
            throw new Error('Desktop assets are searchable only while your Studio app is open.');
        }
        const folders = await getDocs(query(this.foldersRef(userId), orderBy('updatedAt', 'desc')));
        if (folders.empty) return [];
        const perFolderLimit = Math.max(1, Math.ceil(Math.min(maxResults, 100) / folders.size));
        const matches = await Promise.all(folders.docs.map(async folder => {
            const data = folder.data() as { label?: string; path?: string };
            if (!data.path) return [];
            const assets = await electron.searchApprovedAssets(data.path, {
                query: queryText,
                extensions,
                maxResults: perFolderLimit,
            });
            return assets.map(asset => ({ folderId: folder.id, folderLabel: data.label || 'Approved assets', ...asset }));
        }));
        return matches.flat().sort((a, b) => b.modifiedAt - a.modifiedAt).slice(0, Math.min(maxResults, 100));
    }
}

export const desktopFileIndexService = new DesktopFileIndexService();
