import { HarnessCompiler, HarnessContext } from '../business-harness/HarnessCompiler';
import { 
  createHarnessRun, 
  HarnessRun, 
  HarnessFinding, 
  HarnessApprovalGate, 
  HarnessAgentBrief 
} from '../business-harness/types';

export type SplitApprovalStatus = 'approved' | 'disputed' | 'pending';

export interface CollaboratorInput {
  id: string;
  name: string;
  roles: string[]; // e.g., 'writer', 'producer', 'artist'
  contributionNotes: string;
  proposedSplit: number; // percentage (0-100)
  approvalStatus: SplitApprovalStatus;
  hasAgreement: boolean;
}

export interface CollaborationSplitsInput {
  trackId: string;
  trackTitle: string;
  collaborators: CollaboratorInput[];
}

export interface CollaborationSplitsOutput {
  totalSplit: number;
  readyForSplitSheet: boolean;
  isDisputed: boolean;
  missingAgreements: string[];
}

export class CollaborationSplitsCompiler implements HarnessCompiler<CollaborationSplitsInput, CollaborationSplitsOutput> {
  readonly domain = 'collaboration_splits';

  compile(input: CollaborationSplitsInput, ctx: HarnessContext): HarnessRun<CollaborationSplitsOutput> {
    const findings: HarnessFinding[] = [];
    const approvalGates: HarnessApprovalGate[] = [];
    const agentBriefs: HarnessAgentBrief[] = [];
    
    let totalSplit = 0;
    let isDisputed = false;
    let allApproved = true;
    const missingAgreements: string[] = [];

    for (const collab of input.collaborators) {
      totalSplit += collab.proposedSplit;

      if (collab.approvalStatus === 'disputed') {
        isDisputed = true;
        allApproved = false;
        
        findings.push({
          id: `dispute_${collab.id}`,
          domain: this.domain,
          severity: 'critical',
          title: 'Split Disputed',
          detail: `Collaborator ${collab.name} has disputed the proposed split of ${collab.proposedSplit}%.`,
          confidence: 'high'
        });

        approvalGates.push({
          id: `gate_dispute_${collab.id}`,
          label: `Resolve Dispute: ${collab.name}`,
          reason: `Split must be agreed upon to clear release and licensing.`,
          requiredFor: 'release, licensing_sync',
          riskTier: 'blocked'
        });
      } else if (collab.approvalStatus === 'pending') {
        allApproved = false;
      }

      if (!collab.hasAgreement) {
        missingAgreements.push(collab.id);
        
        const isProducer = collab.roles.some(r => r.toLowerCase().includes('producer'));
        
        if (isProducer) {
          findings.push({
            id: `missing_agreement_${collab.id}_legal`,
            domain: 'legal_compliance',
            severity: 'high',
            title: 'Missing Producer Agreement',
            detail: `Producer ${collab.name} is missing a signed producer agreement.`,
            confidence: 'high'
          });
          findings.push({
            id: `missing_agreement_${collab.id}_finance`,
            domain: 'finance',
            severity: 'medium',
            title: 'Potential Uncaptured Producer Points/Advances',
            detail: `Producer ${collab.name} has no agreement on file. Cannot verify royalty points or required advances.`,
            confidence: 'high'
          });
          
          approvalGates.push({
            id: `gate_agreement_${collab.id}`,
            label: `Producer Agreement Needed: ${collab.name}`,
            reason: `Missing producer agreement for ${collab.name}.`,
            requiredFor: 'distribution_ddex',
            riskTier: 'blocked'
          });
        } else {
          findings.push({
            id: `missing_agreement_${collab.id}`,
            domain: 'legal_compliance',
            severity: 'medium',
            title: 'Missing Collaborator Agreement',
            detail: `Collaborator ${collab.name} is missing a signed agreement or split sheet.`,
            confidence: 'high'
          });
        }
      }
    }

    if (Math.abs(totalSplit - 100) > 0.001) {
      findings.push({
        id: `invalid_total_split`,
        domain: this.domain,
        severity: 'critical',
        title: 'Invalid Split Total',
        detail: `The total proposed splits sum up to ${totalSplit}%, but must be exactly 100%.`,
        confidence: 'high'
      });
      allApproved = false; // Cannot be ready for split sheet if total is not 100%
      
      approvalGates.push({
        id: `gate_invalid_total`,
        label: `Correct Total Splits`,
        reason: `Splits currently total ${totalSplit}%. They must equal 100%.`,
        requiredFor: 'split_sheet_generation',
        riskTier: 'blocked'
      });
    }

    const readyForSplitSheet = allApproved && Math.abs(totalSplit - 100) <= 0.001 && !isDisputed;

    if (!readyForSplitSheet) {
      agentBriefs.push({
        agentId: 'legal_agent',
        departmentId: 'legal',
        brief: `Track "${input.trackTitle}" is not ready for split sheets. Total split: ${totalSplit}%. Disputed: ${isDisputed}. Missing agreements: ${missingAgreements.length}.`,
        inputs: ['collaboration_splits'],
        blockedBy: missingAgreements.length > 0 || isDisputed || Math.abs(totalSplit - 100) > 0.001 ? ['collaborators'] : []
      });
    }

    return createHarnessRun<CollaborationSplitsOutput>({
      schemaVersion: 1,
      userId: ctx.userId,
      projectId: ctx.projectId,
      domain: this.domain,
      inputRefs: [
        {
          type: 'track',
          id: input.trackId,
          label: input.trackTitle
        }
      ],
      scores: [
        {
          label: 'Split Readiness',
          value: readyForSplitSheet ? 100 : 0,
          max: 100,
          status: readyForSplitSheet ? 'good' : (isDisputed || Math.abs(totalSplit - 100) > 0.001 ? 'blocked' : 'watch'),
          rationale: readyForSplitSheet ? 'All splits approved and total 100%.' : 'Missing approvals, disputes, or invalid total split.'
        }
      ],
      findings,
      recommendations: [],
      costLines: [],
      legalBasis: [],
      evidenceRefs: [],
      agentBriefs,
      approvalGates,
      assumptions: [
        'Assuming all roles properly represent actual contributions',
        'Assuming proposed splits are based on mutual understanding'
      ],
      confidence: 0.9,
      output: {
        totalSplit,
        readyForSplitSheet,
        isDisputed,
        missingAgreements
      }
    });
  }
}
