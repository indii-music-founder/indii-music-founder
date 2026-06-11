import { describe, expect, it, vi } from 'vitest';
import { releaseHarnessService } from './ReleaseHarnessService';
import type { AudioIntelligenceProfile } from '@/services/audio/types';
import type { UserProfile } from '@/types/User';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(async () => ({ docs: [] })),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({ db: {} }));
vi.mock('@/services/audio/AudioIntelligenceService', () => ({
  audioIntelligence: {
    analyze: vi.fn(),
  },
}));

const audioProfile: AudioIntelligenceProfile = {
  id: 'track-hash',
  analyzedAt: Date.now(),
  modelVersion: 'test',
  technical: {
    bpm: 128,
    key: 'Am',
    scale: 'minor',
    energy: 0.9,
    duration: 180,
    danceability: 0.86,
    loudness: -8,
  },
  semantic: {
    mood: ['Energetic', 'Dark'],
    genre: ['Electronic', 'House'],
    instruments: ['Synth'],
    ddexGenre: 'Electronic',
    ddexSubGenre: 'House',
    language: 'eng',
    isExplicit: false,
    marketingComment: 'A high-energy club record.',
    timbre: { texture: 'Glossy', brightness: 'Bright', saturation: 'Punchy', spaceDepth: 'Wide' },
    productionValue: { era: 'Modern', quality: 'Independent Pro Studio', mixBalance: 'Bass-Forward', aiArtifacts: false },
    visualImagery: { abstract: 'Neon motion', narrative: 'Night drive', lighting: 'Blue strobes' },
    marketingHooks: { keywords: ['club'], oneLiner: 'Night-drive house.' },
    targetPrompts: { image: 'neon cover', veo: 'club motion' },
  },
};

function profile(overrides: Partial<UserProfile>): UserProfile {
  return {
    id: 'user-a',
    uid: 'user-a',
    email: 'a@test.local',
    displayName: 'Artist',
    photoURL: null,
    createdAt: {} as UserProfile['createdAt'],
    updatedAt: {} as UserProfile['updatedAt'],
    lastLoginAt: {} as UserProfile['lastLoginAt'],
    emailVerified: true,
    membership: { tier: 'free', expiresAt: null },
    accountType: 'artist',
    preferences: { theme: 'system', notifications: true },
    ...overrides,
  };
}

describe('ReleaseHarnessService', () => {
  it('compiles song DNA, artist memory, and distribution readiness', async () => {
    const result = await releaseHarnessService.compileReleaseHarness({
      userId: 'user-a',
      audioProfile,
      userProfile: profile({
        goals: ['Grow fanbase'],
        careerStage: 'Emerging',
        brandKit: {
          colors: [],
          fonts: '',
          brandDescription: 'High-energy visual artist',
          negativePrompt: '',
          socials: { tiktok: '@artist', spotify: 'spotify-url' },
          brandAssets: [],
          referenceImages: [],
          releaseDetails: { title: '', type: '', artists: '', genre: '', mood: '', themes: '', lyrics: '' },
        },
      }),
      metadata: {
        trackTitle: 'Night Signal',
        artistName: 'Artist',
        genre: 'Electronic',
        labelName: 'indii.music',
        releaseDate: '2026-06-26',
        territories: ['Worldwide'],
        distributionChannels: ['streaming'],
        dpid: 'PA-DPIDA-TEST',
        isrc: 'USQY12600101',
        upc: '100000000007',
        iswc: 'T-123.456.789-0',
        catalogNumber: 'IND-TEST-2026',
        splits: [{ legalName: 'Artist', role: 'performer', percentage: 100, email: 'a@test.local' }],
      },
      selectedStores: ['spotify'],
    });

    expect(result.releaseDna.genreSignals).toContain('Electronic');
    expect(result.distributionReadiness.ddexPackageReady).toBe(true);
    expect(result.distributionReadiness.identifiers.iswcStatus).toBe('registered');
    expect(result.recommendedStrategy).toBeDefined();
    expect(result.warnings).toContain('Storefront delivery is not authorized by this harness run; this is package/readiness output only.');
  });

  it('produces different recommendations for different artist operating models on the same song', async () => {
    const shortFormArtist = await releaseHarnessService.compileReleaseHarness({
      userId: 'user-a',
      audioProfile,
      userProfile: profile({
        goals: ['Grow fanbase'],
        brandKit: {
          colors: [],
          fonts: '',
          brandDescription: 'Bold disruptive high energy visuals',
          negativePrompt: '',
          socials: { tiktok: '@artist' },
          brandAssets: [],
          referenceImages: [],
          releaseDetails: { title: '', type: '', artists: '', genre: '', mood: '', themes: '', lyrics: '' },
        },
      }),
      metadata: { trackTitle: 'Night Signal', artistName: 'Artist', genre: 'Electronic' },
      releaseIntent: { primaryGoal: 'grow_fanbase' },
    });

    const syncArtist = await releaseHarnessService.compileReleaseHarness({
      userId: 'user-b',
      audioProfile,
      userProfile: profile({
        id: 'user-b',
        uid: 'user-b',
        goals: ['Sync licensing'],
        brandKit: {
          colors: [],
          fonts: '',
          brandDescription: 'Cinematic catalog artist',
          negativePrompt: '',
          socials: { spotify: 'spotify-url' },
          brandAssets: [],
          referenceImages: [],
          releaseDetails: { title: '', type: '', artists: '', genre: '', mood: '', themes: '', lyrics: '' },
        },
      }),
      metadata: { trackTitle: 'Night Signal', artistName: 'Artist', genre: 'Electronic' },
      releaseIntent: { primaryGoal: 'sync' },
    });

    expect(shortFormArtist.recommendedStrategy.id).not.toEqual(syncArtist.recommendedStrategy.id);
  });
});
