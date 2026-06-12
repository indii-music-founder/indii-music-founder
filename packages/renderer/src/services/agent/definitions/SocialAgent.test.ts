import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SocialAgent } from './SocialAgent';

// Mock raw prompt import
vi.mock('@agents/social/prompt.md?raw', () => ({
    default: 'Mock Social Prompt'
}));

// Mock SocialTools
vi.mock('../tools/SocialTools', () => ({
    SocialTools: {
        generate_social_post: vi.fn(),
        analyze_social_sentiment: vi.fn(),
        schedule_social_post: vi.fn(),
        analyze_sentiment: vi.fn(),
        multi_platform_autopost: vi.fn(),
        dispatch_community_webhook: vi.fn(),
    }
}));

// Mock UniversalTools
vi.mock('../tools/UniversalTools', () => ({
    UniversalTools: {
        browser_tool: vi.fn(),
        indii_image_gen: vi.fn(),
        credential_vault: vi.fn(),
    }
}));

describe('SocialAgent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should have the correct metadata properties', () => {
        expect(SocialAgent.id).toBe('social');
        expect(SocialAgent.name).toBe('Social Media Director');
        expect(SocialAgent.category).toBe('department');
        expect(SocialAgent.systemPrompt).toBe('Mock Social Prompt');
    });

    it('should expose the correct authorized tools', () => {
        expect(SocialAgent.authorizedTools).toContain('create_social_calendar');
        expect(SocialAgent.authorizedTools).toContain('schedule_post_execution');
        expect(SocialAgent.authorizedTools).toContain('generate_social_post');
        expect(SocialAgent.authorizedTools).toContain('analyze_trends');
        expect(SocialAgent.authorizedTools).toContain('browser_tool');
        expect(SocialAgent.authorizedTools).toContain('indii_image_gen');
        expect(SocialAgent.authorizedTools).toContain('credential_vault');
        expect(SocialAgent.authorizedTools).toContain('draft_advanced_thread');
        expect(SocialAgent.authorizedTools).toContain('analyze_sentiment');
        expect(SocialAgent.authorizedTools).toContain('multi_platform_autopost');
        expect(SocialAgent.authorizedTools).toContain('dispatch_community_webhook');
    });

    it('should map the functions to correct tool implementations', () => {
        expect(SocialAgent.functions!.analyze_trends).toBeDefined();
        expect(SocialAgent.functions!.generate_social_post).toBeDefined();
        expect(SocialAgent.functions!.create_social_calendar).toBeDefined();
        expect(SocialAgent.functions!.schedule_post_execution).toBeDefined();
        expect(SocialAgent.functions!.draft_advanced_thread).toBeDefined();
        expect(SocialAgent.functions!.browser_tool).toBeDefined();
        expect(SocialAgent.functions!.indii_image_gen).toBeDefined();
        expect(SocialAgent.functions!.credential_vault).toBeDefined();
        expect(SocialAgent.functions!.analyze_sentiment).toBeDefined();
        expect(SocialAgent.functions!.multi_platform_autopost).toBeDefined();
        expect(SocialAgent.functions!.dispatch_community_webhook).toBeDefined();
    });
});
