import React from 'react';
import { cleanup, render, screen, waitFor, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IndiiVideoProject } from '@indii/shared';

const mockSeek = vi.fn();

vi.mock('@hyperframes/player', () => {
    class TestHyperframesPlayer extends HTMLElement {
        currentTime = 0;
        loop = false;
        play = vi.fn();
        pause = vi.fn();
        seek = mockSeek;
    }
    if (!customElements.get('hyperframes-player')) {
        customElements.define('hyperframes-player', TestHyperframesPlayer);
    }
    return { HyperframesPlayer: TestHyperframesPlayer };
});

import { VideoPreview } from './VideoPreview';

const project = (withClip = true): IndiiVideoProject => ({
    id: 'project-1', name: 'Project', width: 1920, height: 1080, fps: 30,
    durationInFrames: 30,
    tracks: [{ id: 'track-1', name: 'Video', type: 'video' }],
    clips: withClip ? [{
        id: 'title', name: 'Title', type: 'text', trackId: 'track-1',
        text: 'indii', startFrame: 0, durationInFrames: 30,
    }] : [],
});

afterEach(() => {
    cleanup();
    mockSeek.mockClear();
    Object.defineProperty(window, 'electronAPI', { configurable: true, value: undefined });
});

describe('VideoPreview', () => {
    it('renders an honest empty state before clips exist', () => {
        render(<VideoPreview project={project(false)} artifactUrl={null} />);
        expect(screen.getByTestId('preview-empty')).toHaveTextContent('Add a clip to preview');
    });

    it('compiles the project and embeds the seekable HyperFrames Player without native loop', async () => {
        const compilePreview = vi.fn(async () => '<html><body data-composition-id="project-1"></body></html>');
        Object.defineProperty(window, 'electronAPI', {
            configurable: true,
            value: { video: { compilePreview } },
        });

        render(<VideoPreview project={project()} artifactUrl={null} />);

        const player = await screen.findByTestId('hyperframes-preview');
        expect(compilePreview).toHaveBeenCalledWith(project());
        expect(player.getAttribute('srcdoc')).toContain('data-composition-id="project-1"');
        expect(screen.getByText(/Live timeline:/)).toBeInTheDocument();
        // Native loop must be false so loop bounds are managed by timeline transport
        expect(player.getAttribute('loop')).not.toBe('true');
    });

    it('compiles live on the web through the shared pure compiler and web player transform', async () => {
        // No electronAPI: the bridge compiles locally (pure TS) and re-plumbs
        // the document for the in-browser player (ISSUE-1433 browser preview).
        render(<VideoPreview project={project()} artifactUrl={null} />);

        const player = await screen.findByTestId('hyperframes-preview');
        const srcdoc = player.getAttribute('srcdoc') ?? '';
        expect(srcdoc).toContain('data-composition-id="project-1"');
        // Web player plumbing: pinned sidecar + runtime, blob timeline.
        expect(srcdoc).toContain('<script src="/gsap.min.js?v=3.14.2"></script>');
        expect(srcdoc).toContain('<script src="/hyperframe.runtime.iife.js?v=0.8.11"></script>');
        expect(srcdoc).toMatch(/<script src="blob:[^"]+"><\/script>/);
        expect(srcdoc).not.toContain('<script src="./gsap.min.js"></script>');
        expect(screen.getByText(/Live timeline:/)).toBeInTheDocument();
    });

    it('uses a real rendered artifact as a fallback when live compilation fails', async () => {
        // Invalid project duration → compiler throws → artifact fallback.
        const broken = { ...project(), durationInFrames: 0 };
        render(<VideoPreview project={broken} artifactUrl="file:///tmp/render.mp4" />);

        await waitFor(() => {
            const video = screen.getByTestId('preview-video') as HTMLVideoElement;
            expect(video).toHaveAttribute('src', 'file:///tmp/render.mp4');
            // Native loop must not be active
            expect(video.loop).toBe(false);
        });
        expect(screen.getByText(/Rendered artifact:/)).toBeInTheDocument();
    });

    it('executes seekRequest only when nonce changes', async () => {
        const compilePreview = vi.fn(async () => '<html><body data-composition-id="project-1"></body></html>');
        Object.defineProperty(window, 'electronAPI', {
            configurable: true,
            value: { video: { compilePreview } },
        });

        const { rerender } = render(
            <VideoPreview
                project={project()}
                artifactUrl={null}
                seekRequest={{ frame: 15, nonce: 101 }}
            />
        );

        await screen.findByTestId('hyperframes-preview');
        // frame 15 @ 30fps = 0.5s
        expect(mockSeek).toHaveBeenCalledWith(0.5);
        expect(mockSeek).toHaveBeenCalledTimes(1);

        // Re-rendering with identical nonce (e.g. parent re-rendered during playback) must NOT re-seek
        act(() => {
            rerender(
                <VideoPreview
                    project={project()}
                    artifactUrl={null}
                    seekRequest={{ frame: 15, nonce: 101 }}
                />
            );
        });
        expect(mockSeek).toHaveBeenCalledTimes(1);

        // Re-rendering with a new nonce (intentional seek / loop wrap) must trigger seek
        act(() => {
            rerender(
                <VideoPreview
                    project={project()}
                    artifactUrl={null}
                    seekRequest={{ frame: 20, nonce: 102 }}
                />
            );
        });
        // frame 20 @ 30fps = 0.6666...s
        expect(mockSeek).toHaveBeenCalledTimes(2);

    });
});
