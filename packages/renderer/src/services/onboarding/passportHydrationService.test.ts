import { describe, it, expect } from 'vitest';
import { mapAssessmentToProfile, hydrateProfileWithAssessment } from './passportHydrationService';
import type { UserProfile } from '@/types/User';
import type { ProspectAssessment } from '@indii/shared';

const createBaseProfile = (): UserProfile => ({
  id: 'user-123',
  uid: 'user-123',
  email: 'artist@example.com',
  displayName: 'Luna',
  photoURL: null,
  createdAt: {} as unknown as UserProfile['createdAt'],
  updatedAt: {} as unknown as UserProfile['updatedAt'],
  lastLoginAt: {} as unknown as UserProfile['lastLoginAt'],
  emailVerified: true,
  membership: { tier: 'free', expiresAt: null },
  accountType: 'artist',
  bio: '',
  careerStage: '',
  goals: [],
  preferences: {
    theme: 'dark',
    notifications: true,
    observabilityEnabled: false,
    showCognitiveLogicByDefault: false,
    agentAmbition: 'balanced',
    ideaAcceptanceCount: 0,
    lastAmbitionPromptTime: 0,
  },
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
      lyrics: '',
    },
  },
  analyzedTrackIds: [],
  knowledgeBase: [],
  savedWorkflows: [],
});

describe('passportHydrationService', () => {
  it('maps careerStage, genre, distributor, PRO, and goals to blank UserProfile', () => {
    const profile = createBaseProfile();
    const assessment: Partial<ProspectAssessment> = {
      careerStage: 'Building momentum',
      genre: 'Electronic / Dance',
      proAffiliation: 'BMI',
      distributor: 'DistroKid',
      goals: ['clean_distribution', 'grow_audience'],
    };

    const hydrated = mapAssessmentToProfile(profile, assessment);

    expect(hydrated.careerStage).toBe('Building momentum');
    expect(hydrated.goals).toEqual(['clean_distribution', 'grow_audience']);
    expect(hydrated.brandKit.releaseDetails.genre).toBe('Electronic / Dance');
    expect(hydrated.brandKit.socials.distributor).toBe('DistroKid');
    expect(hydrated.brandKit.socials.pro).toBe('BMI');
  });

  it('is idempotent and preserves existing non-empty profile values', () => {
    const profile = createBaseProfile();
    profile.careerStage = 'Established artist';
    profile.brandKit.releaseDetails.genre = 'Hip-Hop / Rap';
    profile.goals = ['custom_goal'];

    const assessment: Partial<ProspectAssessment> = {
      careerStage: 'Just starting out',
      genre: 'Pop',
      goals: ['clean_distribution'],
    };

    const hydrated = mapAssessmentToProfile(profile, assessment);

    expect(hydrated.careerStage).toBe('Established artist');
    expect(hydrated.brandKit.releaseDetails.genre).toBe('Hip-Hop / Rap');
    expect(hydrated.goals).toEqual(['custom_goal']);
  });

  it('skips network fetch when profile already has careerStage and genre', async () => {
    const profile = createBaseProfile();
    profile.careerStage = 'Building momentum';
    profile.brandKit.releaseDetails.genre = 'R&B / Soul';

    const result = await hydrateProfileWithAssessment(profile, 'some-id');
    expect(result).toBe(profile);
  });
});
