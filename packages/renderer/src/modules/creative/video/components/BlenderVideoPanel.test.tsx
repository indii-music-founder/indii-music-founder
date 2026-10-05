import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BlenderVideoPanel } from './BlenderVideoPanel';
import { blenderService } from '@/services/blender/BlenderService';

vi.mock('@/services/blender/BlenderService', () => ({
    blenderService: {
        getStatus: vi.fn(),
        listTemplates: vi.fn(),
        renderMusicVideo: vi.fn()
    },
    FALLBACK_TEMPLATES: [
        {
            id: 'audio_reactive_tunnel',
            name: 'Audio-Reactive Cyber Tunnel',
            description: 'Infinite geometric warp tunnel',
            recommendedAspectRatio: '16:9',
            defaultDurationSeconds: 30,
            supportsCoverArt: false,
            supportsCustomText: true,
            tags: ['neon']
        },
        {
            id: 'vinyl_turntable',
            name: '3D Vinyl Record Turntable Showcase',
            description: 'Photorealistic vinyl record',
            recommendedAspectRatio: '16:9',
            defaultDurationSeconds: 30,
            supportsCoverArt: true,
            supportsCustomText: true,
            tags: ['vinyl']
        }
    ]
}));

// Legacy doubles remain structural-only; this suite is not render/customer acceptance.
describe('BlenderVideoPanel structural guards', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(blenderService.getStatus).mockResolvedValue({
            installed: true,
            executablePath: '/Applications/Blender.app',
            version: 'Blender 4.3',
            supportedEngines: ['BLENDER_EEVEE_NEXT', 'CYCLES'],
            gpuAcceleration: 'Metal',
            liveConnected: true
        });
        vi.mocked(blenderService.listTemplates).mockResolvedValue([
            {
                id: 'audio_reactive_tunnel',
                name: 'Audio-Reactive Cyber Tunnel',
                description: 'Infinite geometric warp tunnel',
                recommendedAspectRatio: '16:9',
                defaultDurationSeconds: 30,
                supportsCoverArt: false,
                supportsCustomText: true,
                tags: ['neon']
            }
        ]);
        vi.mocked(blenderService.renderMusicVideo).mockResolvedValue({
            success: true,
            outputPath: '/renders/music_video.mp4'
        });
    });

    it('renders the header and requires the desktop bridge even if legacy status says installed', async () => {
        await act(async () => {
            render(<BlenderVideoPanel />);
        });
        expect(screen.getByText(/Blender 3D Music Video Engine/i)).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText(/Open desktop studio/i)).toBeInTheDocument();
            expect(screen.queryByText(/Blender 4.3 \(Metal GPU\)/i)).not.toBeInTheDocument();
        });
    });

    it('asks for desktop studio when the browser cannot inspect local Blender', async () => {
        vi.mocked(blenderService.getStatus).mockResolvedValueOnce({
            installed: false,
            executablePath: null,
            version: null,
            supportedEngines: [],
            gpuAcceleration: 'None',
            liveConnected: false
        });

        await act(async () => {
            render(<BlenderVideoPanel />);
        });
        await waitFor(() => {
            expect(screen.getByText(/Open desktop studio/i)).toBeInTheDocument();
            expect(screen.getByText(/Render 3D videos in the desktop studio/i)).toBeInTheDocument();
        });
    });

    it('allows changing aspect ratio', async () => {
        await act(async () => {
            render(<BlenderVideoPanel />);
        });
        const shortsButton = screen.getByText(/9:16 \(Shorts\/TikTok\)/i);
        await act(async () => {
            fireEvent.click(shortsButton);
        });

        expect(shortsButton.className).toContain('border-cyan-500');
    });

    it('blocks rendering and completion without the desktop bridge', async () => {
        const onCompleteMock = vi.fn();
        await act(async () => {
            render(
                <BlenderVideoPanel
                    currentAudioPath="/audio/song.wav"
                    artistName="My Artist"
                    trackTitle="My Song"
                    onRenderComplete={onCompleteMock}
                />
            );
        });

        const renderButton = screen.getByRole('button', { name: /Render 3D Music Video/i });
        await act(async () => {
            fireEvent.click(renderButton);
        });

        expect(renderButton).toBeDisabled();
        expect(blenderService.renderMusicVideo).not.toHaveBeenCalled();
        expect(onCompleteMock).not.toHaveBeenCalled();
        expect(screen.queryByText(/Video rendered and saved/i)).not.toBeInTheDocument();
    });
});
