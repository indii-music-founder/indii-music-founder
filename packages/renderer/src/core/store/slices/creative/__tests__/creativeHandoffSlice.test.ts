import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildCreativeHandoffState } from '../creativeHandoffSlice';
import { HistoryItem } from '@/core/types/history';
import { CreativeStage, StageHandoffPayload } from '@/types/handoff';

describe('creativeHandoffSlice', () => {
    let store: ReturnType<typeof buildCreativeHandoffState>;
    let setState: (fn: (state: any) => any) => void;
    let getState: () => any;

    beforeEach(() => {
        const state = { pendingStageHandoff: { image: null, veo: null, omni: null, editor: null } };
        setState = vi.fn((fn) => {
            const next = fn(state);
            Object.assign(state, next);
        });
        getState = () => state;

        // Mock store with creative methods
        const mockStore = {
            ...state,
            setViewMode: vi.fn(),
            setModule: vi.fn().mockResolvedValue(undefined),
            currentModule: 'creative',
        };

        getState = () => mockStore;
        store = buildCreativeHandoffState(setState, getState as any);
    });

    describe('sendToStage', () => {
        it('validates asset type matches role', () => {
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

            const videoItem: HistoryItem = {
                id: 'test-video',
                type: 'video',
                url: 'http://example.com/video.mp4',
                storageUri: 'gs://bucket/video.mp4',
                prompt: 'test',
                timestamp: Date.now(),
                projectId: 'proj-1',
            };

            const payload: StageHandoffPayload = {
                item: videoItem,
                role: 'reference-image', // Invalid: expects image, got video
                originStage: 'veo',
                timestamp: Date.now(),
            };

            store.sendToStage('omni', payload);

            expect(consoleError).toHaveBeenCalledWith(
                expect.stringContaining('Invalid asset type')
            );
            consoleError.mockRestore();
        });

        it('accepts valid asset type for role', () => {
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

            const videoItem: HistoryItem = {
                id: 'test-video',
                type: 'video',
                url: 'http://example.com/video.mp4',
                storageUri: 'gs://bucket/video.mp4',
                prompt: 'test',
                timestamp: Date.now(),
                projectId: 'proj-1',
            };

            const payload: StageHandoffPayload = {
                item: videoItem,
                role: 'source-video', // Valid: expects video
                originStage: 'veo',
                timestamp: Date.now(),
            };

            store.sendToStage('omni', payload);

            expect(consoleError).not.toHaveBeenCalled();
            expect(setState).toHaveBeenCalled();
            consoleError.mockRestore();
        });

        it('warns if asset has no storageUri', () => {
            const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const imageItem: HistoryItem = {
                id: 'test-image',
                type: 'image',
                url: 'http://example.com/image.png',
                // No storageUri
                prompt: 'test',
                timestamp: Date.now(),
                projectId: 'proj-1',
            };

            const payload: StageHandoffPayload = {
                item: imageItem,
                role: 'image-input',
                originStage: 'veo',
                timestamp: Date.now(),
            };

            store.sendToStage('image', payload);

            expect(consoleWarn).toHaveBeenCalledWith(
                expect.stringContaining('has no storageUri')
            );
            consoleWarn.mockRestore();
        });

        it('sets pending handoff in store', () => {
            const imageItem: HistoryItem = {
                id: 'test-image',
                type: 'image',
                url: 'http://example.com/image.png',
                storageUri: 'gs://bucket/image.png',
                prompt: 'test',
                timestamp: Date.now(),
                projectId: 'proj-1',
            };

            const payload: StageHandoffPayload = {
                item: imageItem,
                role: 'image-input',
                originStage: 'veo',
                timestamp: Date.now(),
            };

            store.sendToStage('image', payload);

            expect(setState).toHaveBeenCalledWith(expect.any(Function));
        });

        it('navigates to target stage', () => {
            const mockSetViewMode = vi.fn();
            const mockState = {
                pendingStageHandoff: { image: null, veo: null, omni: null, editor: null },
                setViewMode: mockSetViewMode,
            };

            getState = () => mockState;
            store = buildCreativeHandoffState(setState, getState as any);

            const videoItem: HistoryItem = {
                id: 'test-video',
                type: 'video',
                url: 'http://example.com/video.mp4',
                storageUri: 'gs://bucket/video.mp4',
                prompt: 'test',
                timestamp: Date.now(),
                projectId: 'proj-1',
            };

            const payload: StageHandoffPayload = {
                item: videoItem,
                role: 'source-video',
                originStage: 'image',
                timestamp: Date.now(),
            };

            store.sendToStage('veo', payload);

            expect(mockSetViewMode).toHaveBeenCalledWith('video_production');
        });

        it('routes video assets to the timeline editor through video production', () => {
            const mockSetViewMode = vi.fn();
            const mockState = {
                pendingStageHandoff: { image: null, veo: null, omni: null, editor: null },
                setViewMode: mockSetViewMode,
            };
            getState = () => mockState;
            store = buildCreativeHandoffState(setState, getState as any);

            store.sendToStage('editor', {
                item: {
                    id: 'omni-video',
                    type: 'video',
                    url: 'https://example.com/omni.mp4',
                    storageUri: 'gs://bucket/omni.mp4',
                    prompt: 'Omni output',
                    timestamp: 1,
                    projectId: 'project-1',
                },
                role: 'source-video',
                originStage: 'omni',
                timestamp: Date.now(),
            });

            expect(mockSetViewMode).toHaveBeenCalledWith('video_production');
        });
    });

    describe('consumeStageHandoff', () => {
        it('returns and clears pending handoff', () => {
            const imageItem: HistoryItem = {
                id: 'test-image',
                type: 'image',
                url: 'http://example.com/image.png',
                storageUri: 'gs://bucket/image.png',
                prompt: 'test',
                timestamp: Date.now(),
                projectId: 'proj-1',
            };

            const payload: StageHandoffPayload = {
                item: imageItem,
                role: 'image-input',
                originStage: 'veo',
                timestamp: Date.now(),
            };

            // Set pending handoff first
            store.sendToStage('image', payload);

            // Simulate setState updating the state
            const state = getState();
            if (typeof state.pendingStageHandoff !== 'object') {
                state.pendingStageHandoff = { image: null, veo: null, omni: null };
            }
            state.pendingStageHandoff.image = payload;

            const result = store.consumeStageHandoff('image');

            expect(result).toEqual(payload);
            expect(setState).toHaveBeenCalled();
        });

        it('returns null if no pending handoff', () => {
            const result = store.consumeStageHandoff('omni');
            expect(result).toBeNull();
        });
    });

    describe('clearStageHandoff', () => {
        it('clears pending handoff for stage', () => {
            const imageItem: HistoryItem = {
                id: 'test-image',
                type: 'image',
                url: 'http://example.com/image.png',
                storageUri: 'gs://bucket/image.png',
                prompt: 'test',
                timestamp: Date.now(),
                projectId: 'proj-1',
            };

            const payload: StageHandoffPayload = {
                item: imageItem,
                role: 'image-input',
                originStage: 'veo',
                timestamp: Date.now(),
            };

            // Set pending handoff
            store.sendToStage('image', payload);

            // Clear it
            store.clearStageHandoff('image');

            expect(setState).toHaveBeenCalled();
        });
    });
});
