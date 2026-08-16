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
    }
}));


vi.mock('../tools/StorageTools', () => ({
    StorageTools: {
        list_files: vi.fn(),
        search_files: vi.fn(),
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
        expect(CreativeAgent.authorizedTools).toContain('canvas_push');
        expect(CreativeAgent.authorizedTools).toContain('generate_moodboard');
        expect(CreativeAgent.authorizedTools).toContain('analyze_visual_trends');
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
        expect(CreativeAgent.functions!.analyze_audio).toBeDefined();
        expect(CreativeAgent.functions!.canvas_push).toBeDefined();
        expect(CreativeAgent.functions!.generate_moodboard).toBeDefined();
        expect(CreativeAgent.functions!.analyze_visual_trends).toBeDefined();
    });
});
