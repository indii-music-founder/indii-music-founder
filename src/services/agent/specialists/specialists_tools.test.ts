
import { describe, it, expect } from 'vitest';
import { agentRegistry } from '../registry';

describe('Specialist Agent Tools', () => {
    it('MusicAgent should have analyze_audio tool', () => {
        const agent = agentRegistry.get('music');
        if (!agent) throw new Error('Music agent not found');

        // BaseAgent stores config.tools in public tools property
        // But the class property is what we check. 
        // In BaseAgent implementation: this.tools = config.tools || [];
        const tools = (agent as any).tools || [];

        const hasTool = tools.some((t: any) =>
            t.functionDeclarations?.some((f: any) => f.name === 'analyze_audio')
        );
        expect(hasTool).toBe(true);
    });

    it('DirectorAgent should have visual generation tools', () => {
        const agent = agentRegistry.get('director'); // ID is 'director' in AgentConfig? 
        // Wait, DirectorAgent.ts said id='creative'. 
        // In my agentConfig.ts, I set id='director'. 
        // I should check if I changed the ID intentionally. 
        // DirectorAgent.ts: id='creative', name='Creative Director'.
        // agentConfig.ts: id='director', name='Creative Director'.
        // This is a CHANGE. I should respect the new ID 'director'.
        if (!agent) throw new Error('Director agent not found');

        const tools = (agent as any).tools || [];
        const decls = tools.flatMap((t: any) => t.functionDeclarations || []);

        expect(decls.some((f: any) => f.name === 'generate_image')).toBe(true);
        expect(decls.some((f: any) => f.name === 'generate_video')).toBe(true);
        expect(decls.some((f: any) => f.name === 'batch_edit_images')).toBe(true);
    });

    it('BrandAgent should have verify_output tool', () => {
        const agent = agentRegistry.get('brand');
        if (!agent) throw new Error('Brand agent not found');

        const tools = (agent as any).tools || [];
        const decls = tools.flatMap((t: any) => t.functionDeclarations || []);

        expect(decls.some((f: any) => f.name === 'verify_output')).toBe(true);
    });

    it('RoadAgent should have ops tools', () => {
        const agent = agentRegistry.get('road-manager');
        if (!agent) throw new Error('Road agent not found');

        const tools = (agent as any).tools || [];
        const decls = tools.flatMap((t: any) => t.functionDeclarations || []);

        expect(decls.some((f: any) => f.name === 'create_project')).toBe(true);
        expect(decls.some((f: any) => f.name === 'search_knowledge')).toBe(true);
    });

    it('PublicistAgent should have PR tools', () => {
        const agent = agentRegistry.get('publicist');
        if (!agent) throw new Error('Publicist agent not found');

        const tools = (agent as any).tools || [];
        const decls = tools.flatMap((t: any) => t.functionDeclarations || []);

        expect(decls.some((f: any) => f.name === 'write_press_release')).toBe(true);
        expect(decls.some((f: any) => f.name === 'generate_crisis_response')).toBe(true);
    });

    it('SocialAgent should have social and trend tools', () => {
        const agent = agentRegistry.get('social');
        if (!agent) throw new Error('Social agent not found');

        const tools = (agent as any).tools || [];
        const decls = tools.flatMap((t: any) => t.functionDeclarations || []);

        expect(decls.some((f: any) => f.name === 'generate_social_post')).toBe(true);
        expect(decls.some((f: any) => f.name === 'analyze_trends')).toBe(true);
    });

    it('FinanceAgent should have budget tools', () => {
        const agent = agentRegistry.get('finance');
        if (!agent) throw new Error('Finance agent not found');

        const tools = (agent as any).tools || [];
        const decls = tools.flatMap((t: any) => t.functionDeclarations || []);

        expect(decls.some((f: any) => f.name === 'analyze_budget')).toBe(true);
    });

    it('PublishingAgent should have registration tools', () => {
        const agent = agentRegistry.get('publishing');
        if (!agent) throw new Error('Publishing agent not found');

        const tools = (agent as any).tools || [];
        const decls = tools.flatMap((t: any) => t.functionDeclarations || []);

        expect(decls.some((f: any) => f.name === 'register_work')).toBe(true);
        expect(decls.some((f: any) => f.name === 'analyze_contract')).toBe(true);
    });

    it('LicensingAgent should have clearance tools', () => {
        const agent = agentRegistry.get('licensing');
        if (!agent) throw new Error('Licensing agent not found');

        const tools = (agent as any).tools || [];
        const decls = tools.flatMap((t: any) => t.functionDeclarations || []);

        expect(decls.some((f: any) => f.name === 'check_availability')).toBe(true);
        expect(decls.some((f: any) => f.name === 'analyze_contract')).toBe(true);
    });
});
