import { createHarnessRun, type HarnessRun, type HarnessScore, type HarnessFinding, type HarnessRecommendation, type HarnessAgentBrief } from '../business-harness/types';
import type { ReleaseHarnessResult, HarnessAgentBrief as LegacyAgentBrief } from './types';

export function releaseResultToHarnessRun(result: ReleaseHarnessResult): HarnessRun<ReleaseHarnessResult> {
  const scores: HarnessScore[] = [
    {
      label: 'Confidence',
      value: result.confidence * 100,
      max: 100,
      status: result.confidence > 0.7 ? 'good' : 'watch',
      rationale: 'Derived from Release Dna and Distribution Readiness confidence.',
    }
  ];

  const findings: HarnessFinding[] = result.warnings.map((w, index) => ({
    id: `warning-${index}`,
    domain: 'release',
    severity: 'medium',
    title: 'Release Warning',
    detail: w,
    confidence: 'medium',
  }));

  const recommendations: HarnessRecommendation[] = [
    {
      id: 'strategy',
      domain: 'release',
      priority: 'high',
      title: 'Recommended Strategy',
      detail: result.recommendedStrategy.name + ' - ' + result.recommendedStrategy.rationale.join(' '),
      ownerAgentId: 'distribution',
      approvalRequired: true,
    }
  ];

  const agentBriefs: HarnessAgentBrief[] = result.agentBriefs.map((b: LegacyAgentBrief) => ({
    agentId: b.agentId,
    departmentId: b.agentId,
    brief: b.brief,
    inputs: b.inputs,
    blockedBy: b.blockedBy,
  }));

  return createHarnessRun({
    runId: result.runId,
    userId: result.userId,
    projectId: result.projectId,
    domain: 'release',
    createdAt: result.createdAt,
    inputRefs: result.trackId ? [{ type: 'track', id: result.trackId }] : [],
    scores,
    findings,
    recommendations,
    costLines: [],
    legalBasis: [],
    evidenceRefs: [],
    agentBriefs,
    approvalGates: [{
      id: 'release_delivery_gate',
      label: 'Release Delivery',
      reason: 'Delivering a release to a DSP is an irreversible action.',
      requiredFor: 'deliver to DSP',
      riskTier: 'approval'
    }],
    assumptions: result.assumptions,
    confidence: result.confidence,
    output: result,
  });
}
