import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoAgent } from './VideoAgent';

// Mock raw prompt import
vi.mock('@agents/video/prompt.md?raw', () => ({
    default: 'Mock Video Prompt'
}));

// Mock VideoTools
vi.mock('../tools/VideoTools', () => ({
    VideoTools: {
        generate_video: vi.fn(),
        batch_edit_videos: vi.fn(),
        extend_video: vi.fn(),
        update_keyframe: vi.fn(),
        orchestrate_timeline: vi.fn(),
    }
}));

// Mock UniversalTools
vi.mock('../tools/UniversalTools', () => ({
    UniversalTools: {
        browser_tool: vi.fn(),
        indii_image_gen: vi.fn(),
    }
}));

describe('VideoAgent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should have the correct metadata properties', () => {
        expect(VideoAgent.id).toBe('video');
        expect(VideoAgent.name).toBe('Video Director');
        expect(VideoAgent.category).toBe('department');
        expect(VideoAgent.systemPrompt).toBe('Mock Video Prompt');
    });

    it('should expose the correct authorized tools', () => {
        expect(VideoAgent.authorizedTools).toContain('generate_video');
        expect(VideoAgent.authorizedTools).toContain('batch_edit_videos');
        expect(VideoAgent.authorizedTools).toContain('extend_video');
        expect(VideoAgent.authorizedTools).toContain('update_keyframe');
        expect(VideoAgent.authorizedTools).toContain('browser_tool');
        expect(VideoAgent.authorizedTools).toContain('indii_image_gen');
        expect(VideoAgent.authorizedTools).toContain('orchestrate_timeline');
    });

    it('should map the functions to correct tool implementations', () => {
        expect(VideoAgent.functions!.generate_video).toBeDefined();
        expect(VideoAgent.functions!.batch_edit_videos).toBeDefined();
        expect(VideoAgent.functions!.extend_video).toBeDefined();
        expect(VideoAgent.functions!.update_keyframe).toBeDefined();
        expect(VideoAgent.functions!.browser_tool).toBeDefined();
        expect(VideoAgent.functions!.indii_image_gen).toBeDefined();
        expect(VideoAgent.functions!.orchestrate_timeline).toBeDefined();
    });
});
