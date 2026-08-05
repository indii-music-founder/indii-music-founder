import React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MyComposition } from './MyComposition';

const mocks = vi.hoisted(() => ({
    continueRender: vi.fn(),
    cancelRender: vi.fn(),
    delayRender: vi.fn(() => 17),
    hydration: {
        status: 'failed',
        url: null,
        error: new Error('storage denied'),
    } as const,
}));

vi.mock('@/hooks/useSafeImageUrl', () => ({
    useSafeMediaUrl: vi.fn(() => mocks.hydration),
}));

vi.mock('@remotion/media-utils', () => ({
    useAudioData: vi.fn(() => null),
    visualizeAudio: vi.fn(() => []),
}));

vi.mock('remotion', () => ({
    AbsoluteFill: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Sequence: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Video: () => null,
    Img: () => null,
    Audio: () => null,
    useCurrentFrame: () => 0,
    useVideoConfig: () => ({ fps: 24 }),
    interpolate: () => 1,
    Easing: { linear: (value: number) => value },
    delayRender: mocks.delayRender,
    continueRender: mocks.continueRender,
    cancelRender: mocks.cancelRender,
}));

describe('MyComposition media hydration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('fails the render truthfully and releases the delay handle when private media cannot hydrate', () => {
        const project = {
            id: 'project-1',
            name: 'Private render',
            width: 1920,
            height: 1080,
            fps: 24,
            durationInFrames: 24,
            tracks: [{ id: 'track-1', name: 'Video', type: 'video' }],
            clips: [{
                id: 'clip-1',
                type: 'video',
                name: 'Private clip',
                src: 'gs://bucket/private-renders/owner/project/job/input.mp4',
                startFrame: 0,
                durationInFrames: 24,
                trackId: 'track-1',
            }],
        };

        render(<MyComposition project={project as never} />);
        expect(mocks.delayRender).toHaveBeenCalledWith('Hydrating clip URL');
        expect(mocks.cancelRender).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Unable to hydrate media for clip clip-1: storage denied' }),
        );
    });
});
