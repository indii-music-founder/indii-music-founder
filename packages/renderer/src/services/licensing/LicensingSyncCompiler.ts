import {
  HarnessCompiler,
  HarnessContext,
  HarnessRun,
  createHarnessRun,
  HarnessDomain,
  HarnessScore,
  HarnessFinding,
  HarnessRecommendation,
  HarnessAgentBrief,
  HarnessApprovalGate,
} from '../business-harness/types';

export interface LicensingSyncInput {
  trackId: string;
  hasStems: boolean;
  hasInstrumental: boolean;
  hasLyrics: boolean;
  hasUnClearedSamples: boolean;
  metadataComplete: boolean;
  catalogSearchable: boolean;
  opportunityFitScore?: number; // 0 to 100
}

export interface LicensingSyncOutput {
  syncReadinessScore: number;
  rightsClearanceStatus: 'cleared' | 'blocked' | 'pending';
  pitchPackageGenerated: boolean;
}

export class LicensingSyncCompiler implements HarnessCompiler<LicensingSyncInput, LicensingSyncOutput> {
  readonly domain: HarnessDomain = 'licensing_sync';

  compile(input: LicensingSyncInput, ctx: HarnessContext): HarnessRun<LicensingSyncOutput> {
    const scores: HarnessScore[] = [];
    const findings: HarnessFinding[] = [];
    const recommendations: HarnessRecommendation[] = [];
    const agentBriefs: HarnessAgentBrief[] = [];
    const approvalGates: HarnessApprovalGate[] = [];

    // Calculate sync readiness
    let syncReadinessScore = 100;
    
    if (!input.hasStems) {
      syncReadinessScore -= 20;
      findings.push({
        id: 'finding_missing_stems',
        domain: this.domain,
        severity: 'medium',
        title: 'Missing Stems',
        detail: 'Track is missing stems, reducing sync placement opportunities.',
        confidence: 'high'
      });
      recommendations.push({
        id: 'rec_upload_stems',
        domain: this.domain,
        priority: 'medium',
        title: 'Upload Stems',
        detail: 'Upload stems to increase sync readiness score.',
        ownerAgentId: 'creative_agent',
        approvalRequired: false
      });
    }

    if (!input.hasInstrumental) {
      syncReadinessScore -= 20;
      findings.push({
        id: 'finding_missing_instrumental',
        domain: this.domain,
        severity: 'high',
        title: 'Missing Instrumental',
        detail: 'Instrumentals are often required for sync placements.',
        confidence: 'high'
      });
    }

    if (!input.hasLyrics) {
      syncReadinessScore -= 10;
    }

    if (!input.metadataComplete) {
      syncReadinessScore -= 20;
    }
    
    if (!input.catalogSearchable) {
      findings.push({
        id: 'finding_not_catalog_searchable',
        domain: this.domain,
        severity: 'medium',
        title: 'Not Catalog Searchable',
        detail: 'Track is missing vital catalog tags and is not searchable by supervisors.',
        confidence: 'high'
      });
    }

    scores.push({
      label: 'Sync Readiness',
      value: syncReadinessScore,
      max: 100,
      status: syncReadinessScore >= 80 ? 'good' : syncReadinessScore >= 50 ? 'watch' : 'blocked',
      rationale: 'Based on presence of stems, instrumentals, lyrics, and metadata.'
    });

    let rightsClearanceStatus: 'cleared' | 'blocked' | 'pending' = 'cleared';
    
    // Un-cleared sample blocks sync pitch
    if (input.hasUnClearedSamples) {
      rightsClearanceStatus = 'blocked';
      syncReadinessScore = 0; // Blocked

      findings.push({
        id: 'finding_uncleared_samples',
        domain: this.domain,
        severity: 'critical',
        title: 'Un-cleared Samples',
        detail: 'Track contains un-cleared samples, blocking sync licensing.',
        confidence: 'high'
      });

      approvalGates.push({
        id: 'gate_sample_clearance',
        label: 'Sample Clearance Required',
        reason: 'Un-cleared samples must be resolved before pitch.',
        requiredFor: 'pitch_package',
        riskTier: 'blocked'
      });

      agentBriefs.push({
        agentId: 'legal_agent',
        brief: 'Clear samples for track.',
        inputs: [input.trackId]
      });
    }

    scores.push({
      label: 'Rights Clearance',
      value: rightsClearanceStatus === 'cleared' ? 100 : 0,
      max: 100,
      status: rightsClearanceStatus === 'cleared' ? 'good' : 'blocked',
      rationale: rightsClearanceStatus === 'cleared' ? 'All rights cleared.' : 'Un-cleared samples present.'
    });

    // perfect match triggers auto-pitch recommendation
    let pitchPackageGenerated = false;
    if (rightsClearanceStatus === 'cleared' && syncReadinessScore >= 80) {
      pitchPackageGenerated = true;

      if (input.opportunityFitScore !== undefined && input.opportunityFitScore >= 95) {
        recommendations.push({
          id: 'rec_auto_pitch',
          domain: this.domain,
          priority: 'high',
          title: 'Auto-Pitch Recommendation',
          detail: 'Perfect opportunity fit score triggers auto-pitch recommendation.',
          ownerAgentId: 'marketing_agent',
          approvalRequired: true
        });

        agentBriefs.push({
          agentId: 'marketing_agent',
          brief: 'Execute auto-pitch for perfect match opportunity.',
          inputs: [input.trackId]
        });
      }
    }

    return createHarnessRun<LicensingSyncOutput>({
      schemaVersion: 1,
      userId: ctx.userId,
      projectId: ctx.projectId,
      domain: this.domain,
      inputRefs: [
        {
          type: 'track',
          id: input.trackId,
          label: `Track ${input.trackId}`
        }
      ],
      scores,
      findings,
      recommendations,
      costLines: [],
      legalBasis: [],
      evidenceRefs: [],
      agentBriefs,
      approvalGates,
      assumptions: ['Assuming provided metadata and clearance statuses are accurate.'],
      confidence: 0.9,
      output: {
        syncReadinessScore,
        rightsClearanceStatus,
        pitchPackageGenerated
      }
    });
  }
}
