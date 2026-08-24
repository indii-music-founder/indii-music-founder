import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IndiiVideoProject } from '@indii/shared';

vi.mock('@hyperframes/player', () => {
    class TestHyperframesPlayer extends HTMLElement {
        currentTime = 0;
        play = vi.fn();
        pause = vi.fn();
        seek = vi.fn((seconds: number) => { this.currentTime = seconds; });
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
    Object.defineProperty(window, 'electronAPI', { configurable: true, value: undefined });
});

describe('VideoPreview', () => {
    it('renders an honest empty state before clips exist', () => {
        render(<VideoPreview project={project(false)} artifactUrl={null} />);
        expect(screen.getByTestId('preview-empty')).toHaveTextContent('Add a clip to preview');
    });

    it('compiles the project and embeds the seekable HyperFrames Player', async () => {
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
    });

    it('uses a real rendered artifact as a browser fallback', async () => {
        render(<VideoPreview project={project()} artifactUrl="file:///tmp/render.mp4" />);

        await waitFor(() => expect(screen.getByTestId('preview-video')).toHaveAttribute('src', 'file:///tmp/render.mp4'));
        expect(screen.getByText(/Rendered artifact:/)).toBeInTheDocument();
    });
});
