
import { describe, it, expect } from 'vitest';
import { MusicAgent } from './MusicAgent';
import { DirectorAgent } from './DirectorAgent';
import { BrandAgent } from './BrandAgent';
import { RoadAgent } from './RoadAgent';
import { PublicistAgent } from './PublicistAgent';

describe('Specialist Agent Tools', () => {
    it('MusicAgent should have analyze_audio tool', () => {
        const agent = new MusicAgent();
        const tools = agent.tools || [];
        // agent.tools is array of objects with functionDeclarations
        const hasTool = tools.some(t =>
            t.functionDeclarations?.some(f => f.name === 'analyze_audio')
        );
        expect(hasTool).toBe(true);
    });

    it('DirectorAgent should have visual generation tools', () => {
        const agent = new DirectorAgent();
        const tools = agent.tools || [];
        const decls = tools.flatMap(t => t.functionDeclarations || []);

        expect(decls.some(f => f.name === 'generate_image')).toBe(true);
        expect(decls.some(f => f.name === 'generate_video')).toBe(true);
        expect(decls.some(f => f.name === 'batch_edit_images')).toBe(true);
    });

    it('BrandAgent should have verify_output tool', () => {
        const agent = new BrandAgent();
        const tools = agent.tools || [];
        const decls = tools.flatMap(t => t.functionDeclarations || []);

        expect(decls.some(f => f.name === 'verify_output')).toBe(true);
    });

    it('RoadAgent should have ops tools', () => {
        const agent = new RoadAgent();
        const tools = agent.tools || [];
        const decls = tools.flatMap(t => t.functionDeclarations || []);

        expect(decls.some(f => f.name === 'create_project')).toBe(true);
        expect(decls.some(f => f.name === 'search_knowledge')).toBe(true);
    });

    it('PublicistAgent should have PR tools', () => {
        const agent = new PublicistAgent();
        const tools = agent.tools || [];
        const decls = tools.flatMap(t => t.functionDeclarations || []);

        expect(decls.some(f => f.name === 'write_press_release')).toBe(true);
        expect(decls.some(f => f.name === 'generate_crisis_response')).toBe(true);
    });
});
