import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { logger } from '@/utils/logger';
import type { VideoProject } from '../store/videoEditorStore';

/**
 * ISSUE-1147: the video editor previously held one volatile in-memory
 * VideoProject with no persistence — refreshing or switching app projects
 * could erase or cross-contaminate a timeline. This service persists one
 * document per app-project ID, mirroring the `designs/{designId}` pattern
 * used by useAutoSave.ts (merchandise module).
 */

export interface VideoProjectSaveResult {
    success: boolean;
    reason?: string;
    lastModified?: Date;
}

const COLLECTION = 'videoProjects';

export async function loadVideoProject(projectId: string): Promise<VideoProject | null> {
    try {
        const snap = await getDoc(doc(db, COLLECTION, projectId));
        if (!snap.exists()) return null;
        const data = snap.data();
        // Stored doc wraps the VideoProject under `project` alongside ownership fields.
        return (data.project as VideoProject) ?? null;
    } catch (err: unknown) {
        logger.error(`[VideoProjectPersistence] Failed to load project ${projectId}:`, err);
        return null;
    }
}

export async function saveVideoProject(
    projectId: string,
    project: VideoProject,
    userId: string,
    orgId: string | null,
    isFirstSave: boolean
): Promise<VideoProjectSaveResult> {
    if (!userId) {
        const reason = 'Auto-save skipped: missing authenticated user.';
        logger.warn(reason);
        return { success: false, reason };
    }
    try {
        await setDoc(
            doc(db, COLLECTION, projectId),
            {
                id: projectId,
                userId,
                orgId,
                project,
                lastModified: serverTimestamp(),
                ...(isFirstSave ? { createdAt: serverTimestamp() } : {}),
            },
            { merge: true }
        );
        return { success: true, lastModified: new Date() };
    } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : 'Auto-save failed';
        logger.error(`[VideoProjectPersistence] Failed to save project ${projectId}:`, err);
        return { success: false, reason };
    }
}
