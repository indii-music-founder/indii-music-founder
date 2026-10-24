import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SOCIAL_TOOLS } from './tools';
import { AutonomousIntelligence as AI } from '../../services/intelligence/AutonomousIntelligence';
import { SchemaType } from 'firebase/ai';

// Mock AIService
vi.mock('../../services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateStructuredData: vi.fn(),
        generateContent: vi.fn()
    }
}));

describe('SOCIAL_TOOLS', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('grounds copy in artist context instead of a generic product launch', async () => {
        (AI.generateContent as import('vitest').Mock).mockResolvedValue({ response: { text: () => 'My new single is here.' } });
        const result = await SOCIAL_TOOLS.write_social_copy({
            platform: 'Instagram', brief: 'Announce my single', artistName: 'Nia', releaseTitle: 'Night Drive', genre: 'synthpop',
        });
        expect(result).toBe('My new single is here.');
        const prompt = (AI.generateContent as import('vitest').Mock).mock.calls[0][0][0].parts[0].text;
        expect(prompt).toContain('Night Drive');
        expect(prompt).toContain('Nia');
        expect(prompt).not.toContain('New product launch');
        expect(prompt).toContain('Do not invent release dates');
    });

    it('requires a real subject before generating copy', async () => {
        await expect(SOCIAL_TOOLS.write_social_copy({ platform: 'Instagram', brief: '', artworkTitle: 'Artwork' }))
            .rejects.toThrow('Add a post idea');
        expect(AI.generateContent).not.toHaveBeenCalled();
    });

    it('accepts specific Instagram hashtag suggestions and rejects reach bait', async () => {
        (AI.generateStructuredData as import('vitest').Mock).mockResolvedValueOnce({
            hashtags: ['#niamusic', '#nightdrive', '#synthpopartist', '#detroitindie', '#indieelectronic'],
        });
        const context = { platform: 'Instagram', brief: 'Announce my single', artistName: 'Nia', releaseTitle: 'Night Drive' };
        await expect(SOCIAL_TOOLS.suggest_instagram_hashtags(context)).resolves.toEqual([
            'niamusic', 'nightdrive', 'synthpopartist', 'detroitindie', 'indieelectronic',
        ]);
        (AI.generateStructuredData as import('vitest').Mock).mockResolvedValueOnce({
            hashtags: ['#viral', '#music', '#trending', '#explore', '#fyp'],
        });
        await expect(SOCIAL_TOOLS.suggest_instagram_hashtags(context)).rejects.toThrow('specific hashtags');
    });

    it('keeps 3–5 specific tags when the model repeats a suggestion', async () => {
        (AI.generateStructuredData as import('vitest').Mock).mockResolvedValue({
            hashtags: ['#detroitindie', '#synthpopartist', '#studiosessions', '#detroitindie', '#indiielectronic'],
        });
        await expect(SOCIAL_TOOLS.suggest_instagram_hashtags({ platform: 'Instagram', brief: 'Detroit synthpop studio photo' }))
            .resolves.toEqual(['detroitindie', 'synthpopartist', 'studiosessions', 'indiielectronic']);
    });

    describe('generate_social_identity', () => {
        it('should call AI.generateStructuredData with correct parameters', async () => {
            const mockResponse = {
                handles: ['@test1', '@test2'],
                bios: ['Bio 1', 'Bio 2']
            };

            (AI.generateStructuredData as import("vitest").Mock).mockResolvedValue(mockResponse);

            const args = {
                brand_name: 'TestBrand',
                platform: 'Twitter',
                industry: 'Tech'
            };

            const result = await SOCIAL_TOOLS.generate_social_identity(args);

            expect(AI.generateStructuredData).toHaveBeenCalledWith(
                expect.stringContaining('TestBrand'),
                expect.objectContaining({
                    type: SchemaType.OBJECT,
                    required: ['handles', 'bios']
                }),
                undefined,
                undefined
            );

            expect(result).toEqual(mockResponse);
        });

        it('should throw error if Autonomous fails', async () => {
            (AI.generateStructuredData as import("vitest").Mock).mockRejectedValue(new Error('AI Error'));

            const args = {
                brand_name: 'TestBrand',
                platform: 'Twitter',
                industry: 'Tech'
            };

            await expect(SOCIAL_TOOLS.generate_social_identity(args)).rejects.toThrow('AI Error');
        });
    });
});
