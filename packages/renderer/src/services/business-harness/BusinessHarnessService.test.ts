import { describe, expect, it } from 'vitest';
import { activityValueService } from './ActivityValueService';
import { boardroomMetaHarnessService } from './BoardroomMetaHarnessService';
import { hiddenCostHarnessService } from './HiddenCostHarnessService';
import { BUSINESS_HARNESS_CATALOG } from './HarnessCatalog';
import { merchPodHarnessService } from './MerchPodHarnessService';
import { uploadIntakeHarnessService } from './UploadIntakeHarnessService';
import { createHarnessRun } from './types';

describe('Business Harness core', () => {
  it('converts active app time into value tracking without calling it revenue', () => {
    const started = activityValueService.startSession({
      userId: 'user-a',
      eventType: 'module_focus',
      module: 'legal',
      hourlyRate: 60,
      startedAt: '2026-05-28T12:00:00.000Z',
      source: 'automatic',
    });
    const finished = activityValueService.finishSession(started.id, '2026-05-28T12:45:00.000Z', 5)!;
    const costLine = activityValueService.buildTimeValueCostLine(finished);

    expect(costLine.amount).toBe(40);
    expect(costLine.costType).toBe('time_value');
    expect(costLine.notes).toContain('not revenue');
  });

  it('models the guitar-string store run as cash, mileage, and drive-time value', () => {
    const lines = hiddenCostHarnessService.buildGuitarStoreScenario({
      userId: 'user-a',
      equipmentCost: 14.99,
      milesRoundTrip: 18,
      driveMinutes: 42,
      hourlyRate: 50,
      mileageRate: 0.7,
    });
    const summary = hiddenCostHarnessService.summarizeCostLines(lines);

    expect(lines.map(line => line.costType)).toEqual(['cash_expense', 'mileage', 'time_value']);
    expect(summary.byType.cash_expense).toBe(14.99);
    expect(summary.byType.mileage).toBe(12.6);
    expect(summary.byType.time_value).toBe(35);
  });

  it('blocks Boardroom execution when a domain harness has legal approval gates', () => {
    const run = createHarnessRun({
      userId: 'user-a',
      domain: 'creator_protection',
      inputRefs: [],
      scores: [],
      findings: [{
        id: 'finding-1',
        domain: 'creator_protection',
        severity: 'critical',
        title: 'Attorney review required',
        detail: 'State publicity claim requires counsel.',
        confidence: 'high',
      }],
      recommendations: [],
      costLines: [],
      legalBasis: [],
      evidenceRefs: [],
      agentBriefs: [{ agentId: 'legal', departmentId: 'legal', brief: 'Review digital replica claim.', inputs: [] }],
      approvalGates: [{
        id: 'gate-1',
        label: 'Attorney review',
        reason: 'Potential digital replica claim.',
        requiredFor: 'send takedown',
        riskTier: 'attorney_review',
      }],
      assumptions: [],
      confidence: 0.82,
      output: {},
      runId: 'run-1',
      createdAt: '2026-05-28T12:00:00.000Z',
    });

    const decision = boardroomMetaHarnessService.createDecision({
      userId: 'user-a',
      requestedAction: 'send takedown',
      runs: [run],
    });

    expect(decision.mode).toBe('blocked');
    expect(decision.decision).toBe('block');
    expect(decision.userApprovalRequired).toBe(true);
    expect(decision.blockers[0]).toContain('Attorney review');
  });

  it('catalogs the planned harness domains with owners', () => {
    expect(BUSINESS_HARNESS_CATALOG).toHaveLength(22);
    expect(BUSINESS_HARNESS_CATALOG.find(entry => entry.domain === 'creator_protection')?.ownerAgentId).toBe('legal');
    expect(BUSINESS_HARNESS_CATALOG.find(entry => entry.domain === 'merch_pod')?.supportingAgentIds).toContain('finance');
  });

  it('compiles merch POD provider and margin recommendations without placing orders', () => {
    const run = merchPodHarnessService.compile({
      userId: 'user-a',
      dropGoal: 'release_drop',
      skus: [
        { productType: 'T-Shirt', provider: 'printful', baseCost: 12, shippingEstimate: 4, targetRetailPrice: 32, expectedUnits: 25 },
        { productType: 'Poster', provider: 'printify', baseCost: 8, shippingEstimate: 5, targetRetailPrice: 18, expectedUnits: 25, legalFlag: 'Artwork includes unlicensed logo.' },
      ],
    });

    expect(run.domain).toBe('merch_pod');
    expect(run.output.preferredProvider).toBe('printful');
    expect(run.approvalGates[0]?.label).toContain('POD');
    expect(run.findings[0]?.title).toContain('Legal review');
  });

  it('turns an upload intake into song DNA, DDEX, protection, and release outputs', async () => {
    const result = await uploadIntakeHarnessService.compileUploadIntake({
      userId: 'user-a',
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
        pro: 'ASCAP',
        composerIPI: '123456789',
        splits: [{ legalName: 'Artist', role: 'songwriter', percentage: 100, email: 'a@test.local' }],
      },
      selectedStores: ['spotify', 'apple_music'],
    });

    expect(result.songDnaRun.domain).toBe('song_dna');
    expect(result.distributionRun.domain).toBe('distribution_ddex');
    expect(result.creatorProtectionRun.domain).toBe('creator_protection');
    expect(result.releaseResult.recommendedStrategy).toBeDefined();
    expect(result.distributionRun.approvalGates[0]?.id).toBe('ddex_delivery_user_approval');
    expect(result.creatorProtectionRun.output.profile.aiVoiceLikenessPermission).toBe('not_authorized');
  });
});
