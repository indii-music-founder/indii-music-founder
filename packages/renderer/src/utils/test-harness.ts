import { useStore } from '@/core/store';
import { HistoryItem } from '@/core/types/history';

export const IndiiTestHarness = {
    /**
     * Bypass the Browser Agent and trigger the 'video_production' view directly.
     */
    triggerDirectorMode: () => {
        const store = useStore.getState();
        store.setModule('creative');
        store.setGenerationMode('video');
        store.setViewMode('video_production');
        console.log('[TestHarness] Director Mode Triggered: Mode set to video, ViewMode set to video_production');
    },

    /**
     * Inject video inputs into the store to simulate the drag/drop or selection of frames.
     */
    injectVideoInputs: (firstUrl: string, lastUrl?: string) => {
        const store = useStore.getState();
        
        const createMockHistory = (url: string, id: string): HistoryItem => ({
            id,
            type: 'image',
            url,
            prompt: 'Test Mock Image',
            timestamp: Date.now(),
            projectId: store.currentProjectId || 'test-project',
            origin: 'uploaded'
        });

        const firstFrame = firstUrl ? createMockHistory(firstUrl, 'mock-first-frame') : null;
        const lastFrame = lastUrl ? createMockHistory(lastUrl, 'mock-last-frame') : null;

        const ingredients = [];
        if (firstFrame) ingredients.push(firstFrame);
        if (lastFrame) ingredients.push(lastFrame);

        store.setVideoInputs({
            firstFrame,
            lastFrame,
            ingredients
        });
        
        console.log('[TestHarness] Video Inputs Injected:', { firstFrame, lastFrame, ingredients });
    },

    /**
     * Mimic the handleVideoGenerate logic without UI clicks.
     */
    executeVideoGeneration: async (prompt: string = "Test sequence") => {
        try {
            const { VideoGeneration } = await import('@/services/video/VideoGenerationService');
            const store = useStore.getState();
            
            const videoInputs = store.videoInputs;
            const studioControls = store.studioControls;
            
            console.log('[TestHarness] Executing Direct Video Generation...', { prompt, videoInputs, studioControls });
            
            const generated = await VideoGeneration.generateVideo({
                prompt,
                resolution: studioControls.resolution === '4k' ? '1080p' : studioControls.resolution,
                aspectRatio: studioControls.aspectRatio === '9:16' ? '9:16' : '16:9',
                duration: studioControls.duration || 6,
                durationSeconds: studioControls.duration || 6,
                model: studioControls.model,
                fps: 24,
                orgId: 'personal',
                referenceImages: videoInputs.ingredients.map(ing => {
                    let bytes = ing.url;
                    const commaIndex = bytes.indexOf(',');
                    if (bytes.startsWith('data:') && commaIndex !== -1) {
                        bytes = bytes.substring(commaIndex + 1);
                    }
                    return {
                        image: { imageBytes: bytes, mimeType: 'image/jpeg' },
                        referenceType: 'asset' as const
                    };
                })
            });
            
            console.log('[TestHarness] Video Generation Success:', generated);
            
            if (generated && generated.length > 0) {
                 const newItems: HistoryItem[] = generated.map(g => ({
                    id: g.id || crypto.randomUUID(),
                    url: g.url || '',
                    type: 'video' as const,
                    prompt: prompt,
                    timestamp: Date.now(),
                    projectId: store.currentProjectId || 'test-project',
                    origin: 'generated' as const
                }));
                newItems.forEach(item => store.addToHistory({ ...item }));
                console.log('[TestHarness] Items added to history', newItems);
            }
            
        } catch (error) {
            console.error('[TestHarness] Video Generation Failed:', error);
        }
    }
};

if (typeof window !== 'undefined') {
    // Expose for manual testing in DevTools
    (window as any).IndiiTestHarness = IndiiTestHarness;
}
