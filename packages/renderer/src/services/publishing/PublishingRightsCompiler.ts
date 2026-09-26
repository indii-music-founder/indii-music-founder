import { HarnessCompiler, HarnessContext } from '../business-harness/HarnessCompiler';
import {
    SHARE_UNITS_PER_PERCENT,
    TOTAL_SHARE_UNITS,
    sumShareUnits,
} from '@indii/shared';
import {
  HarnessRun,
  HarnessScore,
  HarnessFinding,
  HarnessRecommendation,
  HarnessApprovalGate,
  HarnessInputRef,
  createHarnessRun,
  HarnessAgentBrief,
} from '../business-harness/types';

export interface PublishingCoWriter {
  id: string;
  name: string;
  sharePercentage: number;
  publisherSharePercentage: number;
  proAffiliation?: string;
  ipiNumber?: string;
  publisherName?: string;
  publisherIpi?: string;
  approvedSplitSheet: boolean;
}

export interface PublishingRightsInput {
  songId: string;
  songTitle: string;
  iswc?: string;
  writers: PublishingCoWriter[];
  proRegistrationStatus: 'unregistered' | 'pending' | 'registered';
  mlcRegistrationStatus: 'unregistered' | 'pending' | 'registered';
}

export interface PublishingRightsOutput {
  registrationReady: boolean;
  blockers: string[];
  missingIpis: string[];
  pendingApprovals: string[];
  needsMlc: boolean;
  iswcStatus: 'missing' | 'assigned';
  totalWriterShare: number;
  totalPublisherShare: number;
}

export class PublishingRightsCompiler implements HarnessCompiler<PublishingRightsInput, PublishingRightsOutput> {
  readonly domain = 'publishing_rights';

  compile(input: PublishingRightsInput, ctx: HarnessContext): HarnessRun<PublishingRightsOutput> {
    const findings: HarnessFinding[] = [];
    const recommendations: HarnessRecommendation[] = [];
    const scores: HarnessScore[] = [];
    const approvalGates: HarnessApprovalGate[] = [];
    const blockers: string[] = [];
    const missingIpis: string[] = [];
    const pendingApprovals: string[] = [];
    let iswcStatus: 'missing' | 'assigned' = 'missing';

    // Fixed-point share arithmetic (shareUnits): percentages are summed in
    // basis-point units so float drift can never pass or fail a gate.
    const totalWriterShareUnits = sumShareUnits(input.writers.map((writer) => writer.sharePercentage));
    const totalPublisherShareUnits = sumShareUnits(input.writers.map((writer) => writer.publisherSharePercentage));
    // Human-facing totals (single deterministic divide; interface unchanged).
    const totalWriterShare = totalWriterShareUnits / SHARE_UNITS_PER_PERCENT;
    const totalPublisherShare = totalPublisherShareUnits / SHARE_UNITS_PER_PERCENT;

    // Track approvals & IPI completeness
    input.writers.forEach((writer) => {
      if (!writer.ipiNumber) {
        missingIpis.push(writer.name);
      }
      if (!writer.approvedSplitSheet) {
        pendingApprovals.push(writer.name);
        blockers.push(`Missing split sheet approval from ${writer.name}`);
        approvalGates.push({
          id: `split_approval_${writer.id}`,
          label: `Split Sheet Approval: ${writer.name}`,
          reason: `Required to establish legal claim to ${writer.sharePercentage}% writer share.`,
          requiredFor: 'Registration and Distribution',
          riskTier: 'blocked',
        });
      }
    });

    // Score: Split Sheet Approvals
    const unapprovedCount = pendingApprovals.length;
    const totalWriters = input.writers.length;
    scores.push({
      label: 'Split Approvals',
      value: totalWriters === 0 ? 0 : totalWriters - unapprovedCount,
      max: totalWriters === 0 ? 1 : totalWriters,
      status: totalWriters === 0 ? 'blocked' : (unapprovedCount > 0 ? 'blocked' : 'good'),
      rationale: totalWriters === 0 ? 'No writers provided.' : (unapprovedCount > 0 ? `${unapprovedCount} writers have not approved splits.` : 'All splits approved.'),
    });

    if (totalWriters === 0) {
      blockers.push('No writers provided.');
      findings.push({
        id: 'no_writers',
        domain: this.domain,
        severity: 'critical',
        title: 'No Writers Provided',
        detail: 'A composition must have at least one writer.',
        confidence: 'high',
      });
    } else if (unapprovedCount > 0) {
      findings.push({
        id: 'missing_split_approvals',
        domain: this.domain,
        severity: 'critical',
        title: 'Missing Split Sheet Approvals',
        detail: `Missing approvals from: ${pendingApprovals.join(', ')}`,
        confidence: 'high',
      });
    }

    // Mathematical validation — exact basis-point share units (shareUnits).
    // Non-finite shares (corrupt data) sum to NaN and fail closed here.
    // Using 100% standard for both writer and publisher shares (total 200% combined, or 100% writer/100% pub).
    if (totalWriterShareUnits !== TOTAL_SHARE_UNITS) {
      blockers.push(`Total writer share is ${totalWriterShare}%, must be exactly 100%.`);
      findings.push({
        id: 'invalid_writer_share',
        domain: this.domain,
        severity: 'critical',
        title: 'Invalid Writer Share Total',
        detail: `Writers share totals ${totalWriterShare}% instead of 100%.`,
        confidence: 'high',
      });
    }
    
    if (totalPublisherShareUnits !== TOTAL_SHARE_UNITS) {
      blockers.push(`Total publisher share is ${totalPublisherShare}%, must be exactly 100%.`);
      findings.push({
        id: 'invalid_publisher_share',
        domain: this.domain,
        severity: 'critical',
        title: 'Invalid Publisher Share Total',
        detail: `Publishers share totals ${totalPublisherShare}% instead of 100%.`,
        confidence: 'high',
      });
    }

    // ISWC Check
    if (!input.iswc) {
      iswcStatus = 'missing';
      // It's not a strict delivery blocker but prevents proper global royalty collection
      findings.push({
        id: 'missing_iswc',
        domain: this.domain,
        severity: 'medium',
        title: 'Missing ISWC',
        detail: 'Song does not have an ISWC. This does not block delivery, but delays global publishing royalty collection.',
        confidence: 'high',
      });
      recommendations.push({
        id: 'register_iswc',
        domain: this.domain,
        priority: 'medium',
        title: 'Register for ISWC',
        detail: 'Register the song with your PRO to get an ISWC assigned.',
        ownerAgentId: 'publishing',
        approvalRequired: false,
      });
    } else {
      iswcStatus = 'assigned';
    }

    // PRO & MLC Status
    if (input.proRegistrationStatus === 'unregistered') {
      blockers.push('Not registered with a PRO.');
      findings.push({
        id: 'pro_unregistered',
        domain: this.domain,
        severity: 'high',
        title: 'PRO Registration Missing',
        detail: 'The composition is not registered with a Performance Rights Organization (e.g., ASCAP, BMI).',
        confidence: 'high',
      });
    }

    let needsMlc = false;
    if (input.mlcRegistrationStatus === 'unregistered') {
      needsMlc = true;
      blockers.push('MLC registration missing — required for mechanical royalty collection.');
      findings.push({
        id: 'mlc_unregistered',
        domain: this.domain,
        severity: 'high',
        title: 'MLC Registration Missing',
        detail: 'Mechanical Licensing Collective (MLC) registration is missing. You will not collect mechanical royalties from US streaming.',
        confidence: 'high',
      });
    }

    // IPI Check
    if (missingIpis.length > 0) {
      blockers.push(`Missing writer IPI/CAE: ${missingIpis.join(', ')}`);
      findings.push({
        id: 'missing_ipi',
        domain: this.domain,
        severity: 'medium', // High if you want to block registration, but often people register without knowing co-writers IPI
        title: 'Missing IPI/CAE Numbers',
        detail: `Writers missing IPI: ${missingIpis.join(', ')}`,
        confidence: 'high',
      });
    }

    // CRITICAL: Registration ready requires the actual delivery blockers.
    // A missing ISWC is deliberately NOT a blocker — it delays global royalty
    // collection but does not block delivery/registration (see the medium
    // 'missing_iswc' finding above). Counting it here contradicted that finding.
    const hasCriticalBlockers = blockers.length > 0 ||
                                 input.mlcRegistrationStatus === 'unregistered' ||
                                 missingIpis.length > 0;
    
    // registrationReady means: ready to file splits/works with proper identifiers
    // This requires: PRO active, writer IPIs present, ISWC assigned, MLC registered
    const registrationReady = !hasCriticalBlockers;

    const output: PublishingRightsOutput = {
      registrationReady,
      blockers,
      missingIpis,
      pendingApprovals,
      needsMlc,
      iswcStatus,
      totalWriterShare,
      totalPublisherShare,
    };

    const inputRefs: HarnessInputRef[] = [
      {
        type: 'track',
        id: input.songId,
        label: input.songTitle,
      },
    ];

    const agentBriefs: HarnessAgentBrief[] = [];
    if (!registrationReady) {
      agentBriefs.push({
        agentId: 'legal',
        brief: 'Resolve publishing split sheet blocks and verify share totals.',
        inputs: ['Publishing splits', 'Writer signatures'],
        blockedBy: blockers,
      });
    }

    return createHarnessRun<PublishingRightsOutput>({
      userId: ctx.userId,
      projectId: ctx.projectId,
      domain: this.domain,
      inputRefs,
      scores,
      findings,
      recommendations,
      costLines: [],
      legalBasis: [],
      evidenceRefs: [],
      agentBriefs,
      approvalGates,
      assumptions: [
        'Assuming standard 100% writer share and 100% publisher share representation.',
      ],
      confidence: 1.0,
      output,
      schemaVersion: 1,
    });
  }
}
