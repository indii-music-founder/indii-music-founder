import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StudioSettingsPanel from './StudioSettingsPanel';

const { mockUseStore } = vi.hoisted(() => {
    const state = {
        studioControls: {
            resolution: '720p',
            aspectRatio: '16:9',
            model: 'fast',
            personGeneration: 'allow_adult',
            mediaResolution: 'medium',
            thinkingLevel: 'none',
            useGrounding: false,
            generateAudio: false,
            negativePrompt: '',
            fps: 24,
            duration: 5,
        },
        setStudioControls: vi.fn(),
        generationMode: 'video',
    };
    const useStoreMock = vi.fn((selector: (s: typeof state) => unknown) => selector(state));
    return { mockUseStore: useStoreMock };
});

vi.mock('@/core/store', () => ({
    useStore: mockUseStore,
}));

/**
 * ISSUE-807: Veo has no API-level audio toggle — unchecking this control
 * only appends prompt-level "silent video" hints, it does not guarantee
 * silence. The control must not read as a deterministic on/off switch.
 */
describe('StudioSettingsPanel — Audio toggle honesty (ISSUE-807)', () => {
    it('labels the audio toggle as requested, not guaranteed', () => {
        render(<StudioSettingsPanel onClose={() => {}} />);
        // With audio OFF the label reads "Silent (requested)" — the "(requested)"
        // qualifier is the honesty signal that silence is prompt-level, not enforced.
        expect(screen.getByText('Silent (requested)')).toBeInTheDocument();
    });

    it('explains via tooltip that this is a prompt-level request, not an API guarantee', () => {
        render(<StudioSettingsPanel onClose={() => {}} />);
        const toggle = screen.getByTestId('settings-audio-toggle');
        expect(toggle.getAttribute('title')).toMatch(/no API-level audio toggle/i);
        expect(toggle.getAttribute('title')).toMatch(/not guaranteed/i);
    });
});
