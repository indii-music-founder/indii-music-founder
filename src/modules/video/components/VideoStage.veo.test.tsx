import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VideoStage } from './VideoStage';
import { HistoryItem } from '@/core/store';

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('🎥 Lens: Veo 3.1 & Gemini 3 - Video Stage Integrity', () => {
    const mockSetVideoInputs = vi.fn();

    // Reusable mock data
    const validVeoVideo: HistoryItem = {
        id: 'veo-job-123',
        url: 'https://storage.googleapis.com/veo-video.mp4', // Mocked URL
        type: 'video',
        timestamp: Date.now(),
        prompt: 'Cinematic cyber city',
        projectId: 'test-project',
        meta: JSON.stringify({
            mime_type: 'video/mp4',
            fps: 24,
            duration_seconds: 5.0
        })
    };

    it('✅ Veo 3.1 Playback: Renders player for valid MP4 assets', () => {
        render(
            <VideoStage
                jobStatus="idle"
                jobProgress={100}
                activeVideo={validVeoVideo}
                setVideoInputs={mockSetVideoInputs}
            />
        );

        const player = screen.getByTestId('video-player');
        expect(player).toBeInTheDocument();
        expect(player).toHaveAttribute('src', validVeoVideo.url);
        // Verify no error message
        expect(screen.queryByText(/Playback Error/)).not.toBeInTheDocument();
    });

    it('🛡️ MIME Type Guard: Rejects non-MP4 assets (e.g. PDF injections)', () => {
        const invalidMimeVideo: HistoryItem = {
            ...validVeoVideo,
            id: 'hacker-job-666',
            meta: JSON.stringify({
                mime_type: 'application/pdf', // ❌ Invalid for Veo
                fps: 0,
                duration_seconds: 0
            })
        };

        render(
            <VideoStage
                jobStatus="idle"
                jobProgress={100}
                activeVideo={invalidMimeVideo}
                setVideoInputs={mockSetVideoInputs}
            />
        );

        // Assert player is NOT present
        expect(screen.queryByTestId('video-player')).not.toBeInTheDocument();

        // Assert Error Message
        expect(screen.getByText(/Invalid video format: application\/pdf/)).toBeInTheDocument();
        expect(screen.getByText(/Lens requires video\/mp4/)).toBeInTheDocument();
    });

    it('🚨 Critical Failure: Handles 404/Codec errors gracefully', () => {
        render(
            <VideoStage
                jobStatus="idle"
                jobProgress={100}
                activeVideo={validVeoVideo}
                setVideoInputs={mockSetVideoInputs}
            />
        );

        const player = screen.getByTestId('video-player');

        // Simulate 404 error
        fireEvent.error(player);

        // Assert error UI replaces player
        expect(screen.getByText(/Playback Error: Video source unavailable or corrupted/)).toBeInTheDocument();
        // The player might be removed or hidden depending on implementation (in my implementation, it's removed)
        expect(screen.queryByTestId('video-player')).not.toBeInTheDocument();
    });

    it('⚡ Flash Generation: Shows player instantly for "completed" jobs', () => {
        // "If Gemini 3 Flash generates it, it must appear instantly."
        render(
            <VideoStage
                jobStatus="completed" // Job is done
                jobProgress={100}
                activeVideo={validVeoVideo}
                setVideoInputs={mockSetVideoInputs}
            />
        );

        expect(screen.getByTestId('video-player')).toBeInTheDocument();
        expect(screen.queryByText(/Imaginating Scene/)).not.toBeInTheDocument();
    });

    it('⏳ Loading State: Displays "Imaginating Scene" when processing', () => {
        render(
            <VideoStage
                jobStatus="processing"
                jobProgress={42}
                activeVideo={null} // Video not ready yet
                setVideoInputs={mockSetVideoInputs}
            />
        );

        expect(screen.getByText(/Imaginating Scene.../)).toBeInTheDocument();
        expect(screen.getByText(/AI Director is framing the scene... \(42%\)/)).toBeInTheDocument();
        expect(screen.queryByTestId('video-player')).not.toBeInTheDocument();
    });
});
