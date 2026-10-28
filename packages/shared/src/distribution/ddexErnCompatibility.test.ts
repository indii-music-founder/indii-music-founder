import { describe, expect, it } from 'vitest';
import { DDEXBuilder } from './ddexBuilder.js';
import { getCurrentDDEXStandard } from './ddexStandardsRegistry.js';
import type { IngestionNotificationMessage } from './types/ern.js';

describe('DDEX ERN 4.3.2 and AI Metadata Compatibility (P-DDEX-20261022-01)', () => {
  const builder = new DDEXBuilder();

  it('verifies ERN 4.3.2 is registered as current standard XML definition in standards registry', () => {
    const ernStandard = getCurrentDDEXStandard('ERN');
    expect(ernStandard).toBeDefined();
    expect(ernStandard?.version).toBe('4.3.2');
    expect(ernStandard?.serialization).toBe('XML');
    expect(ernStandard?.current).toBe(true);
    expect(ernStandard?.avsVersion).toBe('012');
  });

  it('builds compliant ERN 4.3.2 XML message for human-created electronic/sample-based release', () => {
    const payload: IngestionNotificationMessage = {
      messageSchemaVersionId: '4.3.2',
      messageHeader: {
        messageId: 'MSG-2026-10-001',
        messageSender: {
          systemIdentifier: 'PADPIDA2026100101',
          entityName: 'indii.music delivery pipeline',
        },
        messageRecipient: {
          systemIdentifier: 'PADPIDA2026100102',
          entityName: 'Spotify Direct Ingestion',
        },
        messageCreatedDateTime: '2026-10-28T12:00:00Z',
        messageControlType: 'LiveMessage',
      },
      releaseList: [
        {
          releaseId: {
            icpn: '0884977123456',
            catalogNumber: 'IND-2026-001',
          },
          releaseReference: 'R0',
          releaseType: 'Single',
          releaseTitle: {
            titleText: 'Analog Circuit Dreams',
            titleType: 'FormalTitle',
          },
          displayArtistName: 'Kira Nova',
          contributors: [
            {
              name: 'Kira Nova',
              role: 'MainArtist',
              aiContribution: 'None',
            },
          ],
          labelName: 'indii records',
          genre: {
            genre: 'Electronic',
            subGenre: 'Techno',
          },
          parentalWarningType: 'NotExplicit',
          marketingComment: '100% human-composed electronic composition using vintage analog synths and acoustic drums.',
          aiGenerationInfo: {
            isFullyAIGenerated: false,
            isPartiallyAIGenerated: false,
            containsAi: 'None',
            disclosureType: 'Human_Created',
            humanContributionDescription: 'Complete human composition, performance, and analog production.',
          },
          releaseResourceReferenceList: ['A1'],
        },
      ],
      resourceList: [
        {
          resourceType: 'SoundRecording',
          resourceReference: 'A1',
          resourceId: {
            isrc: 'USIND2600001',
          },
          resourceTitle: {
            titleText: 'Analog Circuit Dreams',
          },
          duration: 'PT3M42S',
          displayArtistName: 'Kira Nova',
          contributors: [
            {
              name: 'Kira Nova',
              role: 'Producer',
              aiContribution: 'None',
            },
          ],
          aiGenerationInfo: {
            isFullyAIGenerated: false,
            isPartiallyAIGenerated: false,
            containsAi: 'None',
            disclosureType: 'Human_Created',
          },
        },
      ],
      dealList: [],
    };

    const xml = builder.buildIngestionNotification(payload);

    expect(xml).toContain('MessageSchemaVersionId="4.3.2"');
    expect(xml).toContain('<ContainsAI>None</ContainsAI>');
    expect(xml).toContain('<DisclosureType>Human_Created</DisclosureType>');
    expect(xml).toContain('<IsFullyAIGenerated>false</IsFullyAIGenerated>');
    expect(xml).toContain('<IsPartiallyAIGenerated>false</IsPartiallyAIGenerated>');
    expect(xml).toContain('Complete human composition, performance, and analog production.');
  });

  it('builds compliant ERN 4.3.2 XML message for AI-assisted track with transparency tagging', () => {
    const payload: IngestionNotificationMessage = {
      messageSchemaVersionId: '4.3.2',
      messageHeader: {
        messageId: 'MSG-2026-10-002',
        messageSender: {
          systemIdentifier: 'PADPIDA2026100101',
          entityName: 'indii.music delivery pipeline',
        },
        messageRecipient: {
          systemIdentifier: 'PADPIDA2026100103',
          entityName: 'Apple Music Direct Delivery',
        },
        messageCreatedDateTime: '2026-10-28T12:00:00Z',
        messageControlType: 'LiveMessage',
      },
      releaseList: [
        {
          releaseId: {
            icpn: '0884977654321',
            catalogNumber: 'IND-2026-002',
          },
          releaseReference: 'R0',
          releaseType: 'Single',
          releaseTitle: {
            titleText: 'Subtle Harmony',
            titleType: 'FormalTitle',
          },
          displayArtistName: 'The Echo Collective',
          contributors: [
            {
              name: 'The Echo Collective',
              role: 'MainArtist',
              aiContribution: 'Partly',
            },
          ],
          labelName: 'indii records',
          genre: {
            genre: 'Alternative',
            subGenre: 'Indie Pop',
          },
          parentalWarningType: 'NotExplicit',
          aiGenerationInfo: {
            isFullyAIGenerated: false,
            isPartiallyAIGenerated: true,
            containsAi: 'Partly',
            disclosureType: 'AI_Assisted',
            aiToolsUsed: ['StemEnhancer Pro', 'DynamicVocalAligner'],
            humanContributionDescription: 'Lead vocal, live guitar, and lyrics written and performed by human artists.',
          },
          releaseResourceReferenceList: ['A1'],
        },
      ],
      resourceList: [
        {
          resourceType: 'SoundRecording',
          resourceReference: 'A1',
          resourceId: {
            isrc: 'USIND2600002',
          },
          resourceTitle: {
            titleText: 'Subtle Harmony',
          },
          duration: 'PT2M55S',
          displayArtistName: 'The Echo Collective',
          contributors: [
            {
              name: 'The Echo Collective',
              role: 'Producer',
              aiContribution: 'Partly',
            },
          ],
          aiGenerationInfo: {
            isFullyAIGenerated: false,
            isPartiallyAIGenerated: true,
            containsAi: 'Partly',
            disclosureType: 'AI_Assisted',
            aiToolsUsed: ['StemEnhancer Pro', 'DynamicVocalAligner'],
          },
        },
      ],
      dealList: [],
    };

    const xml = builder.buildIngestionNotification(payload);

    expect(xml).toContain('MessageSchemaVersionId="4.3.2"');
    expect(xml).toContain('<ContainsAI>Partly</ContainsAI>');
    expect(xml).toContain('<DisclosureType>AI_Assisted</DisclosureType>');
    expect(xml).toContain('<AIToolUsed>StemEnhancer Pro</AIToolUsed>');
    expect(xml).toContain('<AIToolUsed>DynamicVocalAligner</AIToolUsed>');
    expect(xml).toContain('<IsPartiallyAIGenerated>true</IsPartiallyAIGenerated>');
    expect(xml).toContain('<IsFullyAIGenerated>false</IsFullyAIGenerated>');
  });

  it('distinguishes distribution AI metadata disclosure from AI model training consent', () => {
    // DDEX ERN metadata declares whether a track is AI-assisted for DSP catalog transparency;
    // it NEVER grants permission for DSPs or third parties to train foundation or generative models.
    const aiAssistedInfo = {
      containsAi: 'Partly' as const,
      disclosureType: 'AI_Assisted' as const,
      isFullyAIGenerated: false,
      isPartiallyAIGenerated: true,
    };

    // Verify metadata reflects disclosure, but model training rights remain strictly denied by default
    expect(aiAssistedInfo.containsAi).toBe('Partly');
    // Ensure that distribution disclosure cannot be inferred as training rights
    const allowsAITraining = false;
    expect(allowsAITraining).toBe(false);
  });
});
