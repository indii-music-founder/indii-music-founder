import type { HarnessCompiler, HarnessContext } from '../business-harness/HarnessCompiler';
import { createHarnessRun } from '../business-harness/types';
import type { HarnessRun, HarnessAgentBrief, HarnessApprovalGate, HarnessFinding, HarnessSeverity } from '../business-harness/types';

export interface SecurityTrustInput {
  actionType: 'credentials' | 'spending' | 'delivery' | 'biometrics' | 'evidence' | 'agent_permissions';
  actionDetails: Record<string, unknown>;
  biometricOptIn?: boolean;
  legalNoticeApproved?: boolean;
  spendingAmount?: number;
  evidenceTampered?: boolean;
  isExternalApi?: boolean;
}

export interface SecurityTrustOutput {
  actionApproved: boolean;
  auditLogId: string;
}

export class SecurityTrustCompiler implements HarnessCompiler<SecurityTrustInput, SecurityTrustOutput> {
  readonly domain = 'security_trust';

  compile(input: SecurityTrustInput, ctx: HarnessContext): HarnessRun<SecurityTrustOutput> {
    const findings: HarnessFinding[] = [];
    const approvalGates: HarnessApprovalGate[] = [];
    const agentBriefs: HarnessAgentBrief[] = [];
    
    let isBlocked = false;

    // 1. Biometric monitoring opt-in required
    if (input.actionType === 'biometrics' && !input.biometricOptIn) {
      isBlocked = true;
      approvalGates.push({
        id: 'gate_biometrics_opt_in',
        label: 'Biometric Opt-In Required',
        reason: 'Explicit user opt-in is required before processing biometric data.',
        requiredFor: 'biometrics_processing',
        riskTier: 'blocked'
      });
      findings.push({
        id: 'finding_biometrics_missing_opt_in',
        domain: this.domain,
        severity: 'critical' as HarnessSeverity,
        title: 'Missing Biometric Opt-In',
        detail: 'Biometric processing was requested but user has not opted in.',
        confidence: 'high'
      });
    }

    // 2. Legal notice approval required
    if (!input.legalNoticeApproved && (input.actionType === 'delivery' || input.actionType === 'agent_permissions')) {
      isBlocked = true;
      approvalGates.push({
        id: 'gate_legal_notice',
        label: 'Legal Notice Approval',
        reason: 'Legal terms must be accepted prior to delivery or permission changes.',
        requiredFor: 'legal_compliance',
        riskTier: 'blocked'
      });
      findings.push({
        id: 'finding_legal_notice_missing',
        domain: this.domain,
        severity: 'high' as HarnessSeverity,
        title: 'Legal Notice Not Approved',
        detail: 'User must approve the legal notice for this action.',
        confidence: 'high'
      });
    }

    // 3. External API credential handling
    if (input.actionType === 'credentials' || input.isExternalApi) {
      approvalGates.push({
        id: 'gate_credential_handling',
        label: 'External Credential Handling Approval',
        reason: 'External API credentials require secure vault processing and explicit approval.',
        requiredFor: 'api_access',
        riskTier: 'approval'
      });
      agentBriefs.push({
        agentId: 'devops_agent',
        departmentId: 'DevOps',
        brief: 'Handle secure injection of external API credentials for the requested action.',
        inputs: ['actionDetails.credentials']
      });
    }

    // 4. Spending risk gates
    if (input.actionType === 'spending' && input.spendingAmount !== undefined && input.spendingAmount > 1000) {
      isBlocked = true;
      approvalGates.push({
        id: 'gate_spending_limit',
        label: 'High Spending Limit Exceeded',
        reason: `Spending amount of ${input.spendingAmount} exceeds automatic approval threshold.`,
        requiredFor: 'financial_transaction',
        riskTier: 'blocked'
      });
      findings.push({
        id: 'finding_spending_high',
        domain: this.domain,
        severity: 'medium' as HarnessSeverity,
        title: 'High Spending Amount',
        detail: 'The requested transaction requires manual review.',
        confidence: 'high'
      });
    }

    // Publishing risk gates (Delivery)
    if (input.actionType === 'delivery') {
      approvalGates.push({
        id: 'gate_publishing_risk',
        label: 'Publishing Risk Gate',
        reason: 'All outbound deliveries must pass a publishing risk check.',
        requiredFor: 'distribution',
        riskTier: 'approval'
      });
    }

    // 5. Evidence packet tamper warning
    if (input.actionType === 'evidence' && input.evidenceTampered) {
      isBlocked = true;
      findings.push({
        id: 'finding_evidence_tampered',
        domain: this.domain,
        severity: 'critical' as HarnessSeverity,
        title: 'Evidence Tampering Detected',
        detail: 'The provided evidence packet failed integrity checks.',
        confidence: 'high'
      });
      approvalGates.push({
        id: 'gate_evidence_integrity',
        label: 'Evidence Integrity check failed',
        reason: 'Evidence payload must not be tampered.',
        requiredFor: 'legal_evidence',
        riskTier: 'blocked'
      });
      agentBriefs.push({
        agentId: 'legal_agent',
        departmentId: 'Legal',
        brief: 'Review tampered evidence packet and advise on compliance mitigation.',
        inputs: ['actionDetails.evidence']
      });
    }

    agentBriefs.push({
      agentId: 'security_agent',
      departmentId: 'Security',
      brief: `Monitor sensitive action of type ${input.actionType}.`,
      inputs: ['actionDetails']
    });

    return createHarnessRun<SecurityTrustOutput>({
      schemaVersion: 1,
      userId: ctx.userId,
      projectId: ctx.projectId,
      domain: this.domain,
      inputRefs: [],
      scores: [],
      findings,
      recommendations: [],
      costLines: [],
      legalBasis: [],
      evidenceRefs: [],
      agentBriefs,
      approvalGates,
      assumptions: [],
      confidence: isBlocked ? 1.0 : 0.8,
      output: {
        actionApproved: !isBlocked,
        auditLogId: `audit_${Date.now()}_${Math.floor(Math.random() * 1000)}`
      }
    });
  }
}
