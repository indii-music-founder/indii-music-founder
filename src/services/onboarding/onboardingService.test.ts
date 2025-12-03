
import { calculateProfileStatus } from './onboardingService';
import type { UserProfile } from '../../modules/workflow/types';

describe('onboardingService', () => {
    describe('calculateProfileStatus', () => {
        it('should return 0% progress for an empty profile', () => {
            const emptyProfile: UserProfile = {
                bio: '',
                preferences: '',
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

            const { coreProgress, releaseProgress } = calculateProfileStatus(emptyProfile);
            expect(coreProgress).toBe(0);
            expect(releaseProgress).toBe(0);
        });

        it('should calculate core progress correctly', () => {
            const partialProfile: UserProfile = {
                bio: 'This is a long enough bio to count.',
                preferences: '',
                brandKit: {
                    colors: [],
                    fonts: '',
                    brandDescription: 'A cool brand',
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

            const { coreProgress, coreMissing } = calculateProfileStatus(partialProfile);
            // Bio (1) + Brand Description (1) = 2/6 = 33%
            expect(coreProgress).toBe(33);
            expect(coreMissing).toContain('socials');
            expect(coreMissing).toContain('visuals');
        });

        it('should calculate release progress correctly', () => {
            const releaseProfile: UserProfile = {
                bio: '',
                preferences: '',
                brandKit: {
                    colors: [],
                    fonts: '',
                    brandDescription: '',
                    negativePrompt: '',
                    socials: {},
                    brandAssets: [],
                    referenceImages: [],
                    releaseDetails: {
                        title: 'New Song',
                        type: 'Single',
                        artists: '',
                        genre: '',
                        mood: 'Happy',
                        themes: '', // Missing themes
                        lyrics: ''
                    }
                },
                analyzedTrackIds: [],
                knowledgeBase: [],
                savedWorkflows: []
            };

            const { releaseProgress, releaseMissing } = calculateProfileStatus(releaseProfile);
            // Title (1) + Type (1) + Mood (1) = 3/4 = 75%
            expect(releaseProgress).toBe(75);
            expect(releaseMissing).toContain('themes');
        });

        it('should return 100% when all fields are present', () => {
            const fullProfile: UserProfile = {
                bio: 'This is a complete bio for the artist.',
                preferences: '',
                careerStage: 'Professional',
                goals: ['Touring'],
                brandKit: {
                    colors: ['#000000'],
                    fonts: 'Arial',
                    brandDescription: 'Complete brand',
                    negativePrompt: '',
                    socials: { twitter: '@artist' },
                    brandAssets: [{ url: 'http://example.com/img.png', description: 'logo' }],
                    referenceImages: [],
                    releaseDetails: {
                        title: 'Hit Song',
                        type: 'Single',
                        artists: 'Me',
                        genre: 'Pop',
                        mood: 'Energetic',
                        themes: 'Love',
                        lyrics: ''
                    }
                },
                analyzedTrackIds: [],
                knowledgeBase: [],
                savedWorkflows: []
            };

            const { coreProgress, releaseProgress } = calculateProfileStatus(fullProfile);
            expect(coreProgress).toBe(100);
            expect(releaseProgress).toBe(100);
        });

        it('should identify missing career stage and goals', () => {
            const partialProfile: UserProfile = {
                bio: 'This is a complete bio for the artist.',
                preferences: '',
                brandKit: {
                    colors: ['#000000'],
                    fonts: 'Arial',
                    brandDescription: 'Complete brand',
                    negativePrompt: '',
                    socials: { twitter: '@artist' },
                    brandAssets: [{ url: 'http://example.com/img.png', description: 'logo' }],
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

            const { coreMissing } = calculateProfileStatus(partialProfile);
            expect(coreMissing).toContain('careerStage');
            expect(coreMissing).toContain('goals');
        });
    });
});
