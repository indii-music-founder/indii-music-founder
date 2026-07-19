
import { calculateProfileStatus, processFunctionCalls, externalizeOnboardingBrandAssets, runOnboardingConversation, OnboardingTools, determinePhase } from './onboardingService';
import type { UserProfile, ConversationFile } from '../../modules/workflow/types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AutonomousIntelligence as AI } from '../intelligence/AutonomousIntelligence';

// Mock Intelligence Service
vi.mock('../intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateContent: vi.fn()
    },
    AI: {
        generateContent: vi.fn()
    }
}));

const { mockUploadFile } = vi.hoisted(() => ({ mockUploadFile: vi.fn() }));
vi.mock('@/services/StorageService', () => ({
    StorageService: { uploadFile: mockUploadFile },
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
                createdAt: { seconds: 0, nanoseconds: 0 } as unknown as import('firebase/firestore').Timestamp,
                updatedAt: { seconds: 0, nanoseconds: 0 } as unknown as import('firebase/firestore').Timestamp,
                lastLoginAt: { seconds: 0, nanoseconds: 0 } as unknown as import('firebase/firestore').Timestamp,
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
            createdAt: { seconds: 0, nanoseconds: 0 } as unknown as import('firebase/firestore').Timestamp,
            updatedAt: { seconds: 0, nanoseconds: 0 } as unknown as import('firebase/firestore').Timestamp,
            lastLoginAt: { seconds: 0, nanoseconds: 0 } as unknown as import('firebase/firestore').Timestamp,
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
            createdAt: { seconds: 0, nanoseconds: 0 } as unknown as import('firebase/firestore').Timestamp,
            updatedAt: { seconds: 0, nanoseconds: 0 } as unknown as import('firebase/firestore').Timestamp,
            lastLoginAt: { seconds: 0, nanoseconds: 0 } as unknown as import('firebase/firestore').Timestamp,
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
            expect(updatedProfile!.brandKit!.brandAssets[0]!.description).toBe('Main Logo');
            expect(updates).toContain('Brand Asset');
        });

        it('ISSUE-956: preserves the real image MIME type instead of hardcoding image/png', () => {
            const files: ConversationFile[] = [{
                id: '1',
                type: 'image',
                file: { name: 'photo.jpg', type: 'image/jpeg', size: 1024 } as File,
                preview: 'data:image...',
                base64: 'base64data'
            }];

            const calls = [{
                name: OnboardingTools.AddImageAsset,
                args: { file_name: 'photo.jpg', asset_type: 'brand_asset', description: 'Headshot' }
            }];

            const { updatedProfile } = processFunctionCalls(calls, baseProfile, files);
            expect(updatedProfile.brandKit!.brandAssets[0]!.url).toBe('data:image/jpeg;base64,base64data');
        });

        it('ISSUE-956: externalizes a new profile image and removes it if upload fails', async () => {
            const file = {
                id: '1', type: 'image',
                file: { name: 'photo.jpg', type: 'image/jpeg', size: 1024 } as File,
                preview: 'data:image...', base64: 'base64data',
            } as ConversationFile;
            const withEmbeddedAsset: UserProfile = {
                ...baseProfile,
                brandKit: {
                    ...baseProfile.brandKit!,
                    brandAssets: [{ url: 'data:image/jpeg;base64,base64data', description: 'Headshot' }],
                    referenceImages: [],
                },
            };
            mockUploadFile.mockResolvedValueOnce('https://storage.example.com/brand/photo.jpg');
            await expect(externalizeOnboardingBrandAssets(withEmbeddedAsset, [file])).resolves.toEqual(expect.objectContaining({
                profile: expect.objectContaining({
                    brandKit: expect.objectContaining({
                        brandAssets: [expect.objectContaining({ url: 'https://storage.example.com/brand/photo.jpg' })],
                    }),
                }),
                warnings: [],
            }));

            mockUploadFile.mockRejectedValueOnce(new Error('offline'));
            const failed = await externalizeOnboardingBrandAssets(withEmbeddedAsset, [file]);
            expect(failed.profile.brandKit!.brandAssets).toEqual([]);
            expect(failed.warnings).toHaveLength(1);
        });

        it('ISSUE-956: rejects an oversized image instead of embedding it in the profile', () => {
            const files: ConversationFile[] = [{
                id: '1',
                type: 'image',
                file: { name: 'huge.png', type: 'image/png', size: 6 * 1024 * 1024 } as File,
                preview: 'data:image...',
                base64: 'base64data'
            }];

            const calls = [{
                name: OnboardingTools.AddImageAsset,
                args: { file_name: 'huge.png', asset_type: 'brand_asset', description: 'Too big' }
            }];

            const { updatedProfile, updates, warnings } = processFunctionCalls(calls, baseProfile, files);
            expect(updatedProfile.brandKit!.brandAssets).toHaveLength(0);
            expect(updates).not.toContain('Brand Asset');
            expect(warnings.some(w => w.includes('huge.png'))).toBe(true);
        });

        it('ISSUE-956: rejects a new image once the profile already holds the max brand images', () => {
            const manyAssets = Array.from({ length: 20 }, (_, i) => ({ url: `data:image/png;base64,x${i}`, description: `asset ${i}` }));
            const profileAtLimit: UserProfile = {
                ...baseProfile,
                brandKit: { ...baseProfile.brandKit!, brandAssets: manyAssets, referenceImages: [] }
            };
            const files: ConversationFile[] = [{
                id: '1',
                type: 'image',
                file: { name: 'one-more.png', type: 'image/png', size: 1024 } as File,
                preview: 'data:image...',
                base64: 'base64data'
            }];

            const calls = [{
                name: OnboardingTools.AddImageAsset,
                args: { file_name: 'one-more.png', asset_type: 'brand_asset', description: 'One more' }
            }];

            const { updatedProfile, warnings } = processFunctionCalls(calls, profileAtLimit, files);
            expect(updatedProfile.brandKit!.brandAssets).toHaveLength(20);
            expect(warnings.some(w => w.includes('maximum'))).toBe(true);
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

        it('should call Intelligence service and return text and tools', async () => {
            const mockResponse = {
                response: {
                    text: () => 'Hello',
                    functionCalls: () => {
                        const parts = mockResponse.response.candidates[0]!.content.parts;
                        return parts
                            .filter((p: import('@google/genai').Part) => 'functionCall' in p)
                            .map((p: import('@google/genai').Part) => p.functionCall);
                    },
                    candidates: [{
                        content: {
                            parts: [
                                { text: 'Hello' },
                                { functionCall: { name: 'updateProfile', args: { bio: 'Hi' } } }
                            ]
                        }
                    }]
                }
            };
            vi.mocked(AI.generateContent).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof AI.generateContent>>);

            const result = await runOnboardingConversation(
                [{ role: 'user', parts: [{ text: 'hi' }] }],
                {} as unknown as UserProfile,
                'onboarding'
            );

            expect(AI.generateContent).toHaveBeenCalled();
            expect(result.text).toBe('Hello');
            expect(result.functionCalls).toHaveLength(1);
            expect(result!.functionCalls![0]!.name).toBe('updateProfile');
        });

        it('ISSUE-955: attaches audio files as real inlineData instead of dropping them', async () => {
            vi.mocked(AI.generateContent).mockResolvedValue({
                response: {
                    text: () => 'Got it',
                    functionCalls: () => [],
                    candidates: [{ content: { parts: [{ text: 'Got it' }] } }]
                }
            } as unknown as Awaited<ReturnType<typeof AI.generateContent>>);

            const audioFile: ConversationFile = {
                id: '1',
                type: 'audio',
                file: { name: 'demo.mp3', type: 'audio/mpeg' } as File,
                preview: '',
                base64: 'ZmFrZS1hdWRpby1ieXRlcw==',
            };

            await runOnboardingConversation(
                [{ role: 'user', parts: [{ text: 'Here is a demo of my track' }] }],
                {} as unknown as UserProfile,
                'onboarding',
                [audioFile]
            );

            const [sentContents] = vi.mocked(AI.generateContent).mock.calls[0]!;
            const lastMessageParts = (sentContents as any[])[sentContents.length - 1].parts;
            const inlineAudioPart = lastMessageParts.find((p: any) => p.inlineData);

            expect(inlineAudioPart).toBeDefined();
            expect(inlineAudioPart.inlineData.mimeType).toBe('audio/mpeg');
            expect(inlineAudioPart.inlineData.data).toBe('ZmFrZS1hdWRpby1ieXRlcw==');
        });
    });
});
