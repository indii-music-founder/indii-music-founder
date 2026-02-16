import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CampaignAI, CampaignAIService } from './CampaignAIService';
import { AI } from '../ai/AIService';
import { CampaignStatus, Platform } from '@/modules/marketing/types';

// Mock AIService
vi.mock('../ai/AIService', () => ({
    AI: {
        generateStructuredData: vi.fn(),
        generateImage: vi.fn(),
        generateText: vi.fn()
    }
}));

// Mock store
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            userProfile: {
                displayName: 'Test Artist',
                brandKit: {
                    brandDescription: 'An indie pop artist pushing boundaries',
                    aestheticStyle: 'Modern minimalist',
                    colors: ['#FF6B6B', '#4ECDC4', '#2C3E50'],
                    negativePrompt: 'blurry, low quality',
                    releaseDetails: {
                        title: 'Midnight Dreams',
                        type: 'Album',
                        mood: 'Dreamy',
                        themes: 'Love, loss, hope',
                        genre: 'Indie Pop'
                    }
                }
            }
        })
    }
}));

describe('CampaignAIService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('singleton export', () => {
        it('should export a singleton instance', () => {
            expect(CampaignAI).toBeInstanceOf(CampaignAIService);
        });
    });

    describe('generateCampaign', () => {
        const mockCampaignPlan = {
            title: 'Midnight Dreams Launch Campaign',
            description: 'A 7-day multi-platform campaign to promote the new album',
            posts: [
                {
                    platform: 'Instagram' as Platform,
                    day: 1,
                    copy: 'Something big is coming... 🌙',
                    imagePrompt: 'Mysterious moonlit scene with silhouette',
                    hashtags: ['#NewMusic', '#IndiePop', '#MidnightDreams'],
                    bestTimeToPost: '7:00 PM EST'
                },
                {
                    platform: 'Twitter' as Platform,
                    day: 1,
                    copy: 'The wait is almost over. Midnight Dreams drops in 7 days.',
                    imagePrompt: 'Album artwork teaser',
                    hashtags: ['#NewAlbum', '#IndiePop']
                }
            ]
        };

        it('should generate a campaign plan from a brief', async () => {
            (AI.generateStructuredData as ReturnType<typeof vi.fn>).mockResolvedValue(mockCampaignPlan);

            const brief = {
                topic: 'New album release: Midnight Dreams',
                objective: 'launch' as const,
                platforms: ['Instagram' as Platform, 'Twitter' as Platform],
                durationDays: 7,
                postsPerDay: 2,
                tone: 'inspirational' as const
            };

            const result = await CampaignAI.generateCampaign(brief);

            expect(result.title).toBe('Midnight Dreams Launch Campaign');
            expect(result.posts).toHaveLength(2);
            expect(AI.generateStructuredData).toHaveBeenCalledTimes(1);
        });

        it('should inject brand context into the prompt', async () => {
            (AI.generateStructuredData as ReturnType<typeof vi.fn>).mockResolvedValue(mockCampaignPlan);

            const brief = {
                topic: 'Album promo',
                objective: 'awareness' as const,
                platforms: ['Instagram' as Platform],
                durationDays: 3,
                postsPerDay: 1,
                tone: 'casual' as const
            };

            await CampaignAI.generateCampaign(brief);

            const callArgs = (AI.generateStructuredData as ReturnType<typeof vi.fn>).mock.calls[0][0];
            expect(callArgs).toContain('Test Artist');
            expect(callArgs).toContain('indie pop artist');
            expect(callArgs).toContain('Midnight Dreams');
        });

        it('should handle missing fields in response gracefully', async () => {
            (AI.generateStructuredData as ReturnType<typeof vi.fn>).mockResolvedValue({
                title: '',
                posts: null
            });

            const brief = {
                topic: 'Test',
                objective: 'engagement' as const,
                platforms: ['Twitter' as Platform],
                durationDays: 1,
                postsPerDay: 1,
                tone: 'professional' as const
            };

            const result = await CampaignAI.generateCampaign(brief);

            expect(result.title).toBe('Test Campaign');
            expect(result.posts).toEqual([]);
        });

        it('should throw user-friendly error on failure', async () => {
            (AI.generateStructuredData as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API Error'));

            const brief = {
                topic: 'Test',
                objective: 'launch' as const,
                platforms: ['Instagram' as Platform],
                durationDays: 1,
                postsPerDay: 1,
                tone: 'casual' as const
            };

            await expect(CampaignAI.generateCampaign(brief)).rejects.toThrow('Failed to generate campaign');
        });
    });

    describe('planToCampaignAsset', () => {
        it('should convert a plan to CampaignAsset format', () => {
            const plan = {
                title: 'Test Campaign',
                description: 'A test campaign',
                posts: [
                    {
                        platform: 'Instagram' as Platform,
                        day: 1,
                        copy: 'Test post',
                        imagePrompt: 'Test image',
                        hashtags: ['#test']
                    },
                    {
                        platform: 'Twitter' as Platform,
                        day: 2,
                        copy: 'Test tweet',
                        imagePrompt: 'Tweet image',
                        hashtags: ['#tweet']
                    }
                ]
            };

            const result = CampaignAI.planToCampaignAsset(plan, '2024-01-15');

            expect(result.title).toBe('Test Campaign');
            expect(result.startDate).toBe('2024-01-15');
            expect(result.durationDays).toBe(2);
            expect(result.posts).toHaveLength(2);
            expect(result.posts[0].copy).toContain('#test');
            expect(result.posts[0].imageAsset.caption).toBe('Test image');
            expect(result.status).toBe(CampaignStatus.PENDING);
        });
    });

    describe('enhancePostCopy', () => {
        const mockEnhancement = {
            enhancedCopy: 'Something magical is brewing... ✨ Stay tuned for a journey under the stars.',
            alternativeVersions: [
                'The night holds secrets. Are you ready to discover them?',
                'When the clock strikes midnight, everything changes. 🌙'
            ],
            suggestedHashtags: ['#NewMusic', '#IndiePop', '#MidnightVibes', '#ComingSoon'],
            toneAnalysis: 'Mysterious and intriguing, creating anticipation while maintaining brand elegance.'
        };

        it('should enhance post copy with improve mode', async () => {
            (AI.generateStructuredData as ReturnType<typeof vi.fn>).mockResolvedValue(mockEnhancement);

            const post = {
                id: 'post_1',
                platform: 'Instagram' as Platform,
                copy: 'New music coming soon.',
                imageAsset: { assetType: 'image' as const, title: '', imageUrl: '', caption: '' },
                day: 1,
                status: CampaignStatus.PENDING
            };

            const result = await CampaignAI.enhancePostCopy(post, 'improve');

            expect(result.enhancedCopy).toContain('magical');
            expect(result.alternativeVersions).toHaveLength(2);
            expect(result.suggestedHashtags).toContain('#NewMusic');
        });

        it('should include platform context in enhancement prompt', async () => {
            (AI.generateStructuredData as ReturnType<typeof vi.fn>).mockResolvedValue(mockEnhancement);

            const post = {
                id: 'post_1',
                platform: 'Twitter' as Platform,
                copy: 'Test',
                imageAsset: { assetType: 'image' as const, title: '', imageUrl: '', caption: '' },
                day: 1,
                status: CampaignStatus.PENDING
            };

            await CampaignAI.enhancePostCopy(post, 'shorter');

            const callArgs = (AI.generateStructuredData as ReturnType<typeof vi.fn>).mock.calls[0][0];
            expect(callArgs).toContain('Twitter');
            expect(callArgs).toContain('280'); // Twitter character limit
        });

        it('should handle all enhancement types', async () => {
            (AI.generateStructuredData as ReturnType<typeof vi.fn>).mockResolvedValue(mockEnhancement);

            const post = {
                id: 'post_1',
                platform: 'LinkedIn' as Platform,
                copy: 'Test',
                imageAsset: { assetType: 'image' as const, title: '', imageUrl: '', caption: '' },
                day: 1,
                status: CampaignStatus.PENDING
            };

            const types = ['improve', 'shorter', 'longer', 'different_tone'] as const;

            for (const type of types) {
                await CampaignAI.enhancePostCopy(post, type);
            }

            expect(AI.generateStructuredData).toHaveBeenCalledTimes(4);
        });
    });

    describe('generatePostImages', () => {
        it('should generate images for posts without images', async () => {
            (AI.generateImage as ReturnType<typeof vi.fn>).mockResolvedValue('base64ImageData');
            (AI.generateText as ReturnType<typeof vi.fn>).mockResolvedValue('Generated image prompt');

            const posts = [
                {
                    id: 'post_1',
                    platform: 'Instagram' as Platform,
                    copy: 'Test post',
                    imageAsset: { assetType: 'image' as const, title: '', imageUrl: '', caption: 'Test prompt' },
                    day: 1,
                    status: CampaignStatus.PENDING
                },
                {
                    id: 'post_2',
                    platform: 'Twitter' as Platform,
                    copy: 'Test tweet',
                    imageAsset: { assetType: 'image' as const, title: '', imageUrl: '', caption: '' },
                    day: 2,
                    status: CampaignStatus.PENDING
                }
            ];

            const result = await CampaignAI.generatePostImages(posts);

            expect(AI.generateImage).toHaveBeenCalledTimes(2);
            expect(result[0].imageAsset.imageUrl).toContain('base64');
            expect(result[1].imageAsset.imageUrl).toContain('base64');
        });

        it('should skip posts that already have images', async () => {
            const posts = [
                {
                    id: 'post_1',
                    platform: 'Instagram' as Platform,
                    copy: 'Test',
                    imageAsset: { assetType: 'image' as const, title: '', imageUrl: 'existing-image.jpg', caption: '' },
                    day: 1,
                    status: CampaignStatus.PENDING
                },
                {
                    id: 'post_2',
                    platform: 'Twitter' as Platform,
                    copy: 'Test',
                    imageAsset: { assetType: 'image' as const, title: '', imageUrl: '', caption: '' },
                    day: 2,
                    status: CampaignStatus.PENDING
                }
            ];

            (AI.generateImage as ReturnType<typeof vi.fn>).mockResolvedValue('newImage');
            (AI.generateText as ReturnType<typeof vi.fn>).mockResolvedValue('prompt');

            await CampaignAI.generatePostImages(posts);

            expect(AI.generateImage).toHaveBeenCalledTimes(1);
        });

        it('should call progress callback during batch processing', async () => {
            (AI.generateImage as ReturnType<typeof vi.fn>).mockResolvedValue('image');
            (AI.generateText as ReturnType<typeof vi.fn>).mockResolvedValue('prompt');

            const posts = [
                {
                    id: 'post_1',
                    platform: 'Instagram' as Platform,
                    copy: 'Test 1',
                    imageAsset: { assetType: 'image' as const, title: '', imageUrl: '', caption: '' },
                    day: 1,
                    status: CampaignStatus.PENDING
                },
                {
                    id: 'post_2',
                    platform: 'Twitter' as Platform,
                    copy: 'Test 2',
                    imageAsset: { assetType: 'image' as const, title: '', imageUrl: '', caption: '' },
                    day: 2,
                    status: CampaignStatus.PENDING
                }
            ];

            const progressCalls: { current: number; total: number; status: string }[] = [];
            await CampaignAI.generatePostImages(posts, (progress) => {
                progressCalls.push(progress);
            });

            expect(progressCalls.length).toBeGreaterThanOrEqual(2);
            expect(progressCalls[0].current).toBe(1);
            expect(progressCalls[0].total).toBe(2);
            expect(progressCalls[progressCalls.length - 1].status).toBe('complete');
        });

        it('should continue processing if one image fails', async () => {
            (AI.generateImage as ReturnType<typeof vi.fn>)
                .mockRejectedValueOnce(new Error('API Error'))
                .mockResolvedValueOnce('successImage');
            (AI.generateText as ReturnType<typeof vi.fn>).mockResolvedValue('prompt');

            const posts = [
                {
                    id: 'post_1',
                    platform: 'Instagram' as Platform,
                    copy: 'Test 1',
                    imageAsset: { assetType: 'image' as const, title: '', imageUrl: '', caption: '' },
                    day: 1,
                    status: CampaignStatus.PENDING
                },
                {
                    id: 'post_2',
                    platform: 'Twitter' as Platform,
                    copy: 'Test 2',
                    imageAsset: { assetType: 'image' as const, title: '', imageUrl: '', caption: '' },
                    day: 2,
                    status: CampaignStatus.PENDING
                }
            ];

            const result = await CampaignAI.generatePostImages(posts);

            expect(result[0].imageAsset.imageUrl).toBe(''); // Failed
            expect(result[1].imageAsset.imageUrl).toContain('base64'); // Succeeded
        });

        it('should return original posts if none need images', async () => {
            const posts = [
                {
                    id: 'post_1',
                    platform: 'Instagram' as Platform,
                    copy: 'Test',
                    imageAsset: { assetType: 'image' as const, title: '', imageUrl: 'existing.jpg', caption: '' },
                    day: 1,
                    status: CampaignStatus.PENDING
                }
            ];

            const result = await CampaignAI.generatePostImages(posts);

            expect(AI.generateImage).not.toHaveBeenCalled();
            expect(result).toEqual(posts);
        });
    });

    describe('generateSingleImage', () => {
        it('should generate a single image for a post', async () => {
            (AI.generateImage as ReturnType<typeof vi.fn>).mockResolvedValue('singleImageBase64');

            const post = {
                id: 'post_1',
                platform: 'Instagram' as Platform,
                copy: 'Test post',
                imageAsset: { assetType: 'image' as const, title: '', imageUrl: '', caption: 'A sunset scene' },
                day: 1,
                status: CampaignStatus.PENDING
            };

            const result = await CampaignAI.generateSingleImage(post);

            expect(result).toContain('base64,singleImageBase64');
            expect(AI.generateImage).toHaveBeenCalledTimes(1);
        });

        it('should return null on failure', async () => {
            (AI.generateImage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed'));

            const post = {
                id: 'post_1',
                platform: 'Instagram' as Platform,
                copy: 'Test',
                imageAsset: { assetType: 'image' as const, title: '', imageUrl: '', caption: '' },
                day: 1,
                status: CampaignStatus.PENDING
            };

            const result = await CampaignAI.generateSingleImage(post);

            expect(result).toBeNull();
        });
    });

    describe('predictEngagement', () => {
        const mockPrediction = {
            overallScore: 78,
            estimatedReach: 15000,
            estimatedEngagementRate: 4.2,
            platformBreakdown: [
                {
                    platform: 'Instagram',
                    predictedLikes: 450,
                    predictedComments: 32,
                    predictedShares: 18,
                    confidence: 'medium' as const
                },
                {
                    platform: 'Twitter',
                    predictedLikes: 120,
                    predictedComments: 15,
                    predictedShares: 25,
                    confidence: 'high' as const
                }
            ],
            recommendations: [
                'Add more visual content to Twitter posts',
                'Consider posting Instagram content during evening hours',
                'Include call-to-action in LinkedIn posts'
            ],
            riskFactors: [
                'Campaign duration might be too short for momentum',
                'Missing TikTok could limit younger audience reach'
            ]
        };

        it('should predict engagement for a campaign', async () => {
            (AI.generateStructuredData as ReturnType<typeof vi.fn>).mockResolvedValue(mockPrediction);

            const campaign = {
                id: 'campaign_1',
                assetType: 'campaign' as const,
                title: 'Test Campaign',
                description: 'A test campaign',
                durationDays: 7,
                startDate: '2024-01-15',
                posts: [
                    {
                        id: 'post_1',
                        platform: 'Instagram' as Platform,
                        copy: 'Test',
                        imageAsset: { assetType: 'image' as const, title: '', imageUrl: 'img.jpg', caption: '' },
                        day: 1,
                        status: CampaignStatus.PENDING
                    }
                ],
                status: CampaignStatus.PENDING
            };

            const result = await CampaignAI.predictEngagement(campaign);

            expect(result.overallScore).toBe(78);
            expect(result.estimatedReach).toBe(15000);
            expect(result.platformBreakdown).toHaveLength(2);
            expect(result.recommendations).toContain('Add more visual content to Twitter posts');
        });

        it('should include campaign details in prompt', async () => {
            (AI.generateStructuredData as ReturnType<typeof vi.fn>).mockResolvedValue(mockPrediction);

            const campaign = {
                id: 'campaign_1',
                assetType: 'campaign' as const,
                title: 'Album Launch',
                description: 'Promoting new album',
                durationDays: 14,
                startDate: '2024-01-15',
                posts: [
                    {
                        id: 'post_1',
                        platform: 'Instagram' as Platform,
                        copy: 'Test',
                        imageAsset: { assetType: 'image' as const, title: '', imageUrl: '', caption: '' },
                        day: 1,
                        status: CampaignStatus.PENDING
                    }
                ],
                status: CampaignStatus.PENDING
            };

            await CampaignAI.predictEngagement(campaign);

            const callArgs = (AI.generateStructuredData as ReturnType<typeof vi.fn>).mock.calls[0][0];
            expect(callArgs).toContain('Album Launch');
            expect(callArgs).toContain('14 days');
        });

        it('should handle missing fields in prediction gracefully', async () => {
            (AI.generateStructuredData as ReturnType<typeof vi.fn>).mockResolvedValue({
                overallScore: null,
                platformBreakdown: null,
                recommendations: undefined
            });

            const campaign = {
                id: 'campaign_1',
                assetType: 'campaign' as const,
                title: 'Test',
                durationDays: 7,
                startDate: '2024-01-15',
                posts: [],
                status: CampaignStatus.PENDING
            };

            const result = await CampaignAI.predictEngagement(campaign);

            expect(result.overallScore).toBe(50); // Default
            expect(result.platformBreakdown).toEqual([]);
            expect(result.recommendations).toEqual([]);
        });
    });
});
