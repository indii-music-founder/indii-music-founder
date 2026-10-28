import { describe, expect, it } from 'vitest';
import {
  DSP_REPORTED_METRICS,
  evaluateDSPProvenanceCompliance,
  type DSPProvenanceTrackInput,
} from './dspProvenancePolicy.js';

describe('DSP Human-Authorship & Opt-in Licensing Controls (CI-V3-20261021-04)', () => {
  it('correctly distinguishes 50M recommendation removals from 75M platform removals', () => {
    expect(DSP_REPORTED_METRICS.RECOMMENDATION_REMOVALS_COUNT).toBe(50_000_000);
    expect(DSP_REPORTED_METRICS.PLATFORM_REMOVALS_COUNT).toBe(75_000_000);
    expect(DSP_REPORTED_METRICS.RECOMMENDATION_REMOVALS_COUNT).not.toBe(
      DSP_REPORTED_METRICS.PLATFORM_REMOVALS_COUNT
    );
  });

  it('protects legitimate electronic DAW and MIDI tracks from false AI rejection', () => {
    const track: DSPProvenanceTrackInput = {
      trackId: 'track-midi-01',
      title: 'Techno Odyssey',
      classification: 'human_original',
      productionMethods: ['electronic_daw_midi'],
      aiDisclosure: {
        usedAIAssistance: false,
        toolsUsed: [],
      },
      remixConsent: {
        isRemixOrCover: false,
      },
      aiTrainingOptIn: false,
    };

    const evaluation = evaluateDSPProvenanceCompliance(track);
    expect(evaluation.eligibleForDistribution).toBe(true);
    expect(evaluation.eligibleForRecommendations).toBe(true);
    expect(evaluation.authorshipStatus).toBe('verified_human');
    expect(evaluation.flags).toContain('HUMAN_ARTISTRY_CONFIRMED');
    expect(evaluation.flags).toContain('TRAINING_SEPARATED');
  });

  it('protects legitimate sample-based collage compositions from false AI rejection', () => {
    const track: DSPProvenanceTrackInput = {
      trackId: 'track-sample-02',
      title: 'Boom Bap Soul',
      classification: 'human_original',
      productionMethods: ['sample_based_composition'],
      aiDisclosure: {
        usedAIAssistance: false,
        toolsUsed: [],
      },
      remixConsent: {
        isRemixOrCover: false,
      },
      aiTrainingOptIn: false,
    };

    const evaluation = evaluateDSPProvenanceCompliance(track);
    expect(evaluation.eligibleForDistribution).toBe(true);
    expect(evaluation.eligibleForRecommendations).toBe(true);
    expect(evaluation.authorshipStatus).toBe('verified_human');
    expect(evaluation.flags).toContain('HUMAN_ARTISTRY_CONFIRMED');
  });

  it('prohibits fully synthetic AI-generated audio from distribution', () => {
    const track: DSPProvenanceTrackInput = {
      trackId: 'track-synth-03',
      title: 'Prompt Beats Vol 1',
      classification: 'synthetic_ai_generated',
      productionMethods: ['algorithmic_generative_prompt'],
      aiDisclosure: {
        usedAIAssistance: true,
        toolsUsed: ['MusicGenModel'],
        humanContributionDescription: 'Prompt engineering only',
      },
      remixConsent: {
        isRemixOrCover: false,
      },
      aiTrainingOptIn: false,
    };

    const evaluation = evaluateDSPProvenanceCompliance(track);
    expect(evaluation.eligibleForDistribution).toBe(false);
    expect(evaluation.eligibleForRecommendations).toBe(false);
    expect(evaluation.authorshipStatus).toBe('rejected_synthetic');
    expect(evaluation.reason).toContain('Fully synthetic AI-generated audio is prohibited');
  });

  it('requires tool disclosure and human contribution for AI-assisted tracks', () => {
    const missingDetailsTrack: DSPProvenanceTrackInput = {
      trackId: 'track-assist-04',
      title: 'Vocal Remix Assisted',
      classification: 'human_assisted_ai',
      productionMethods: ['electronic_daw_midi'],
      aiDisclosure: {
        usedAIAssistance: true,
        toolsUsed: [], // Missing tools
        humanContributionDescription: '',
      },
      remixConsent: {
        isRemixOrCover: false,
      },
      aiTrainingOptIn: false,
    };

    const result = evaluateDSPProvenanceCompliance(missingDetailsTrack);
    expect(result.eligibleForDistribution).toBe(false);
    expect(result.reason).toContain('Disclosure required: AI-assisted track must list autonomous tools used');

    const validAssistedTrack: DSPProvenanceTrackInput = {
      ...missingDetailsTrack,
      aiDisclosure: {
        usedAIAssistance: true,
        toolsUsed: ['StemSeparatorPlugin', 'AIAudioMasterer'],
        humanContributionDescription: 'Human recorded guitar and vocals; used stem separation for clean remixing.',
      },
    };

    const validResult = evaluateDSPProvenanceCompliance(validAssistedTrack);
    expect(validResult.eligibleForDistribution).toBe(true);
    expect(validResult.eligibleForRecommendations).toBe(true);
    expect(validResult.authorshipStatus).toBe('human_assisted_disclosed');
    expect(validResult.flags).toContain('AI_ASSISTANCE_DISCLOSED');
  });

  it('rejects fan remixes and covers lacking licensing clearance', () => {
    const unlicencedRemix: DSPProvenanceTrackInput = {
      trackId: 'track-remix-05',
      title: 'Pop Star Hit (Fan Remix)',
      classification: 'human_original',
      productionMethods: ['electronic_daw_midi', 'sample_based_composition'],
      aiDisclosure: {
        usedAIAssistance: false,
        toolsUsed: [],
      },
      remixConsent: {
        isRemixOrCover: true,
        originalWorkTitle: 'Pop Star Hit',
        originalRightsholder: 'Major Label Music',
        licenseAgreementId: undefined, // Missing
        clearedThroughDSPAgreement: false,
      },
      aiTrainingOptIn: false,
    };

    const result = evaluateDSPProvenanceCompliance(unlicencedRemix);
    expect(result.eligibleForDistribution).toBe(false);
    expect(result.flags).toContain('REMIX_LICENSE_REQUIRED');
    expect(result.reason).toContain('Fan-made covers and remixes must provide an agreement ID');

    const licensedRemix: DSPProvenanceTrackInput = {
      ...unlicencedRemix,
      remixConsent: {
        ...unlicencedRemix.remixConsent,
        clearedThroughDSPAgreement: true, // Cleared under Believe/Spotify licensing terms
      },
    };

    const licensedResult = evaluateDSPProvenanceCompliance(licensedRemix);
    expect(licensedResult.eligibleForDistribution).toBe(true);
    expect(licensedResult.eligibleForRecommendations).toBe(true);
  });

  it('ensures AI training opt-in remains separate from distribution consent', () => {
    const trackWithNoTraining: DSPProvenanceTrackInput = {
      trackId: 'track-safe-06',
      title: 'Original Song',
      classification: 'human_original',
      productionMethods: ['live_acoustic_performance'],
      aiDisclosure: {
        usedAIAssistance: false,
        toolsUsed: [],
      },
      remixConsent: {
        isRemixOrCover: false,
      },
      aiTrainingOptIn: false,
    };

    const evaluation = evaluateDSPProvenanceCompliance(trackWithNoTraining);
    expect(evaluation.eligibleForDistribution).toBe(true);
    expect(evaluation.flags).toContain('TRAINING_SEPARATED');
  });
});
