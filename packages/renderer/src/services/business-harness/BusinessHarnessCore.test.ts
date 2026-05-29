import './index';
import { describe, expect, it } from 'vitest';
import { activityValueService } from './ActivityValueService';
import { boardroomMetaHarnessService } from './BoardroomMetaHarnessService';
import { hiddenCostHarnessService } from './HiddenCostHarnessService';
import { BUSINESS_HARNESS_CATALOG, HARNESS_IMPLEMENTATION_STATUS } from './HarnessCatalog';
import { merchPodHarnessService } from './MerchPodHarnessService';
import { uploadIntakeHarnessService } from './UploadIntakeHarnessService';
import { createHarnessRun } from './types';
import { APPROVAL_GATE_REGISTRY } from './ApprovalGateRegistry';
import { HarnessRegistry, compileHarness } from './HarnessCompiler';
import { releaseHarnessCompiler } from '../release-harness/ReleaseHarnessCompiler';

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

  it('defines a status for every domain in BUSINESS_HARNESS_CATALOG', () => {
    BUSINESS_HARNESS_CATALOG.forEach(entry => {
      expect(HARNESS_IMPLEMENTATION_STATUS[entry.domain]).toBeDefined();
    });
  });

  it('maps every irreversible action to an approval gate definition', () => {
    const actions: (keyof typeof APPROVAL_GATE_REGISTRY)[] = [
      'deliver to DSP',
      'send legal notice',
      'file registration',
      'spend money',
      'publish publicly',
      'place POD order',
      'run paid ads',
      'enable biometric monitoring',
      'destructive data changes',
    ];
    actions.forEach(action => {
      const gate = APPROVAL_GATE_REGISTRY[action];
      expect(gate).toBeDefined();
      expect(gate.action).toBe(action);
      expect(gate.riskTier).toBeDefined();
    });
  });

  it('proves Boardroom Meta Harness can ingest and reason about an adapted Release HarnessRun', async () => {
    HarnessRegistry.register(releaseHarnessCompiler);
    const releaseRun = await compileHarness<any, any>('release', {
      userId: 'user-a',
      metadata: { trackTitle: 'Adapter Test' }
    }, { userId: 'user-a' });

    const decision = boardroomMetaHarnessService.createDecision({
      userId: 'user-a',
      requestedAction: 'release to dsp',
      runs: [releaseRun]
    });

    expect(decision.sourceRunIds).toContain(releaseRun.runId);
    expect(decision.mode).toBeDefined();
  });

  it('Legal blocks release despite Distribution readiness', () => {
    const distributionRun = createHarnessRun({
      userId: 'user-a',
      domain: 'distribution_ddex',
      inputRefs: [], scores: [], findings: [], recommendations: [], costLines: [],
      legalBasis: [], evidenceRefs: [], agentBriefs: [], assumptions: [],
      confidence: 1.0,
      output: { readiness: 'ready' },
      approvalGates: [],
    });

    const legalRun = createHarnessRun({
      userId: 'user-a',
      domain: 'legal_compliance',
      inputRefs: [], scores: [], findings: [], recommendations: [], costLines: [],
      legalBasis: [], evidenceRefs: [], agentBriefs: [], assumptions: [],
      confidence: 1.0,
      output: {},
      approvalGates: [{
        id: 'gate-legal',
        label: 'Sample clearance required',
        requiredFor: 'deliver to DSP',
        riskTier: 'attorney_review',
        reason: 'Uncleared sample detected',
      }],
    });

    const decision = boardroomMetaHarnessService.createDecision({
      userId: 'user-a',
      requestedAction: 'deliver to DSP',
      runs: [distributionRun, legalRun] as any,
    });

    expect(decision.mode).toBe('blocked');
    expect(decision.decision).toBe('block');
    expect(decision.blockers[0]).toContain('Sample clearance');
  });

  it('Finance blocks paid campaign despite Marketing urgency', () => {
    const marketingRun = createHarnessRun({
      userId: 'user-a',
      domain: 'marketing_growth',
      inputRefs: [], scores: [], recommendations: [], costLines: [],
      legalBasis: [], evidenceRefs: [], agentBriefs: [], approvalGates: [], assumptions: [],
      confidence: 1.0,
      output: {},
      findings: [{
        id: 'f1',
        domain: 'marketing_growth',
        severity: 'info',
        title: 'High urgency for campaign',
        detail: 'Trending topic match',
        confidence: 'high'
      }],
    });

    const financeRun = createHarnessRun({
      userId: 'user-a',
      domain: 'finance',
      inputRefs: [], scores: [], findings: [], recommendations: [], costLines: [],
      legalBasis: [], evidenceRefs: [], agentBriefs: [], assumptions: [],
      confidence: 1.0,
      output: {},
      approvalGates: [{
        id: 'gate-finance',
        label: 'Budget Approval',
        requiredFor: 'run paid ads',
        riskTier: 'blocked',
        reason: 'Exceeds monthly ad budget',
      }],
    });

    const decision = boardroomMetaHarnessService.createDecision({
      userId: 'user-a',
      requestedAction: 'run paid ads',
      runs: [marketingRun, financeRun] as any,
    });

    expect(decision.mode).toBe('blocked');
    expect(decision.blockers[0]).toContain('Budget Approval');
  });

  it('Creator Protection escalates voice risk before delivery', () => {
    const protectionRun = createHarnessRun({
      userId: 'user-a',
      domain: 'creator_protection',
      inputRefs: [], scores: [], findings: [], recommendations: [], costLines: [],
      legalBasis: [], evidenceRefs: [], agentBriefs: [], assumptions: [],
      confidence: 1.0,
      output: {},
      approvalGates: [{
        id: 'gate-voice',
        label: 'Voice Clone Authorization',
        requiredFor: 'deliver to DSP',
        riskTier: 'attorney_review',
        reason: 'Unlicensed AI voice clone detected in stems',
      }],
    });

    const decision = boardroomMetaHarnessService.createDecision({
      userId: 'user-a',
      requestedAction: 'deliver to DSP',
      runs: [protectionRun] as any,
    });

    expect(decision.mode).toBe('blocked');
    expect(decision.decision).toBe('block');
    expect(decision.blockers[0]).toContain('Voice Clone');
  });

  it('Merch sample approval blocks POD order', () => {
    const merchRun = createHarnessRun({
      userId: 'user-a',
      domain: 'merch_pod',
      inputRefs: [], scores: [], findings: [], recommendations: [], costLines: [],
      legalBasis: [], evidenceRefs: [], agentBriefs: [], assumptions: [],
      confidence: 1.0,
      output: {},
      approvalGates: [{
        id: 'gate-merch',
        label: 'Sample Review Required',
        requiredFor: 'place POD order',
        riskTier: 'blocked',
        reason: 'Physical sample not yet reviewed by artist',
      }],
    });

    const decision = boardroomMetaHarnessService.createDecision({
      userId: 'user-a',
      requestedAction: 'place POD order',
      runs: [merchRun] as any,
    });

    expect(decision.mode).toBe('blocked');
    expect(decision.blockers[0]).toContain('Sample Review');
  });

  it('Road cost changes Opportunity decision', () => {
    const opportunityRun = createHarnessRun({
      userId: 'user-a',
      domain: 'opportunity',
      inputRefs: [], scores: [], findings: [], recommendations: [], costLines: [],
      legalBasis: [], evidenceRefs: [], agentBriefs: [], assumptions: [],
      confidence: 1.0,
      output: { recommended: true },
      approvalGates: [],
    });

    const roadRun = createHarnessRun({
      userId: 'user-a',
      domain: 'road_travel',
      inputRefs: [], scores: [], findings: [], recommendations: [], costLines: [],
      legalBasis: [], evidenceRefs: [], agentBriefs: [], assumptions: [],
      confidence: 1.0,
      output: {},
      approvalGates: [{
        id: 'gate-road',
        label: 'Travel Budget Overrun',
        requiredFor: 'spend money',
        riskTier: 'blocked',
        reason: 'Travel cost exceeds guaranteed gig payout',
      }],
    });

    const decision = boardroomMetaHarnessService.createDecision({
      userId: 'user-a',
      requestedAction: 'spend money',
      runs: [opportunityRun, roadRun] as any,
    });

    expect(decision.mode).toBe('blocked');
    expect(decision.blockers[0]).toContain('Travel Budget');
  });
});
