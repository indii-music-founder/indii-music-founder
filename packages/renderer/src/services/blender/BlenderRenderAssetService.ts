import { doc, Timestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { useStore, type HistoryItem } from '@/core/store';
import { CreativeStorageService } from '@/services/creative/CreativeStorageService';
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';

export interface BlenderSaveContext { ownerUid: string; projectId: string; organizationId: string }
const pendingUploads = new Map<string, { storageUri: string; url: string }>();

// Both library records commit together. A failed save keeps the native output
// available for retry; retrying the same output uses the same record IDs.
export async function saveBlenderRender(outputPath: string, context: BlenderSaveContext): Promise<HistoryItem> {
    const verifyContext = () => {
        const current = useStore.getState();
        if (auth.currentUser?.uid !== context.ownerUid || current.currentProjectId !== context.projectId
            || (current.currentOrganizationId || 'org-default') !== context.organizationId) {
            throw new Error('Return to the original account and project to save this render.');
        }
    };
    verifyContext();
    const read = window.electronAPI?.video?.readArtifact;
    if (!read) throw new Error('Open this render in the desktop studio to save it.');
    const filename = outputPath.split(/[\\/]/).pop() || '';
    if (!/^[a-f0-9-]{36}\.mp4$/i.test(filename)) throw new Error('This video is not a managed Blender render.');
    const id = `blender-${filename.slice(0, -4)}`;
    const key = `${context.ownerUid}:${context.organizationId}:${context.projectId}:${id}`;
    let uploaded = pendingUploads.get(key);
    if (!uploaded) {
        const dataUrl = await read(outputPath);
        verifyContext();
        if (!dataUrl.startsWith('data:video/mp4;base64,')) throw new Error('The completed render is not an MP4 video.');
        const response = await fetch(dataUrl);
        const video = await response.blob();
        if (!video.size) throw new Error('The completed video is empty.');
        verifyContext();
        const storageUri = await CreativeStorageService.uploadReferenceMedia(context.ownerUid, video, 'video', { projectId: context.projectId });
        const url = await resolveStorageUrl(storageUri);
        uploaded = { storageUri, url };
        if (pendingUploads.size >= 32) pendingUploads.delete(pendingUploads.keys().next().value!);
        pendingUploads.set(key, uploaded);
    }
    verifyContext();
    const now = Date.now();
    const item: HistoryItem = {
        id, url: uploaded.url, storageUri: uploaded.storageUri, localPath: outputPath,
        type: 'video', prompt: 'Blender 3D music video', timestamp: now,
        projectId: context.projectId, orgId: context.organizationId,
    };
    const node = {
        id, name: `${id}.mp4`, type: 'file' as const, fileType: 'video' as const,
        parentId: null, projectId: context.projectId, userId: context.ownerUid,
        data: { url: uploaded.url, storagePath: uploaded.storageUri, mimeType: 'video/mp4' },
        createdAt: now, updatedAt: now,
    };
    const batch = writeBatch(db);
    batch.set(doc(db, 'history', id), { ...item, userId: context.ownerUid,
        timestamp: Timestamp.fromMillis(now), updatedAt: Timestamp.fromMillis(now) });
    batch.set(doc(db, 'file_nodes', id), { ...node,
        createdAt: Timestamp.fromMillis(now), updatedAt: Timestamp.fromMillis(now) });
    await batch.commit();
    verifyContext();
    useStore.setState(state => ({
        generatedHistory: [item, ...state.generatedHistory.filter(previous => previous.id !== id)].slice(0, 50),
        fileNodes: [node, ...state.fileNodes.filter(previous => previous.id !== id)],
    }));
    pendingUploads.delete(key);
    return item;
}
