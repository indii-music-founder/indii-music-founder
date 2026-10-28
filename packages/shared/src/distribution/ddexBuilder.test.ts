import { describe, it, expect } from 'vitest';
import { ddexBuilder } from './ddexBuilder.js';
import type { IngestionNotificationMessage } from './types/ern.js';
import {
  classifyMusicAIStatus,
  verifyDistributionVsTrainingBoundary,
  assessERNCompatibility,
} from './ernCompatibility.js';

describe('DDEX ERN 4.3.2 Builder & AI Metadata Compatibility', () => {
  const baseMessageHeader = {
    messageThreadId: 'THREAD-001',
    messageId: 'MSG-001',
    messageSender: {
      systemIdentifier: 'PADPIDA0000000001',
      entityName: 'indii.music',
    },
    messageRecipient: {
      systemIdentifier: 'PADPIDA0000000002',
      entityName: 'Spotify',
    },
    messageCreatedDateTime: '2026-10-28T12:00:00Z',
    messageControlType: 'LiveMessage' as const,
  };

  it('builds valid ERN 4.3.2 XML with ContainsAI=None for human electronic/DAW tracks', () => {
    const ern: IngestionNotificationMessage = {
      messageSchemaVersionId: '4.3.2',
      messageHeader: baseMessageHeader,
      releaseList: [
        {
          releaseReference: 'R001',
          releaseType: 'Single',
          releaseTitle: { titleText: 'Midnight Modular' },
          displayArtistName: 'Synth Lab',
          contributors: [
            {
              name: 'Synth Lab',
              role: 'MainArtist',
              aiContribution: 'None',
            },
          ],
          labelName: 'Modular Records',
          genre: { genre: 'Electronic', subGenre: 'Techno' },
          parentalWarningType: 'NotExplicit',
          releaseResourceReferenceList: ['A001'],
          releaseId: { icpn: '123456789012' },
          aiGenerationInfo: {
            containsAi: 'None',
            isFullyAIGenerated: false,
            isPartiallyAIGenerated: false,
            disclosureType: 'Human_Created',
            humanContributionDescription: 'Composed with hardware synthesizers and analog sequencers in Ableton Live.',
          },
        },
      ],
      resourceList: [
        {
          resourceReference: 'A001',
          resourceType: 'SoundRecording',
          resourceId: { isrc: 'USXYZ2600001' },
          resourceTitle: { titleText: 'Midnight Modular' },
          displayArtistName: 'Synth Lab',
          contributors: [
            {
              name: 'Synth Lab',
              role: 'Producer',
              aiContribution: 'None',
            },
          ],
          duration: 'PT5M30S',
          aiGenerationInfo: {
            containsAi: 'None',
            isFullyAIGenerated: false,
            isPartiallyAIGenerated: false,
            disclosureType: 'Human_Created',
          },
        },
      ],
      dealList: [
        {
          dealReference: 'D001',
          dealTerms: {
            commercialModelType: 'SubscriptionModel',
            usage: [{ useType: 'OnDemandStream' }],
            territoryCode: ['Worldwide'],
            validityPeriod: { startDate: '2026-11-01' },
          },
        },
      ],
    };

    const xml = ddexBuilder.buildIngestionNotification(ern);
    expect(xml).toContain('MessageSchemaVersionId="4.3.2"');
    expect(xml).toContain('<ContainsAI>None</ContainsAI>');
    expect(xml).toContain('<AiContribution>None</AiContribution>');
    expect(xml).toContain('<HumanContributionDescription>Composed with hardware synthesizers and analog sequencers in Ableton Live.</HumanContributionDescription>');
  });

  it('builds ERN 4.3.2 XML with ContainsAI=Partly and AI tool disclosures', () => {
    const ern: IngestionNotificationMessage = {
      messageSchemaVersionId: '4.3.2',
      messageHeader: baseMessageHeader,
      releaseList: [
        {
          releaseReference: 'R002',
          releaseType: 'Single',
          releaseTitle: { titleText: 'Hybrid Vocals' },
          displayArtistName: 'Nova',
          contributors: [
            {
              name: 'Nova',
              role: 'MainArtist',
              aiContribution: 'Partly',
            },
          ],
          labelName: 'Indii Records',
          genre: { genre: 'Pop', subGenre: 'Electropop' },
          parentalWarningType: 'NotExplicit',
          releaseResourceReferenceList: ['A002'],
          releaseId: { icpn: '123456789013' },
          aiGenerationInfo: {
            containsAi: 'Partly',
            isFullyAIGenerated: false,
            isPartiallyAIGenerated: true,
            aiToolsUsed: ['iZotope Ozone AI', 'Synchro Arts RePitch'],
            disclosureType: 'AI_Assisted',
          },
        },
      ],
      resourceList: [
        {
          resourceReference: 'A002',
          resourceType: 'SoundRecording',
          resourceId: { isrc: 'USXYZ2600002' },
          resourceTitle: { titleText: 'Hybrid Vocals' },
          displayArtistName: 'Nova',
          contributors: [],
          duration: 'PT3M15S',
          aiGenerationInfo: {
            containsAi: 'Partly',
            isFullyAIGenerated: false,
            isPartiallyAIGenerated: true,
            aiToolsUsed: ['iZotope Ozone AI'],
            disclosureType: 'AI_Assisted',
          },
        },
      ],
      dealList: [
        {
          dealReference: 'D002',
          dealTerms: {
            commercialModelType: 'SubscriptionModel',
            usage: [{ useType: 'OnDemandStream' }],
            territoryCode: ['Worldwide'],
            validityPeriod: { startDate: '2026-11-01' },
          },
        },
      ],
    };

    const xml = ddexBuilder.buildIngestionNotification(ern);
    expect(xml).toContain('<ContainsAI>Partly</ContainsAI>');
    expect(xml).toContain('<AIToolUsed>iZotope Ozone AI</AIToolUsed>');
    expect(xml).toContain('<DisclosureType>AI_Assisted</DisclosureType>');
  });

  describe('classifyMusicAIStatus', () => {
    it('protects human electronic and sample-based production from being flagged as AI', () => {
      const electronicTrack = classifyMusicAIStatus({
        isElectronic: true,
        usesDAW: true,
        usesSynthesizers: true,
        usesLicensedSamples: true,
        isGenerativeAISynthesis: false,
      });

      expect(electronicTrack.containsAi).toBe('None');
      expect(electronicTrack.isHumanElectronicPreserved).toBe(true);
      expect(electronicTrack.reason).toContain('electronic arrangement');
      expect(electronicTrack.reason).toContain('hardware/software synthesizers');
    });

    it('identifies AI-assisted processing correctly as Partly', () => {
      const assistedTrack = classifyMusicAIStatus({
        usesAIAssistedTools: true,
        isGenerativeAISynthesis: false,
      });

      expect(assistedTrack.containsAi).toBe('Partly');
      expect(assistedTrack.isHumanElectronicPreserved).toBe(false);
    });

    it('identifies fully generative AI generation as All', () => {
      const generativeTrack = classifyMusicAIStatus({
        isGenerativeAISynthesis: true,
      });

      expect(generativeTrack.containsAi).toBe('All');
      expect(generativeTrack.isHumanElectronicPreserved).toBe(false);
    });
  });

  describe('verifyDistributionVsTrainingBoundary', () => {
    it('confirms pure distribution deals do not leak AI training rights', () => {
      const ern: IngestionNotificationMessage = {
        messageSchemaVersionId: '4.3.2',
        messageHeader: baseMessageHeader,
        releaseList: [],
        resourceList: [],
        dealList: [
          {
            dealReference: 'D001',
            dealTerms: {
              commercialModelType: 'SubscriptionModel',
              usage: [{ useType: 'OnDemandStream' }],
              territoryCode: ['Worldwide'],
              validityPeriod: { startDate: '2026-11-01' },
            },
          },
        ],
      };

      const result = verifyDistributionVsTrainingBoundary(ern, null);
      expect(result.isolated).toBe(true);
      expect(result.hasUnauthorizedTrainingClause).toBe(false);
    });

    it('flags unapproved training commercial models as security breach', () => {
      const taintedErn: IngestionNotificationMessage = {
        messageSchemaVersionId: '4.3.2',
        messageHeader: baseMessageHeader,
        releaseList: [],
        resourceList: [],
        dealList: [
          {
            dealReference: 'D-TAINTED',
            dealTerms: {
              commercialModelType: 'AI_Training_Data_Ingestion' as any,
              usage: [{ useType: 'OnDemandStream' }],
              territoryCode: ['Worldwide'],
              validityPeriod: { startDate: '2026-11-01' },
            },
          },
        ],
      };

      const result = verifyDistributionVsTrainingBoundary(taintedErn, null);
      expect(result.isolated).toBe(false);
      expect(result.hasUnauthorizedTrainingClause).toBe(true);
      expect(result.details).toContain('CRITICAL SECURITY BREACH');
    });
  });

  describe('assessERNCompatibility', () => {
    it('passes standard checks for valid 4.3.2 payload', () => {
      const ern: IngestionNotificationMessage = {
        messageSchemaVersionId: '4.3.2',
        messageHeader: baseMessageHeader,
        releaseList: [
          {
            releaseReference: 'R001',
            releaseType: 'Single',
            releaseTitle: { titleText: 'Verified Track' },
            displayArtistName: 'Artist A',
            contributors: [],
            labelName: 'Label',
            genre: { genre: 'Dance', subGenre: 'Club' },
            parentalWarningType: 'NotExplicit',
            releaseResourceReferenceList: ['A001'],
            releaseId: { icpn: '123' },
            aiGenerationInfo: {
              containsAi: 'None',
              isFullyAIGenerated: false,
              isPartiallyAIGenerated: false,
            },
          },
        ],
        resourceList: [
          {
            resourceReference: 'A001',
            resourceType: 'SoundRecording',
            resourceId: { isrc: 'USXYZ2600001' },
            resourceTitle: { titleText: 'Verified Track' },
            displayArtistName: 'Artist A',
            contributors: [],
            duration: 'PT3M00S',
            aiGenerationInfo: {
              containsAi: 'None',
              isFullyAIGenerated: false,
              isPartiallyAIGenerated: false,
            },
          },
        ],
        dealList: [
          {
            dealReference: 'D001',
            dealTerms: {
              commercialModelType: 'SubscriptionModel',
              usage: [{ useType: 'OnDemandStream' }],
              territoryCode: ['Worldwide'],
              validityPeriod: { startDate: '2026-11-01' },
            },
          },
        ],
      };

      const assessment = assessERNCompatibility(ern);
      expect(assessment.isStandardCompliant).toBe(true);
      expect(assessment.containsAiOverall).toBe('None');
      expect(assessment.dspProfiles.Spotify.compatible).toBe(true);
      expect(assessment.dspProfiles.AppleMusic.compatible).toBe(true);
      expect(assessment.trainingConsentSeparated).toBe(true);
    });

    it('catches missing ISRC as fatal error for sound recording distribution', () => {
      const badErn: IngestionNotificationMessage = {
        messageSchemaVersionId: '4.3.2',
        messageHeader: baseMessageHeader,
        releaseList: [
          {
            releaseReference: 'R001',
            releaseType: 'Single',
            releaseTitle: { titleText: 'Bad Track' },
            displayArtistName: 'Artist B',
            contributors: [],
            labelName: 'Label',
            genre: { genre: 'Dance', subGenre: 'Club' },
            parentalWarningType: 'NotExplicit',
            releaseResourceReferenceList: ['A001'],
            releaseId: { icpn: '123' },
          },
        ],
        resourceList: [
          {
            resourceReference: 'A001',
            resourceType: 'SoundRecording',
            resourceId: {}, // Missing ISRC
            resourceTitle: { titleText: 'Bad Track' },
            displayArtistName: 'Artist B',
            contributors: [],
            duration: 'PT3M00S',
          },
        ],
        dealList: [
          {
            dealReference: 'D001',
            dealTerms: {
              commercialModelType: 'SubscriptionModel',
              usage: [{ useType: 'OnDemandStream' }],
              territoryCode: ['Worldwide'],
              validityPeriod: { startDate: '2026-11-01' },
            },
          },
        ],
      };

      const assessment = assessERNCompatibility(badErn);
      expect(assessment.isStandardCompliant).toBe(false);
      expect(assessment.dspProfiles.GeneralDDEX.issues.some((i) => i.code === 'MISSING_ISRC')).toBe(true);
    });
  });
});
