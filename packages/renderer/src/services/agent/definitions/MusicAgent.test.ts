import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MusicAgent } from './MusicAgent';

// Mock the prompt import which uses Vite's ?raw
vi.mock('@agents/music/prompt.md?raw', () => ({
    default: 'Mock Music Prompt'
}));

// Mock MusicTools
vi.mock('../tools/MusicTools', () => ({
    MusicTools: {
        analyze_audio: vi.fn(),
        create_music_metadata: vi.fn(),
        update_track_metadata: vi.fn(),
        verify_metadata_golden: vi.fn(),
        scrub_id3_tags: vi.fn(),
        inject_splits_to_metadata: vi.fn()
    }
}));

describe('MusicAgent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should have the correct metadata properties', () => {
        expect(MusicAgent.id).toBe('music');
        expect(MusicAgent.name).toBe('Music Director');
        expect(MusicAgent.category).toBe('department');
        expect(MusicAgent.systemPrompt).toBe('Mock Music Prompt');
    });

    it('should expose the correct authorized tools', () => {
        expect(MusicAgent.authorizedTools).toContain('analyze_audio');
        expect(MusicAgent.authorizedTools).toContain('create_music_metadata');
        expect(MusicAgent.authorizedTools).toContain('update_track_metadata');
        expect(MusicAgent.authorizedTools).toContain('verify_metadata_golden');
        expect(MusicAgent.authorizedTools).toContain('scrub_id3_tags');
        expect(MusicAgent.authorizedTools).toContain('inject_splits_to_metadata');
    });

    it('should map the functions to MusicTools implementations', () => {
        expect(MusicAgent.functions!.analyze_audio).toBeDefined();
        expect(MusicAgent.functions!.create_music_metadata).toBeDefined();
        expect(MusicAgent.functions!.update_track_metadata).toBeDefined();
        expect(MusicAgent.functions!.verify_metadata_golden).toBeDefined();
        expect(MusicAgent.functions!.scrub_id3_tags).toBeDefined();
        expect(MusicAgent.functions!.inject_splits_to_metadata).toBeDefined();
    });
});
