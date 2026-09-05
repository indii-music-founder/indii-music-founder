/**
 * ProjectCanvasPersistence.ts
 *
 * Scoped persistence layer for indii.music Project Canvas documents,
 * blocks, and semantic edges.
 *
 * Architectural Guarantees:
 * 1. Project-scoped: All documents live strictly under `projects/{projectId}/canvases/{canvasId}`.
 * 2. Save race protection: Uses monotonic mutation version numbers (`localMutationVersion`).
 *    An in-flight save only clears `isDirty` if no newer mutation happened while saving.
 * 3. Failure recovery: Failed saves keep `isDirty = true`, retain in-memory state,
 *    and cache to local storage so work is never lost.
 * 4. Debounced position writes: Avoids flooding Firestore on every pointer movement.
 * 5. Clean project switching: Clears previous project data before loading new project data.
 */

import { auth, db } from '@/services/firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    deleteDoc,
    writeBatch,
    serverTimestamp,
} from 'firebase/firestore';
import { logger } from '@/utils/logger';
import {
    CURRENT_CANVAS_SCHEMA_VERSION,
    migrateCanvasDocument,
    type ProjectCanvasDocument,
    type ProjectCanvasBlock,
    type ProjectCanvasEdge,
    ProjectCanvasDocumentSchema,
    ProjectCanvasBlockSchema,
    ProjectCanvasEdgeSchema,
} from '../types';

export interface CanvasSaveState {
    isSaving: boolean;
    isDirty: boolean;
    lastSavedAt: number | null;
    error: string | null;
    savingMutationVersion: number;
    currentMutationVersion: number;
}

export interface CanvasFullState {
    document: ProjectCanvasDocument;
    blocks: ProjectCanvasBlock[];
    edges: ProjectCanvasEdge[];
}

class ProjectCanvasPersistenceImpl {
    private localMutationVersion = 0;
    private inFlightMutationVersion = 0;
    private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    private pendingSavePayload: CanvasFullState | null = null;

    /** Monotonic local mutation incrementer */
    bumpMutationVersion(): number {
        this.localMutationVersion += 1;
        return this.localMutationVersion;
    }

    getMutationVersion(): number {
        return this.localMutationVersion;
    }

    private getUserId(): string {
        return auth.currentUser?.uid ?? 'anonymous_user';
    }

    private getLocalStorageKey(projectId: string): string {
        return `indii_project_canvas_cache_${projectId}`;
    }

    /** Save snapshot to localStorage as emergency offline / failure backup */
    saveToLocalBackup(projectId: string, state: CanvasFullState): void {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(
                    this.getLocalStorageKey(projectId),
                    JSON.stringify(state)
                );
            }
        } catch (err) {
            logger.warn('[ProjectCanvasPersistence] Failed to write local cache backup:', err);
        }
    }

    /** Retrieve snapshot from localStorage backup */
    loadFromLocalBackup(projectId: string): CanvasFullState | null {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const raw = window.localStorage.getItem(this.getLocalStorageKey(projectId));
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                if (parsed?.document && Array.isArray(parsed?.blocks)) {
                    return parsed as CanvasFullState;
                }
            }
        } catch (err) {
            logger.warn('[ProjectCanvasPersistence] Failed to read local cache backup:', err);
        }
        return null;
    }

    /**
     * Load canvas document, blocks, and edges for a given project.
     * If no canvas exists yet in Firestore or backup, returns a newly initialized canvas document.
     */
    async loadCanvas(projectId: string): Promise<CanvasFullState> {
        if (!projectId) {
            throw new Error('ProjectCanvasPersistence.loadCanvas: projectId is required');
        }

        const canvasId = `canvas_${projectId}`;

        try {
            // Check Firestore
            const canvasRef = doc(db, 'projects', projectId, 'canvases', canvasId);
            const canvasSnap = await getDoc(canvasRef);

            if (canvasSnap.exists()) {
                const docData = migrateCanvasDocument({ ...canvasSnap.data(), id: canvasSnap.id, projectId });

                // Load blocks
                const blocksRef = collection(db, 'projects', projectId, 'canvases', canvasId, 'blocks');
                const blocksSnap = await getDocs(blocksRef);
                const blocks: ProjectCanvasBlock[] = [];
                for (const bDoc of blocksSnap.docs) {
                    const parsed = ProjectCanvasBlockSchema.safeParse({ ...bDoc.data(), id: bDoc.id });
                    if (parsed.success) {
                        blocks.push(parsed.data as ProjectCanvasBlock);
                    } else {
                        logger.warn(`[ProjectCanvasPersistence] Skipped malformed block ${bDoc.id}:`, parsed.error);
                    }
                }

                // Load edges
                const edgesRef = collection(db, 'projects', projectId, 'canvases', canvasId, 'edges');
                const edgesSnap = await getDocs(edgesRef);
                const edges: ProjectCanvasEdge[] = [];
                for (const eDoc of edgesSnap.docs) {
                    const parsed = ProjectCanvasEdgeSchema.safeParse({ ...eDoc.data(), id: eDoc.id });
                    if (parsed.success) {
                        edges.push(parsed.data as ProjectCanvasEdge);
                    } else {
                        logger.warn(`[ProjectCanvasPersistence] Skipped malformed edge ${eDoc.id}:`, parsed.error);
                    }
                }

                const loadedState: CanvasFullState = {
                    document: docData,
                    blocks,
                    edges,
                };

                // Refresh local backup
                this.saveToLocalBackup(projectId, loadedState);
                return loadedState;
            }
        } catch (err) {
            logger.warn(`[ProjectCanvasPersistence] Firestore load failed for project ${projectId}, trying local backup:`, err);
            const backup = this.loadFromLocalBackup(projectId);
            if (backup) {
                return backup;
            }
        }

        // Fallback: check local backup
        const backup = this.loadFromLocalBackup(projectId);
        if (backup) {
            return backup;
        }

        // Create new blank project canvas
        const now = Date.now();
        const newDocument: ProjectCanvasDocument = {
            id: canvasId,
            schemaVersion: CURRENT_CANVAS_SCHEMA_VERSION,
            projectId,
            ownerId: this.getUserId(),
            title: 'Project Canvas',
            viewport: { x: 0, y: 0, zoom: 1 },
            createdAt: now,
            updatedAt: now,
            revision: 0,
            blockIds: [],
            edgeIds: [],
        };

        const initialState: CanvasFullState = {
            document: newDocument,
            blocks: [],
            edges: [],
        };

        this.saveToLocalBackup(projectId, initialState);
        return initialState;
    }

    /**
     * Persist canvas state with mutation version tracking and race condition prevention.
     *
     * Returns:
     * - `true` if this save cleared dirty state (i.e. no newer edits while saving).
     * - `false` if newer edits occurred while saving (caller must keep dirty state).
     */
    async saveCanvas(state: CanvasFullState): Promise<{ clearedDirty: boolean; savedAt: number }> {
        const { document: docData, blocks, edges } = state;
        const projectId = docData.projectId;
        const canvasId = docData.id;

        // Capture mutation version at the start of the save
        const mutationVersionToSave = this.localMutationVersion;
        this.inFlightMutationVersion = mutationVersionToSave;

        // Ensure local backup is updated immediately (prevents any data loss even if network dies)
        this.saveToLocalBackup(projectId, state);

        try {
            const batch = writeBatch(db);
            const now = Date.now();

            // Root canvas doc
            const canvasRef = doc(db, 'projects', projectId, 'canvases', canvasId);
            const validatedDoc = ProjectCanvasDocumentSchema.parse({
                ...docData,
                updatedAt: now,
                revision: (docData.revision || 0) + 1,
                blockIds: blocks.map((b) => b.id),
                edgeIds: edges.map((e) => e.id),
            });

            batch.set(canvasRef, {
                ...validatedDoc,
                serverUpdatedAt: serverTimestamp(),
            });

            // Write blocks
            for (const block of blocks) {
                const bRef = doc(db, 'projects', projectId, 'canvases', canvasId, 'blocks', block.id);
                const validatedBlock = ProjectCanvasBlockSchema.parse(block);
                batch.set(bRef, validatedBlock);
            }

            // Write edges
            for (const edge of edges) {
                const eRef = doc(db, 'projects', projectId, 'canvases', canvasId, 'edges', edge.id);
                const validatedEdge = ProjectCanvasEdgeSchema.parse(edge);
                batch.set(eRef, validatedEdge);
            }

            await batch.commit();

            // Save succeeded: check if newer mutations occurred in the meantime
            const clearedDirty = this.localMutationVersion === mutationVersionToSave;
            return { clearedDirty, savedAt: now };
        } catch (error) {
            logger.error(`[ProjectCanvasPersistence] Failed to persist canvas for project ${projectId}:`, error);
            throw error;
        }
    }

    /**
     * Delete a block from canvas storage without touching any canonical entity.
     */
    async deleteBlockPlacement(projectId: string, canvasId: string, blockId: string): Promise<void> {
        try {
            const bRef = doc(db, 'projects', projectId, 'canvases', canvasId, 'blocks', blockId);
            await deleteDoc(bRef);
        } catch (err) {
            logger.warn(`[ProjectCanvasPersistence] Failed to delete block doc ${blockId}:`, err);
        }
    }

    /**
     * Delete an edge from canvas storage.
     */
    async deleteEdge(projectId: string, canvasId: string, edgeId: string): Promise<void> {
        try {
            const eRef = doc(db, 'projects', projectId, 'canvases', canvasId, 'edges', edgeId);
            await deleteDoc(eRef);
        } catch (err) {
            logger.warn(`[ProjectCanvasPersistence] Failed to delete edge doc ${edgeId}:`, err);
        }
    }

    /**
     * Schedule a debounced save.
     */
    scheduleDebouncedSave(
        state: CanvasFullState,
        debounceMs: number,
        onComplete: (result: { clearedDirty: boolean; savedAt: number }) => void,
        onError: (err: Error) => void
    ): void {
        this.pendingSavePayload = state;

        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
        }

        this.saveDebounceTimer = setTimeout(async () => {
            if (!this.pendingSavePayload) return;
            const payload = this.pendingSavePayload;
            this.pendingSavePayload = null;

            try {
                const res = await this.saveCanvas(payload);
                onComplete(res);
            } catch (err) {
                onError(err instanceof Error ? err : new Error(String(err)));
            }
        }, debounceMs);
    }

    cancelPendingSave(): void {
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
            this.saveDebounceTimer = null;
        }
        this.pendingSavePayload = null;
    }
}

export const ProjectCanvasPersistence = new ProjectCanvasPersistenceImpl();
