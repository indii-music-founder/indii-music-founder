import { StateCreator } from 'zustand';
import { logger } from '@/utils/logger';
import { CreativeSlice } from './index';
import { CanvasImage } from './creativeHistorySlice';
import { WhiskState } from './creativeControlsSlice';

export interface DesignVersion {
    id: string;
    name: string;
    createdAt: number;
    projectId: string;
    state: {
        studioControls: CreativeSlice['studioControls'];
        canvasImages: CanvasImage[];
        whiskState: WhiskState;
        characterReferences: CreativeSlice['characterReferences'];
        creativePrompt: string;
    };
}

export interface DesignHistorySlice {
    designVersions: DesignVersion[];
    saveDesignVersion: (name?: string) => Promise<void>;
    restoreDesignVersion: (version: DesignVersion) => void;
    deleteDesignVersion: (id: string) => Promise<void>;
    initializeDesignHistory: () => Promise<void>;
}

export function buildDesignHistoryState(
    set: Parameters<StateCreator<CreativeSlice>>[0],
    get: Parameters<StateCreator<CreativeSlice>>[1]
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

            const newVersion: DesignVersion = {
                id: `version_${Date.now()}`,
                name: name || `Version ${new Date().toLocaleString()}`,
                createdAt: Date.now(),
                projectId: currentProjectId,
                state: {
                    studioControls: JSON.parse(JSON.stringify(studioControls)), // Deep clone
                    canvasImages: JSON.parse(JSON.stringify(canvasImages)),
                    whiskState: JSON.parse(JSON.stringify(whiskState)),
                    characterReferences: JSON.parse(JSON.stringify(characterReferences)),
                    creativePrompt
                }
            };

            set((state) => ({
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
            set((state) => ({
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
            set((state) => ({
                designVersions: state.designVersions.filter(v => v.id !== id)
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
                const { where, orderBy } = await import('firebase/firestore');
                const service = new FirestoreService<DesignVersion>('design_versions');
                
                const versions = await service.list([
                    where('projectId', '==', projectId),
                    orderBy('createdAt', 'desc')
                ]);

                set({ designVersions: versions });
                logger.info("DesignHistory: Initialized with", versions.length, "versions");
            } catch (err) {
                logger.error("DesignHistory: Failed to initialize", err);
            }
        }
    };
}
