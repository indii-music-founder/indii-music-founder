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

vi.mock('../tools/VideoProjectTools', () => ({
    VideoProjectTools: {
        inspect_video_project: vi.fn(),
        add_video_clip: vi.fn(),
        update_video_clip: vi.fn(),
        queue_video_render: vi.fn(),
    }
}));


vi.mock('../tools/StorageTools', () => ({
    StorageTools: {
        list_files: vi.fn(),
        search_files: vi.fn(),
    }
}));

vi.mock('../tools/EditorTools', () => ({
    EditorTools: {
        video_list_renderable_assets: vi.fn(),
        video_plan_sequence: vi.fn(),
        video_plan_chain: vi.fn(),
        video_render_stitch: vi.fn(),
        video_render_chain: vi.fn(),
        video_get_render_status: vi.fn(),
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
        expect(VideoAgent.authorizedTools).toContain('list_stored_assets');
        expect(VideoAgent.authorizedTools).toContain('search_stored_assets');
        expect(VideoAgent.authorizedTools).toContain('batch_edit_videos');
        expect(VideoAgent.authorizedTools).toContain('extend_video');
        expect(VideoAgent.authorizedTools).toContain('update_keyframe');
        expect(VideoAgent.authorizedTools).toContain('browser_tool');
        expect(VideoAgent.authorizedTools).toContain('indii_image_gen');
        expect(VideoAgent.authorizedTools).toContain('orchestrate_timeline');
        expect(VideoAgent.authorizedTools).toContain('generate_storyboard');
        expect(VideoAgent.authorizedTools).toContain('draft_video_budget');
        expect(VideoAgent.authorizedTools).toContain('queue_video_render');
        expect(VideoAgent.authorizedTools).toContain('inspect_video_project');
        expect(VideoAgent.authorizedTools).toContain('add_video_clip');
        expect(VideoAgent.authorizedTools).toContain('update_video_clip');
        expect(VideoAgent.authorizedTools).toContain('video_list_renderable_assets');
        expect(VideoAgent.authorizedTools).toContain('video_plan_sequence');
        expect(VideoAgent.authorizedTools).toContain('video_plan_chain');
        expect(VideoAgent.authorizedTools).toContain('video_render_stitch');
        expect(VideoAgent.authorizedTools).toContain('video_render_chain');
        expect(VideoAgent.authorizedTools).toContain('video_get_render_status');
    });

    it('should map the functions to correct tool implementations', () => {
        expect(VideoAgent.functions!.generate_video).toBeDefined();
        expect(VideoAgent.functions!.list_stored_assets).toBeDefined();
        expect(VideoAgent.functions!.search_stored_assets).toBeDefined();
        expect(VideoAgent.functions!.batch_edit_videos).toBeDefined();
        expect(VideoAgent.functions!.extend_video).toBeDefined();
        expect(VideoAgent.functions!.update_keyframe).toBeDefined();
        expect(VideoAgent.functions!.browser_tool).toBeDefined();
        expect(VideoAgent.functions!.indii_image_gen).toBeDefined();
        expect(VideoAgent.functions!.orchestrate_timeline).toBeDefined();
        expect(VideoAgent.functions!.generate_storyboard).toBeDefined();
        expect(VideoAgent.functions!.draft_video_budget).toBeDefined();
        expect(VideoAgent.functions!.queue_video_render).toBeDefined();
        expect(VideoAgent.functions!.inspect_video_project).toBeDefined();
        expect(VideoAgent.functions!.add_video_clip).toBeDefined();
        expect(VideoAgent.functions!.update_video_clip).toBeDefined();
        expect(VideoAgent.functions!.video_list_renderable_assets).toBeDefined();
        expect(VideoAgent.functions!.video_plan_sequence).toBeDefined();
        expect(VideoAgent.functions!.video_plan_chain).toBeDefined();
        expect(VideoAgent.functions!.video_render_stitch).toBeDefined();
        expect(VideoAgent.functions!.video_render_chain).toBeDefined();
        expect(VideoAgent.functions!.video_get_render_status).toBeDefined();
    });
});
