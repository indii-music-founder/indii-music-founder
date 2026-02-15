
import { calculateProfileStatus, processFunctionCalls, runOnboardingConversation, OnboardingTools, determinePhase } from './onboardingService';
import type { UserProfile, ConversationFile } from '../../modules/workflow/types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AI } from '../ai/AIService';

// Mock AI Service
vi.mock('../ai/AIService', () => ({
    AI: {
        generateContent: vi.fn()
    }
}));

describe('onboardingService', () => {
    describe('calculateProfileStatus', () => {
        it('should return 0% progress for an empty profile', () => {
            const emptyProfile: UserProfile = {
                id: 'test-user',
                bio: '',
                uid: 'test-uid',
                email: 'test@example.com',
                displayName: 'Test User',
                photoURL: null,
                createdAt: { seconds: 0, nanoseconds: 0 } as any,
                updatedAt: { seconds: 0, nanoseconds: 0 } as any,
                lastLoginAt: { seconds: 0, nanoseconds: 0 } as any,
                emailVerified: true,
                membership: { tier: 'free', expiresAt: null },
                accountType: 'artist',
                preferences: { theme: 'dark', notifications: true },
                brandKit: {
                    colors: [],
                    fonts: '',
                    brandDescription: '',
                    negativePrompt: '',
                    socials: {},
                    brandAssets: [],
                    referenceImages: [],
                    releaseDetails: {
                        title: '',
                        type: '',
                        artists: '',
                        genre: '',
                        mood: '',
                        themes: '',
                        lyrics: ''
                    }
                },
                analyzedTrackIds: [],
                knowledgeBase: [],
                savedWorkflows: []
            };

            const { coreProgress, releaseProgress, coreMissing } = calculateProfileStatus(emptyProfile);
            expect(coreProgress).toBe(0);
            expect(releaseProgress).toBe(0);
            expect(coreMissing).toContain('distributor');
        });

    });

    describe('determinePhase', () => {
        const baseProfile: UserProfile = {
            id: 'test-user',
            uid: 'test-uid',
            email: 'test@example.com',
            displayName: 'Test User',
            photoURL: null,
            createdAt: { seconds: 0, nanoseconds: 0 } as any,
            updatedAt: { seconds: 0, nanoseconds: 0 } as any,
            lastLoginAt: { seconds: 0, nanoseconds: 0 } as any,
            emailVerified: true,
            membership: { tier: 'free', expiresAt: null },
            accountType: 'artist',
            bio: 'This is a long enough bio for testing.',
            careerStage: 'Emerging',
            goals: ['Touring'],
            brandKit: {
                colors: ['#000'],
                fonts: 'Inter',
                brandDescription: 'Dark and moody',
                socials: { instagram: '@test' },
                brandAssets: [{ url: 'test', description: 'test' }],
                referenceImages: [],
                releaseDetails: { title: '', type: '', artists: '', genre: '', mood: '', themes: '', lyrics: '' },
                negativePrompt: ''
            },
            analyzedTrackIds: [],
            knowledgeBase: [],
            savedWorkflows: [],
            preferences: { theme: 'dark', notifications: true }
        };

        it('should return identity_core if distributor is missing', () => {
            const profile = { ...baseProfile, brandKit: { ...baseProfile.brandKit!, socials: { instagram: '@test' } } };
            const phase = determinePhase(profile);
            expect(phase).toBe('identity_core');
        });

        it('should return identity_branding if distributor is provided but branding is missing', () => {
            const profile = {
                ...baseProfile,
                brandKit: {
                    ...baseProfile.brandKit!,
                    socials: { ...baseProfile.brandKit!.socials, distributor: 'DistroKid' },
                    colors: [],
                    fonts: '',
                    brandDescription: ''
                }
            };
            const phase = determinePhase(profile);
            expect(phase).toBe('identity_branding');
        });
    });

    describe('processFunctionCalls', () => {
        const baseProfile: UserProfile = {
            id: 'test-user',
            uid: 'test-uid',
            email: 'test@example.com',
            displayName: 'Test User',
            photoURL: null,
            createdAt: { seconds: 0, nanoseconds: 0 } as any,
            updatedAt: { seconds: 0, nanoseconds: 0 } as any,
            lastLoginAt: { seconds: 0, nanoseconds: 0 } as any,
            emailVerified: true,
            membership: { tier: 'free', expiresAt: null },
            accountType: 'artist',
            bio: '',
            preferences: { theme: 'dark', notifications: true },
            brandKit: {
                colors: [],
                fonts: '',
                brandDescription: '',
                negativePrompt: '',
                socials: {},
                brandAssets: [],
                referenceImages: [],
                releaseDetails: {
                    title: '',
                    type: '',
                    artists: '',
                    genre: '',
                    mood: '',
                    themes: '',
                    lyrics: ''
                }
            },
            analyzedTrackIds: [],
            knowledgeBase: [],
            savedWorkflows: []
        };

        it('should update identity fields', () => {
            const calls = [{
                name: OnboardingTools.UpdateProfile,
                args: {
                    bio: 'New Bio',
                    creative_preferences: 'New Prefs',
                    career_stage: 'Emerging',
                    goals: ['Touring']
                }
            }];

            const { updatedProfile, updates } = processFunctionCalls(calls, baseProfile, []);
            expect(updatedProfile.bio).toBe('New Bio');
            expect(updatedProfile.creativePreferences).toBe('New Prefs');
            expect(updatedProfile.careerStage).toBe('Emerging');
            expect(updatedProfile.goals).toEqual(['Touring']);
            expect(updates).toContain('Bio');
            expect(updates).toContain('Goals');
        });

        it('should update release details', () => {
            const calls = [{
                name: OnboardingTools.UpdateProfile,
                args: {
                    release_title: 'My Song',
                    release_type: 'Single',
                    release_mood: 'Sad'
                }
            }];

            const { updatedProfile, updates } = processFunctionCalls(calls, baseProfile, []);
            expect(updatedProfile.brandKit!.releaseDetails?.title).toBe('My Song');
            expect(updatedProfile.brandKit!.releaseDetails?.type).toBe('Single');
            expect(updatedProfile.brandKit!.releaseDetails?.mood).toBe('Sad');
            expect(updates).toContain('Release Details');
        });

        it('should update extended brand kit fields (socials and pro)', () => {
            const calls = [{
                name: OnboardingTools.UpdateProfile,
                args: {
                    social_spotify: 'https://spotify.com/artist/12345',
                    social_soundcloud: 'https://soundcloud.com/artist',
                    pro_affiliation: 'ASCAP',
                    distributor: 'DistroKid'
                }
            }];

            const { updatedProfile, updates } = processFunctionCalls(calls, baseProfile, []);
            expect(updatedProfile.brandKit!.socials.spotify).toBe('https://spotify.com/artist/12345');
            expect(updatedProfile.brandKit!.socials.soundcloud).toBe('https://soundcloud.com/artist');
            expect(updatedProfile.brandKit!.socials.pro).toBe('ASCAP');
            expect(updatedProfile.brandKit!.socials.distributor).toBe('DistroKid');
            expect(updates).toContain('Socials & Pro Details');
        });

        it('should add image assets', () => {
            const files: ConversationFile[] = [{
                id: '1',
                type: 'image',
                file: { name: 'logo.png', type: 'image/png' } as File,
                preview: 'data:image...',
                base64: 'base64data'
            }];

            const calls = [{
                name: OnboardingTools.AddImageAsset,
                args: {
                    file_name: 'logo.png',
                    asset_type: 'brand_asset',
                    description: 'Main Logo'
                }
            }];

            const { updatedProfile, updates } = processFunctionCalls(calls, baseProfile, files);
            expect(updatedProfile.brandKit!.brandAssets).toHaveLength(1);
            expect(updatedProfile.brandKit!.brandAssets[0].description).toBe('Main Logo');
            expect(updates).toContain('Brand Asset');
        });

        it('should finish onboarding', () => {
            const calls = [{
                name: OnboardingTools.FinishOnboarding,
                args: { confirmation_message: 'Done!' }
            }];

            const { isFinished } = processFunctionCalls(calls, baseProfile, []);
            expect(isFinished).toBe(true);
        });
    });

    describe('runOnboardingConversation', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('should call AI service and return text and tools', async () => {
            const mockResponse = {
                text: () => 'Hello',
                functionCalls: () => [{ name: 'updateProfile', args: { bio: 'Hi' } }]
            };
            (AI.generateContent as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

            const result = await runOnboardingConversation(
                [{ role: 'user', parts: [{ text: 'hi' }] }],
                {} as UserProfile,
                'onboarding'
            );

            expect(AI.generateContent).toHaveBeenCalled();
            expect(result.text).toBe('Hello');
            expect(result.functionCalls).toHaveLength(1);
            expect(result.functionCalls![0].name).toBe('updateProfile');
        });
    });
});
