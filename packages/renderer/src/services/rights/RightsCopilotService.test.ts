import { describe, expect, it } from 'vitest';
import { RightsCopilotService } from './RightsCopilotService';
import { DepositAsset } from '@indii/shared';

describe('RightsCopilotService - ISSUE-1511 Assisted Rights Registration Engine', () => {
  const service = new RightsCopilotService();

  it('creates a validated manifest from a prospect assessment with identified gaps', () => {
    const assessment = {
      id: 'asmt-abc',
      artistName: 'Maya Echo',
      proAffiliation: 'None',
      mlcRegistered: 'No',
      careerStage: 'Just starting out',
      genre: 'R&B / Soul',
    };

    const manifest = service.createManifestFromPassport(assessment, {
      title: 'Golden Hour',
      isrc: 'USIND2600042',
    });

    expect(manifest.artistLegalName).toBe('Maya Echo');
    expect(manifest.work.title).toBe('Golden Hour');
    expect(manifest.work.isrc).toBe('USIND2600042');

    // Should include both the_mlc and bmi because the artist has gaps
    expect(manifest.targetPortals).toContain('the_mlc');
    expect(manifest.targetPortals).toContain('bmi');
    expect(manifest.targetPortals).toContain('loc_copyright');
    expect(manifest.targetPortals).toContain('soundexchange');

    // Default 100% split to claimant
    expect(manifest.splits[0].sharePercentage).toBe(100);
    expect(manifest.splits[0].role).toBe('writer_composer');
  });

  it('generates actionable browser copilot steps for Library of Congress eCO and The MLC', () => {
    const manifest = service.createManifestFromPassport(
      { artistName: 'Atlas Gray', proAffiliation: 'BMI', mlcRegistered: 'No' },
      { title: 'Neon Highway' },
    );

    const locActions = service.getActionPlan(manifest, 'loc_copyright');
    expect(locActions.length).toBeGreaterThanOrEqual(6);
    expect(locActions.some((a) => a.type === 'navigate')).toBe(true);
    expect(locActions.some((a) => a.type === 'pause_for_user_auth')).toBe(true);
    expect(locActions.some((a) => a.type === 'pause_for_user_payment')).toBe(true);

    const mlcActions = service.getActionPlan(manifest, 'the_mlc');
    expect(mlcActions.length).toBeGreaterThanOrEqual(3);
    expect(mlcActions.some((a) => a.type === 'navigate' && a.value?.toString().includes('themlc.com'))).toBe(true);
  });

  it('computes SHA-256 checksums from binary audio buffers', async () => {
    const encoder = new TextEncoder();
    const mockAudioData = encoder.encode('MOCK_AUDIO_PAYLOAD_FOR_TESTING');

    const checksum = await service.computeAudioChecksum(mockAudioData);
    expect(checksum).toHaveLength(64);
    expect(/^[a-f0-9]{64}$/.test(checksum)).toBe(true);
  });

  it('validates and attaches audio deposit asset to manifest', () => {
    const manifest = service.createManifestFromPassport({ artistName: 'Atlas Gray' }, { title: 'Neon Highway' });

    const validAsset: DepositAsset = {
      filename: 'neon_highway_master.wav',
      fileSizeBytes: 30000000,
      mimeType: 'audio/wav',
      sha256Checksum: 'a'.repeat(64),
      durationSeconds: 180,
    };

    const result = service.attachDeposit(manifest, validAsset);
    expect(result.isValid).toBe(true);
    expect(result.manifest.depositAssets).toHaveLength(1);
    expect(result.manifest.depositAssets[0].filename).toBe('neon_highway_master.wav');
  });

  it('generates formatted filing brief with splits and deposit details', () => {
    const manifest = service.createManifestFromPassport({ artistName: 'Atlas Gray' }, { title: 'Neon Highway' });

    const brief = service.generateFilingBrief(manifest);
    expect(brief).toContain('# indii Rights Registration Dossier');
    expect(brief).toContain('**Work Title:** Neon Highway');
    expect(brief).toContain('**Claimant:** Atlas Gray');
    expect(brief).toContain('Target Registration Portals:');
  });

  it('generates action plans for all 6 supported rights portals and records official filing confirmations', () => {
    const manifest = service.createManifestFromPassport(
      { artistName: 'Nova Pulse' },
      { title: 'Starlight Drive', isrc: 'USIND2699901' },
    );

    const portals = ['loc_copyright', 'the_mlc', 'bmi', 'ascap', 'soundexchange', 'hfa'] as const;
    for (const portal of portals) {
      const plan = service.getActionPlan(manifest, portal);
      expect(plan.length).toBeGreaterThanOrEqual(4);
    }

    const record = service.recordFilingConfirmation(manifest, 'loc_copyright', {
      serviceRequestId: '1-9876543210',
      confirmationNumber: 'SR-2026-000999',
    });

    expect(record.status).toBe('confirmed');
    expect(record.serviceRequestId).toBe('1-9876543210');
    expect(record.confirmationNumber).toBe('SR-2026-000999');
    expect(record.portalTarget).toBe('loc_copyright');
  });
});
