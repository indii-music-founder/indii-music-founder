import { describe, expect, it } from 'vitest';
import { creatorProtectionHarnessService } from './CreatorProtectionHarnessService';

describe('CreatorProtectionHarnessService', () => {
  it('keeps enacted TAKE IT DOWN law separate from proposed NO FAKES law', () => {
    const profile = creatorProtectionHarnessService.createIdentityProtectionProfile({
      userId: 'user-a',
      artistName: 'Indii Artist',
      legalName: 'Artist Legal',
      copyrightStatus: 'registered',
      trademarkStatus: 'pending',
      pro: 'BMI',
      ipiCae: '123456789',
      monitoringOptIn: true,
    });
    const run = creatorProtectionHarnessService.compileReadiness({
      profile,
      works: [{ workTitle: 'Signal', isrc: 'USQY12600101', upc: '123456789012', iswc: 'T-123.456.789-0' }],
    });

    expect(run.domain).toBe('creator_protection');
    expect(run.output.lawSnapshots.find(s => s.id === 'take_it_down_act_2025')?.status).toBe('enacted');
    expect(run.output.lawSnapshots.find(s => s.id === 'no_fakes_act_2025')?.status).toBe('proposed');
    expect(run.findings.some(f => f.title.includes('Current law and proposed law'))).toBe(true);
  });

  it('routes a voice clone report to a digital replica notice with attorney caution', () => {
    const incident = creatorProtectionHarnessService.classifyIncident({
      userId: 'user-a',
      suspectedUrl: 'https://example.test/fake-song',
      platform: 'ExampleTube',
      description: 'Someone used an AI voice clone to make a fake song that sounds like me and endorses a product.',
    });
    const packet = creatorProtectionHarnessService.generateEvidencePacket({
      userId: 'user-a',
      incidentId: incident.id,
      work: { workTitle: 'Original Song', isrc: 'USQY12600101' },
      evidenceRefs: [{ id: 'url-1', type: 'url', label: 'Reported fake song', url: 'https://example.test/fake-song' }],
    });
    const takedown = creatorProtectionHarnessService.prepareTakedownDraft({
      userId: 'user-a',
      incident,
      packet,
      rightsholderName: 'Indii Artist',
    });

    expect(incident.incidentType).toBe('voice_clone');
    expect(incident.route).toBe('platform_digital_replica');
    expect(takedown.approvalRequired).toBe(true);
    expect(takedown.draftText).toContain('AI digital replica');
    expect(takedown.warnings).toContain('User approval is required before sending.');
  });

  it('flags broad AI voice and likeness contract clauses', () => {
    const review = creatorProtectionHarnessService.reviewAIVoiceLikenessClause(
      'Artist grants perpetual irrevocable rights to create digital replica, synthetic performances, and train models using voice and likeness with sublicensing.'
    );

    expect(review.severity).toBe('high');
    expect(review.flags.length).toBeGreaterThan(4);
    expect(review.recommendedClause).toContain('No AI voice');
  });
});

