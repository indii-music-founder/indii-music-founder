import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicistAgent } from './PublicistAgent';
import { PublicistService } from '../../publicist/PublicistService';

vi.mock('../../publicist/PublicistService', () => ({
    PublicistService: {
        addCampaign: vi.fn(),
        subscribeToCampaigns: vi.fn(),
        subscribeToContacts: vi.fn()
    }
}));

// Mock FirebaseAI
vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateText: vi.fn().mockResolvedValue('Mocked AI Content Response')
    }
}));

vi.mock('@agents/publicist/prompt.md?raw', () => ({
    default: 'Mock System Prompt'
}));

describe('PublicistAgent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('create_campaign', () => {
        it('should call PublicistService.addCampaign with correct parameters', async () => {
            const args = {
                userId: 'user-123',
                title: 'New Album Launch',
                artist: 'The Band',
                type: 'Album' as const,
                focus: 'Global Reach'
            };
            type ResultType = { success: boolean; data: { status?: string } };
            const result = await (PublicistAgent.functions!.create_campaign as (args: unknown) => Promise<ResultType>)(args);

            expect(PublicistService.addCampaign).toHaveBeenCalledWith('user-123', expect.objectContaining({
                title: 'New Album Launch',
                artist: 'The Band',
                type: 'Album',
                status: 'Draft',
                progress: 0,
                openRate: 0
            }));

            expect(result.success).toBe(true);
            expect(result.data.status).toBe('Draft');
        });

        it('should handle errors gracefully', async () => {
            vi.mocked(PublicistService.addCampaign).mockRejectedValue(new Error('Database error'));

            const args = {
                userId: 'user-123',
                title: 'Error Campaign',
                artist: 'The Band',
                type: 'Single' as const,
                focus: 'Test'
            };
            type ResultType = { success: boolean; data: { status?: string } };
            const result = await (PublicistAgent.functions!.create_campaign as (args: unknown) => Promise<ResultType>)(args);

        });
    });

    describe('write_press_release', () => {
        it('should generate a press release using firebaseAI', async () => {
            const args = {
                company_name: 'Test Corp',
                headline: 'Big News',
                key_points: ['Point 1', 'Point 2'],
                tone: 'Professional' as const
            };
            type ResultType = { success: boolean; data: { generated_content?: string } };
            const result = await (PublicistAgent.functions!.write_press_release as (args: unknown) => Promise<ResultType>)(args);

            expect(result.success).toBe(true);
            expect(result.data.generated_content).toBe('Mocked AI Content Response');
        });
    });

    describe('generate_crisis_response', () => {
        it('should generate a crisis response using firebaseAI', async () => {
            const args = {
                incident_summary: 'Server outage',
                severity: 'High' as const,
                audience: 'Customers'
            };
            type ResultType = { success: boolean; data: { draft_response?: string } };
            const result = await (PublicistAgent.functions!.generate_crisis_response as (args: unknown) => Promise<ResultType>)(args);

            expect(result.success).toBe(true);
            expect(result.data.draft_response).toBe('Mocked AI Content Response');
        });
    });

    describe('generate_social_post', () => {
        it('should generate a social post using firebaseAI', async () => {
            const args = {
                platform: 'Twitter' as const,
                topic: 'New Feature',
                tone: 'Excited' as const
            };
            type ResultType = { success: boolean; data: { post_text?: string } };
            const result = await (PublicistAgent.functions!.generate_social_post as (args: unknown) => Promise<ResultType>)(args);

            expect(result.success).toBe(true);
            expect(result.data.post_text).toBe('Mocked AI Content Response');
        });
    });
});
