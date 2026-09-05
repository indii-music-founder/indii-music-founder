import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreativeAgent } from './CreativeAgent';

// Mock raw prompt import
vi.mock('@agents/creative/prompt.md?raw', () => ({
    default: 'Mock Creative Prompt'
}));

// Mock DirectorTools
vi.mock('../tools/DirectorTools', () => ({
    DirectorTools: {
        generate_image: vi.fn(),
        batch_edit_images: vi.fn(),
        run_showroom_mockup: vi.fn(),
        generate_high_res_asset: vi.fn(),
        render_cinematic_grid: vi.fn(),
        extract_grid_frame: vi.fn(),
        add_character_reference: vi.fn(),
        analyze_audio: vi.fn(),
        canvas_push: vi.fn(),
        generate_moodboard: vi.fn(),
        analyze_visual_trends: vi.fn(),
        fuse_likeness: vi.fn(),
        render_typography: vi.fn(),
        generate_mockup: vi.fn(),
        render_distribution_bundle: vi.fn(),
        export_platform_assets: vi.fn(),
        scan_brand_compliance: vi.fn(),
        record_asset_version: vi.fn(),
        promote_asset_version: vi.fn(),
        set_asset_rights: vi.fn(),
    }
}));

vi.mock('../tools/CanvasTools', () => ({
    CanvasTools: {
        canvas_open_image: vi.fn(),
        canvas_add_layer: vi.fn(),
        canvas_set_adjustments: vi.fn(),
        canvas_export: vi.fn(),
        canvas_push: vi.fn(),
    }
}));

vi.mock('../tools/VideoTools', () => ({
    VideoTools: {
        animate_still: vi.fn(),
        interpolate_sequence: vi.fn(),
    }
}));

vi.mock('../tools/VideoProjectTools', () => ({
    VideoProjectTools: { queue_video_render: vi.fn() }
}));

vi.mock('../tools/McpTools', () => ({
    McpTools: {
        queue_release_canvas_render: vi.fn(),
        audit_asset_resolutions: vi.fn(),
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

describe('CreativeAgent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should have the correct metadata properties', () => {
        expect(CreativeAgent.id).toBe('creative');
        expect(CreativeAgent.name).toBe('Creative Director');
        expect(CreativeAgent.category).toBe('department');
        expect(CreativeAgent.systemPrompt).toBe('Mock Creative Prompt');
    });

    it('should expose the correct authorized tools', () => {
        expect(CreativeAgent.authorizedTools).toContain('generate_image');
        expect(CreativeAgent.authorizedTools).toContain('list_stored_assets');
        expect(CreativeAgent.authorizedTools).toContain('search_stored_assets');
        expect(CreativeAgent.authorizedTools).toContain('batch_edit_images');
        expect(CreativeAgent.authorizedTools).toContain('run_showroom_mockup');
        expect(CreativeAgent.authorizedTools).toContain('generate_high_res_asset');
        expect(CreativeAgent.authorizedTools).toContain('render_cinematic_grid');
        expect(CreativeAgent.authorizedTools).toContain('extract_grid_frame');
        expect(CreativeAgent.authorizedTools).toContain('add_character_reference');
        expect(CreativeAgent.authorizedTools).toContain('analyze_audio');
        expect(CreativeAgent.authorizedTools).toContain('fuse_likeness');
        expect(CreativeAgent.authorizedTools).toContain('render_typography');
        expect(CreativeAgent.authorizedTools).toContain('generate_mockup');
        expect(CreativeAgent.authorizedTools).toContain('render_distribution_bundle');
        expect(CreativeAgent.authorizedTools).toContain('canvas_open_image');
        expect(CreativeAgent.authorizedTools).toContain('canvas_add_layer');
        expect(CreativeAgent.authorizedTools).toContain('canvas_set_adjustments');
        expect(CreativeAgent.authorizedTools).toContain('canvas_export');
        expect(CreativeAgent.authorizedTools).toContain('animate_still');
        expect(CreativeAgent.authorizedTools).toContain('export_platform_assets');
        expect(CreativeAgent.authorizedTools).toContain('scan_brand_compliance');
        expect(CreativeAgent.authorizedTools).toContain('record_asset_version');
        expect(CreativeAgent.authorizedTools).toContain('promote_asset_version');
        expect(CreativeAgent.authorizedTools).toContain('set_asset_rights');
        expect(CreativeAgent.authorizedTools).toContain('canvas_push');
        expect(CreativeAgent.authorizedTools).toContain('generate_moodboard');
        expect(CreativeAgent.authorizedTools).toContain('analyze_visual_trends');
        expect(CreativeAgent.authorizedTools).toContain('queue_video_render');
        expect(CreativeAgent.authorizedTools).toContain('queue_release_canvas_render');
        expect(CreativeAgent.authorizedTools).toContain('video_list_renderable_assets');
        expect(CreativeAgent.authorizedTools).toContain('video_plan_sequence');
        expect(CreativeAgent.authorizedTools).toContain('video_plan_chain');
        expect(CreativeAgent.authorizedTools).toContain('video_render_stitch');
        expect(CreativeAgent.authorizedTools).toContain('video_render_chain');
        expect(CreativeAgent.authorizedTools).toContain('video_get_render_status');
    });

    it('should map the functions to correct tool implementations', () => {
        expect(CreativeAgent.functions!.generate_image).toBeDefined();
        expect(CreativeAgent.functions!.list_stored_assets).toBeDefined();
        expect(CreativeAgent.functions!.search_stored_assets).toBeDefined();
        expect(CreativeAgent.functions!.batch_edit_images).toBeDefined();
        expect(CreativeAgent.functions!.run_showroom_mockup).toBeDefined();
        expect(CreativeAgent.functions!.generate_high_res_asset).toBeDefined();
        expect(CreativeAgent.functions!.render_cinematic_grid).toBeDefined();
        expect(CreativeAgent.functions!.extract_grid_frame).toBeDefined();
        expect(CreativeAgent.functions!.add_character_reference).toBeDefined();
        expect(CreativeAgent.functions!.fuse_likeness).toBeDefined();
        expect(CreativeAgent.functions!.render_typography).toBeDefined();
        expect(CreativeAgent.functions!.generate_mockup).toBeDefined();
        expect(CreativeAgent.functions!.render_distribution_bundle).toBeDefined();
        expect(CreativeAgent.functions!.canvas_open_image).toBeDefined();
        expect(CreativeAgent.functions!.canvas_add_layer).toBeDefined();
        expect(CreativeAgent.functions!.canvas_set_adjustments).toBeDefined();
        expect(CreativeAgent.functions!.canvas_export).toBeDefined();
        expect(CreativeAgent.functions!.animate_still).toBeDefined();
        expect(CreativeAgent.functions!.export_platform_assets).toBeDefined();
        expect(CreativeAgent.functions!.scan_brand_compliance).toBeDefined();
        expect(CreativeAgent.functions!.record_asset_version).toBeDefined();
        expect(CreativeAgent.functions!.promote_asset_version).toBeDefined();
        expect(CreativeAgent.functions!.set_asset_rights).toBeDefined();
        expect(CreativeAgent.functions!.analyze_audio).toBeDefined();
        expect(CreativeAgent.functions!.canvas_push).toBeDefined();
        expect(CreativeAgent.functions!.generate_moodboard).toBeDefined();
        expect(CreativeAgent.functions!.analyze_visual_trends).toBeDefined();
        expect(CreativeAgent.functions!.queue_video_render).toBeDefined();
        expect(CreativeAgent.functions!.queue_release_canvas_render).toBeDefined();
        expect(CreativeAgent.functions!.video_list_renderable_assets).toBeDefined();
        expect(CreativeAgent.functions!.video_plan_sequence).toBeDefined();
        expect(CreativeAgent.functions!.video_plan_chain).toBeDefined();
        expect(CreativeAgent.functions!.video_render_stitch).toBeDefined();
        expect(CreativeAgent.functions!.video_render_chain).toBeDefined();
        expect(CreativeAgent.functions!.video_get_render_status).toBeDefined();
    });

    it('should declare schemas for all specialized creative tools in functionDeclarations', () => {
        const declaredNames = new Set(
            (CreativeAgent.tools?.[0]?.functionDeclarations ?? []).map((d) => d.name)
        );

        const expectedSpecializedTools = [
            'fuse_likeness',
            'render_typography',
            'canvas_open_image',
            'canvas_add_layer',
            'canvas_set_adjustments',
            'canvas_export',
            'animate_still',
            'generate_mockup',
            'export_platform_assets',
            'scan_brand_compliance',
            'record_asset_version',
            'promote_asset_version',
            'set_asset_rights',
            'render_distribution_bundle'
        ];

        for (const toolName of expectedSpecializedTools) {
            expect(declaredNames.has(toolName), `Tool declaration missing for: ${toolName}`).toBe(true);
        }
    });
});
