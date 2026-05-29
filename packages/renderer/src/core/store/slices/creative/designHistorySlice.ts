import { StateCreator } from 'zustand';
import { logger } from '@/utils/logger';
import { CanvasImage } from './creativeHistorySlice';
import { WhiskState } from './creativeControlsSlice';

export interface DesignVersionState {
    studioControls: any;
    canvasImages: CanvasImage[];
    whiskState: WhiskState;
    characterReferences: Array<{ image: any; referenceType: 'subject' | 'style' | 'reference'; name?: string }>;
    creativePrompt: string;
}

export interface DesignVersion {
    id: string;
    name: string;
    createdAt: number;
    projectId: string;
    userId: string;
    state: DesignVersionState;
}

export interface DesignHistorySlice {
    designVersions: DesignVersion[];
    saveDesignVersion: (name?: string) => Promise<void>;
    restoreDesignVersion: (version: DesignVersion) => void;
    deleteDesignVersion: (id: string) => Promise<void>;
    initializeDesignHistory: () => Promise<void>;
}

export function buildDesignHistoryState(
    set: any,
    get: any
): DesignHistorySlice {
    return {
        designVersions: [],
        
        saveDesignVersion: async (name) => {
            const state = get();
            const { currentProjectId, studioControls, canvasImages, whiskState, characterReferences, creativePrompt } = state;
            
            if (!currentProjectId) {
                logger.error("DesignHistory: No project selected");
                return;
            }

            const { getAuth } = await import('firebase/auth');
            const userId = getAuth().currentUser?.uid;
            if (!userId) {
                throw new Error('DesignHistory: User must be authenticated to save a design version');
            }

            const newVersion: DesignVersion = {
                id: `version_${Date.now()}`,
                name: name || `Version ${new Date().toLocaleString()}`,
                createdAt: Date.now(),
                projectId: currentProjectId,
                userId,
                state: {
                    studioControls: JSON.parse(JSON.stringify(studioControls)), // Deep clone
                    canvasImages: JSON.parse(JSON.stringify(canvasImages)),
                    whiskState: JSON.parse(JSON.stringify(whiskState)),
                    characterReferences: JSON.parse(JSON.stringify(characterReferences)),
                    creativePrompt
                }
            };

            set((state: any) => ({
                designVersions: [newVersion, ...state.designVersions]
            }));

            // Persistence
            try {
                const { FirestoreService } = await import('@/services/FirestoreService');
                const service = new FirestoreService<DesignVersion>('design_versions');
                await service.set(newVersion.id, newVersion);
                logger.info("DesignHistory: Saved version", newVersion.id);
            } catch (err) {
                logger.error("DesignHistory: Failed to save version", err);
            }
        },

        restoreDesignVersion: (version) => {
            set((state: any) => ({
                ...state,
                studioControls: { ...state.studioControls, ...version.state.studioControls },
                canvasImages: [...version.state.canvasImages],
                whiskState: { ...state.whiskState, ...version.state.whiskState },
                characterReferences: [...version.state.characterReferences],
                creativePrompt: version.state.creativePrompt
            }));
            logger.info("DesignHistory: Restored version", version.id);
        },

        deleteDesignVersion: async (id) => {
            set((state: any) => ({
                designVersions: state.designVersions.filter((v: any) => v.id !== id)
            }));

            try {
                const { FirestoreService } = await import('@/services/FirestoreService');
                const service = new FirestoreService<DesignVersion>('design_versions');
                await service.delete(id);
                logger.info("DesignHistory: Deleted version", id);
            } catch (err) {
                logger.error("DesignHistory: Failed to delete version", err);
            }
        },

        initializeDesignHistory: async () => {
            const projectId = get().currentProjectId;
            if (!projectId) return;

            try {
                const { FirestoreService } = await import('@/services/FirestoreService');
                const { where } = await import('firebase/firestore');
                const service = new FirestoreService<DesignVersion>('design_versions');
                
                const { getAuth } = await import('firebase/auth');
                const userId = getAuth().currentUser?.uid;
                if (!userId) {
                    set({ designVersions: [] });
                    logger.warn("DesignHistory: User must be authenticated to initialize design history");
                    return;
                }

                const versions = await service.list([
                    where('projectId', '==', projectId),
                    where('userId', '==', userId)
                ]);

                versions.sort((a, b) => b.createdAt - a.createdAt);

                set({ designVersions: versions });
                logger.info("DesignHistory: Initialized with", versions.length, "versions");
            } catch (err) {
                logger.error("DesignHistory: Failed to initialize", err);
            }
        }
    };
}
