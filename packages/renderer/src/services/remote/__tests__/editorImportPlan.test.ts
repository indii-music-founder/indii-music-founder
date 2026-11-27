import { beforeEach, describe, expect, it, vi } from 'vitest';
import { editorImportPlan } from '@/services/remote/editorImportPlan';

const mediaMocks = vi.hoisted(() => ({
    currentModule: 'dashboard' as string,
    currentDoc: null as unknown,
    setModule: vi.fn(),
    setViewMode: vi.fn(),
    openDoc: vi.fn(),
    importMediaUrlAsClip: vi.fn(),
    saveDoc: vi.fn().mockResolvedValue(undefined),
    loadDoc: vi.fn().mockResolvedValue(null),
    dispose: vi.fn(),
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            currentModule: mediaMocks.currentModule,
            currentDoc: mediaMocks.currentDoc,
            currentProjectId: 'proj-1',
            setModule: mediaMocks.setModule,
            setViewMode: mediaMocks.setViewMode,
            openDoc: mediaMocks.openDoc,
        }),
    },
}));

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'user-1' } },
}));

vi.mock('@/services/canvas/CanvasDocumentService', () => ({
    CanvasDocumentService: {
        saveDoc: (...args: unknown[]) => mediaMocks.saveDoc(...args),
        loadDoc: (...args: unknown[]) => mediaMocks.loadDoc(...args),
    },
}));

vi.mock('@/services/canvas/CanvasDoc', () => ({
    createDocFromImage: vi.fn(() => ({ id: 'doc-1', projectId: 'proj-1', name: 'Mobile capture' })),
}));

vi.mock('@/services/canvas/ArtworkRenderService', () => ({
    loadArtworkImage: vi.fn(async () => ({ dispose: mediaMocks.dispose })),
}));

vi.mock('@/modules/creative/video/store/videoEditorStore', () => ({
    useVideoEditorStore: {
        getState: () => ({
            project: { id: 'vid-proj-1' },
            importMediaUrlAsClip: mediaMocks.importMediaUrlAsClip,
        }),
    },
}));

import { openRemoteMedia } from '@/services/remote/openRemoteMedia';

describe('remote editor import intent (pure contract)', () => {
    it('routes an inferred image to the photo editor', () => {
        expect(editorImportPlan({ imageUrl: 'https://example.com/photo.jpg' })).toMatchObject({ destination: 'photo', mediaType: 'image' });
    });
    it('preserves deliberate image-in-video intent', () => {
        expect(editorImportPlan({ imageUrl: 'https://example.com/photo.jpg', editorDestination: 'video' }).destination).toBe('video');
    });
    it.each(['video', 'audio'] as const)('routes %s to the timeline', mediaType => {
        const payload = { mediaType, videoUrl: 'https://example.com/video.mp4', audioUrl: 'https://example.com/audio.wav' };
        expect(editorImportPlan(payload)).toMatchObject({ destination: 'video', mediaType, mediaUrl: payload[mediaType === 'video' ? 'videoUrl' : 'audioUrl'] });
    });
    it('rejects a mismatched asset rather than falling back to a different URL', () => {
        expect(() => editorImportPlan({ mediaType: 'image', videoUrl: 'https://example.com/video.mp4' })).toThrow(/matching/);
    });
    it('rejects audio directed to the photo editor', () => {
        expect(() => editorImportPlan({ audioUrl: 'https://example.com/audio.wav', editorDestination: 'photo' })).toThrow(/requires an image/);
    });
    it.each(['', 'blob:local-only', 'data:image/png;base64,AA', 'http://example.com/photo.jpg'])('rejects a non-shareable source %s', imageUrl => {
        expect(() => editorImportPlan({ imageUrl })).toThrow(/secure/);
    });
});

describe('openRemoteMedia navigation guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mediaMocks.currentModule = 'dashboard';
        mediaMocks.currentDoc = null;
        mediaMocks.setModule.mockResolvedValue(undefined);
    });

    it('throws Did not open creative and does not import video clip when setModule is declined', async () => {
        await expect(openRemoteMedia({
            mediaType: 'video',
            videoUrl: 'https://example.com/video.mp4',
            title: 'Show Clip',
        })).rejects.toThrow(/Did not open creative/i);

        expect(mediaMocks.importMediaUrlAsClip).not.toHaveBeenCalled();
        expect(mediaMocks.setViewMode).not.toHaveBeenCalled();
    });

    it('throws Did not open creative and does not open photo doc when setModule is declined', async () => {
        await expect(openRemoteMedia({
            mediaType: 'image',
            imageUrl: 'https://example.com/photo.jpg',
            title: 'Tour Poster',
        }, 'task-1')).rejects.toThrow(/Did not open creative/i);

        expect(mediaMocks.openDoc).not.toHaveBeenCalled();
        expect(mediaMocks.setViewMode).not.toHaveBeenCalled();
    });
});
