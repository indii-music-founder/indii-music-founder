
import { describe, it, expect } from 'vitest';
import { agentRegistry } from '../registry';

describe('Specialist Agent Tools', () => {
    it('DirectorAgent should have visual generation tools', async () => {
        const agent = await agentRegistry.getAsync('director');
        if (!agent) throw new Error('Director agent not found');

        const tools = (agent as any).tools || [];
        const decls = tools.flatMap((t: any) => t.functionDeclarations || []);

        expect(decls.some((f: any) => f.name === 'generate_image')).toBe(true);
        expect(decls.some((f: any) => f.name === 'generate_video')).toBe(true);
        expect(decls.some((f: any) => f.name === 'batch_edit_images')).toBe(true);
    });

    it('BrandAgent should have verify_output tool', async () => {
        const agent = await agentRegistry.getAsync('brand');
        if (!agent) throw new Error('Brand agent not found');

        const tools = (agent as any).tools || [];
        const decls = tools.flatMap((t: any) => t.functionDeclarations || []);

        expect(decls.some((f: any) => f.name === 'verify_output')).toBe(true);
    });

    it('RoadAgent should have ops tools', async () => {
        const agent = await agentRegistry.getAsync('road');
        if (!agent) throw new Error('Road agent not found');

        const tools = (agent as any).tools || [];
        const decls = tools.flatMap((t: any) => t.functionDeclarations || []);

        expect(decls.some((f: any) => f.name === 'create_project')).toBe(true);
        expect(decls.some((f: any) => f.name === 'search_knowledge')).toBe(true);
    });

    it('PublicistAgent should have PR tools', async () => {
        const agent = await agentRegistry.getAsync('publicist');
        if (!agent) throw new Error('Publicist agent not found');

        const tools = (agent as any).tools || [];
        const decls = tools.flatMap((t: any) => t.functionDeclarations || []);

        expect(decls.some((f: any) => f.name === 'write_press_release')).toBe(true);
        expect(decls.some((f: any) => f.name === 'generate_crisis_response')).toBe(true);
    });

    it('SocialAgent should have social and trend tools', async () => {
        const agent = await agentRegistry.getAsync('social');
        if (!agent) throw new Error('Social agent not found');

        const tools = (agent as any).tools || [];
        const decls = tools.flatMap((t: any) => t.functionDeclarations || []);

        expect(decls.some((f: any) => f.name === 'generate_social_post')).toBe(true);
        expect(decls.some((f: any) => f.name === 'analyze_trends')).toBe(true);
    });

    it('FinanceAgent should have budget tools', async () => {
        const agent = await agentRegistry.getAsync('finance');
        if (!agent) throw new Error('Finance agent not found');

        const tools = (agent as any).tools || [];
        const decls = tools.flatMap((t: any) => t.functionDeclarations || []);

        expect(decls.some((f: any) => f.name === 'analyze_budget')).toBe(true);
    });

    it('PublishingAgent should have registration tools', async () => {
        const agent = await agentRegistry.getAsync('publishing');
        if (!agent) throw new Error('Publishing agent not found');

        const tools = (agent as any).tools || [];
        const decls = tools.flatMap((t: any) => t.functionDeclarations || []);

        expect(decls.some((f: any) => f.name === 'register_work')).toBe(true);
        expect(decls.some((f: any) => f.name === 'analyze_contract')).toBe(true);
    });

    it('LicensingAgent should have clearance tools', async () => {
        const agent = await agentRegistry.getAsync('licensing');
        if (!agent) throw new Error('Licensing agent not found');

        const tools = (agent as any).tools || [];
        const decls = tools.flatMap((t: any) => t.functionDeclarations || []);

        expect(decls.some((f: any) => f.name === 'check_availability')).toBe(true);
        expect(decls.some((f: any) => f.name === 'analyze_contract')).toBe(true);
    });
});
