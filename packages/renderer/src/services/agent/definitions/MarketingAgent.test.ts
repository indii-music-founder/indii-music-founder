import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketingAgent } from './MarketingAgent';

// Mock raw prompt import
vi.mock('@agents/marketing/prompt.md?raw', () => ({
    default: 'Mock Marketing Prompt'
}));

// Mock MarketingTools
vi.mock('../tools/MarketingTools', () => ({
    MarketingTools: {
        create_campaign_brief: vi.fn(),
        analyze_audience: vi.fn(),
        schedule_content: vi.fn(),
        track_performance: vi.fn(),
        generate_campaign_from_audio: vi.fn(),
        generate_ab_campaign: vi.fn(),
        deploy_micro_ad_campaign: vi.fn(),
        deploy_email_newsletter: vi.fn(),
        generate_presave_campaign: vi.fn(),
        deploy_sms_blast: vi.fn(),
        enrich_fan_data: vi.fn(),
        generate_influencer_bounty: vi.fn(),
    }
}));

// Mock UniversalTools
vi.mock('../tools/UniversalTools', () => ({
    UniversalTools: {
        browser_tool: vi.fn(),
        indii_image_gen: vi.fn(),
    }
}));

// Mock AutonomousTools
vi.mock('../tools/AutonomousTools', () => ({
    AutonomousTools: {
        create_artifact_drop: vi.fn(),
    }
}));

describe('MarketingAgent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should have the correct metadata properties', () => {
        expect(MarketingAgent.id).toBe('marketing');
        expect(MarketingAgent.name).toBe('Marketing Director');
        expect(MarketingAgent.category).toBe('department');
        expect(MarketingAgent.systemPrompt).toBe('Mock Marketing Prompt');
    });

    it('should expose the correct authorized tools', () => {
        expect(MarketingAgent.authorizedTools).toContain('create_campaign_brief');
        expect(MarketingAgent.authorizedTools).toContain('analyze_audience');
        expect(MarketingAgent.authorizedTools).toContain('schedule_content');
        expect(MarketingAgent.authorizedTools).toContain('track_performance');
        expect(MarketingAgent.authorizedTools).toContain('generate_campaign_from_audio');
        expect(MarketingAgent.authorizedTools).toContain('browser_tool');
        expect(MarketingAgent.authorizedTools).toContain('indii_image_gen');
        expect(MarketingAgent.authorizedTools).toContain('create_artifact_drop');
        expect(MarketingAgent.authorizedTools).toContain('generate_ab_campaign');
        expect(MarketingAgent.authorizedTools).toContain('deploy_micro_ad_campaign');
        expect(MarketingAgent.authorizedTools).toContain('deploy_email_newsletter');
        expect(MarketingAgent.authorizedTools).toContain('generate_presave_campaign');
        expect(MarketingAgent.authorizedTools).toContain('deploy_sms_blast');
        expect(MarketingAgent.authorizedTools).toContain('enrich_fan_data');
        expect(MarketingAgent.authorizedTools).toContain('generate_influencer_bounty');
    });

    it('should map the functions to correct tool implementations', () => {
        expect(MarketingAgent.functions!.create_campaign_brief).toBeDefined();
        expect(MarketingAgent.functions!.analyze_audience).toBeDefined();
        expect(MarketingAgent.functions!.schedule_content).toBeDefined();
        expect(MarketingAgent.functions!.track_performance).toBeDefined();
        expect(MarketingAgent.functions!.generate_campaign_from_audio).toBeDefined();
        expect(MarketingAgent.functions!.browser_tool).toBeDefined();
        expect(MarketingAgent.functions!.indii_image_gen).toBeDefined();
        expect(MarketingAgent.functions!.create_artifact_drop).toBeDefined();
        expect(MarketingAgent.functions!.generate_ab_campaign).toBeDefined();
        expect(MarketingAgent.functions!.deploy_micro_ad_campaign).toBeDefined();
        expect(MarketingAgent.functions!.deploy_email_newsletter).toBeDefined();
        expect(MarketingAgent.functions!.generate_presave_campaign).toBeDefined();
        expect(MarketingAgent.functions!.deploy_sms_blast).toBeDefined();
        expect(MarketingAgent.functions!.enrich_fan_data).toBeDefined();
        expect(MarketingAgent.functions!.generate_influencer_bounty).toBeDefined();
    });
});
