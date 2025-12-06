
import { describe, it, expect } from 'vitest';
import { MusicAgent } from './MusicAgent';
import { DirectorAgent } from './DirectorAgent';
import { BrandAgent } from './BrandAgent';
import { RoadAgent } from './RoadAgent';
import { PublicistAgent } from './PublicistAgent';
import { SocialAgent } from './SocialAgent';
import { PublishingAgent } from './PublishingAgent';
import { FinanceAgent } from './FinanceAgent';
import { LicensingAgent } from './LicensingAgent';

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

    it('SocialAgent should have social and trend tools', () => {
        const agent = new SocialAgent();
        const tools = agent.tools || [];
        const decls = tools.flatMap(t => t.functionDeclarations || []);

        expect(decls.some(f => f.name === 'generate_social_post')).toBe(true);
        expect(decls.some(f => f.name === 'analyze_trends')).toBe(true);
    });

    it('FinanceAgent should have budget tools', () => {
        const agent = new FinanceAgent();
        const tools = agent.tools || [];
        const decls = tools.flatMap(t => t.functionDeclarations || []);

        expect(decls.some(f => f.name === 'analyze_budget')).toBe(true);
    });

    it('PublishingAgent should have registration tools', () => {
        const agent = new PublishingAgent();
        const tools = agent.tools || [];
        const decls = tools.flatMap(t => t.functionDeclarations || []);

        expect(decls.some(f => f.name === 'register_work')).toBe(true);
        expect(decls.some(f => f.name === 'analyze_contract')).toBe(true);
    });

    it('LicensingAgent should have clearance tools', () => {
        const agent = new LicensingAgent();
        const tools = agent.tools || [];
        const decls = tools.flatMap(t => t.functionDeclarations || []);

        expect(decls.some(f => f.name === 'check_availability')).toBe(true);
        expect(decls.some(f => f.name === 'analyze_contract')).toBe(true);
    });
});
