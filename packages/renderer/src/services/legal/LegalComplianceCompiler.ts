import {
  type HarnessRun,
  type HarnessFinding,
  type HarnessRecommendation,
  type HarnessApprovalGate,
  type HarnessAgentBrief,
  type HarnessScore,
  createHarnessRun
} from '../business-harness/types';

import {
  type HarnessCompiler,
  type HarnessContext
} from '../business-harness/HarnessCompiler';

export interface LegalReviewItem {
  id: string;
  type:
    | 'contract'
    | 'audio_sample'
    | 'trademark_name'
    | 'likeness'
    | 'merch_art'
    | 'collaboration_agreement'
    | 'licensing_restriction'
    | 'release_metadata' // for DDEX
    | 'data_privacy'; // biometric, user data
  content: string; // The text, url, or summary of the item being reviewed
  metadata?: Record<string, unknown>;
}

export interface LegalComplianceInput {
  items: LegalReviewItem[];
}

export interface LegalComplianceOutput {
  reviewStatus: 'pass' | 'needs_review' | 'blocked';
  totalRiskScore: number;
}

export class LegalComplianceCompiler implements HarnessCompiler<LegalComplianceInput, LegalComplianceOutput> {
  readonly domain = 'legal_compliance';

  compile(input: LegalComplianceInput, ctx: HarnessContext): HarnessRun<LegalComplianceOutput> {
    const findings: HarnessFinding[] = [];
    const recommendations: HarnessRecommendation[] = [];
    const approvalGates: HarnessApprovalGate[] = [];
    const agentBriefs: HarnessAgentBrief[] = [];
    const scores: HarnessScore[] = [];

    let highestRiskLevel = 0; // 0: info, 1: low, 2: medium, 3: high, 4: critical

    input.items.forEach(item => {
      if (item.type === 'contract' && item.content.toLowerCase().includes('ai generated')) {
        findings.push({
          id: `f_contract_ai_${item.id}`,
          domain: this.domain,
          severity: 'high',
          title: 'AI Clause Detected in Contract',
          detail: 'Contract contains clauses regarding AI-generated content or training rights.',
          confidence: 'high',
          evidenceRefs: [{ id: `ev_${item.id}`, type: 'statement', label: 'Contract Text', value: item.content }]
        });
        recommendations.push({
          id: `r_contract_ai_${item.id}`,
          domain: this.domain,
          priority: 'high',
          title: 'Attorney Review for AI Clause',
          detail: 'Consult legal counsel to ensure AI training rights are not being inadvertently surrendered.',
          ownerAgentId: 'legal_agent',
          approvalRequired: true
        });
        approvalGates.push({
          id: `gate_contract_${item.id}`,
          label: 'Legal Approval for AI Clause',
          reason: 'Non-standard AI clauses present high risk to future rights.',
          requiredFor: 'contract_execution',
          riskTier: 'attorney_review'
        });
        highestRiskLevel = Math.max(highestRiskLevel, 3);
      }

      if (item.type === 'audio_sample') {
        const isCleared = item.metadata?.cleared === true;
        if (!isCleared) {
          findings.push({
            id: `f_sample_${item.id}`,
            domain: this.domain,
            severity: 'critical',
            title: 'Uncleared Audio Sample',
            detail: 'Audio sample has not been marked as cleared for commercial use.',
            confidence: 'high'
          });
          approvalGates.push({
            id: `gate_sample_${item.id}`,
            label: 'Sample Clearance Verification',
            reason: 'Distributing uncleared samples exposes the artist to copyright infringement lawsuits.',
            requiredFor: 'distribution',
            riskTier: 'blocked'
          });
          highestRiskLevel = Math.max(highestRiskLevel, 4);
        }
      }

      if (item.type === 'trademark_name') {
        const trademarkCleared = item.metadata?.trademarkSearchStatus === 'cleared';
        if (!trademarkCleared) {
          findings.push({
            id: `f_tm_${item.id}`,
            domain: this.domain,
            severity: 'medium',
            title: 'Trademark Search Required',
            detail: `Artist or project name "${item.content}" has not been verified by a trademark clearance provider.`,
            confidence: 'high'
          });
          approvalGates.push({
            id: `gate_tm_${item.id}`,
            label: 'Trademark Clearance Verification',
            reason: 'Name clearance cannot be inferred from local keyword checks.',
            requiredFor: 'brand_launch',
            riskTier: 'attorney_review'
          });
          highestRiskLevel = Math.max(highestRiskLevel, 2);
        }
      }

      if (item.type === 'data_privacy') {
        if (item.content.toLowerCase().includes('biometric') || item.content.toLowerCase().includes('face scan')) {
          findings.push({
            id: `f_privacy_${item.id}`,
            domain: this.domain,
            severity: 'critical',
            title: 'Biometric Data Privacy Risk',
            detail: 'Collection of biometric data requires explicit, informed consent under BIPA/GDPR.',
            confidence: 'high'
          });
          approvalGates.push({
            id: `gate_privacy_${item.id}`,
            label: 'Biometric Consent Check',
            reason: 'Strict liability and massive fines associated with biometric data mishandling.',
            requiredFor: 'data_collection',
            riskTier: 'blocked'
          });
          highestRiskLevel = Math.max(highestRiskLevel, 4);
        }
      }

      if (item.type === 'release_metadata') {
        // DDEX compliance check
        if (!item.metadata?.isrc || !item.metadata?.upc) {
          findings.push({
            id: `f_ddex_${item.id}`,
            domain: this.domain,
            severity: 'medium',
            title: 'DDEX Compliance Issue',
            detail: 'Missing required DDEX metadata identifiers (ISRC/UPC).',
            confidence: 'high'
          });
          agentBriefs.push({
            agentId: 'distribution_agent',
            brief: 'Release is missing ISRC or UPC codes. Auto-generate or request from user before generating DDEX.',
            inputs: [item.id]
          });
          highestRiskLevel = Math.max(highestRiskLevel, 2);
        }
      }
      
      if (item.type === 'likeness' || item.type === 'merch_art') {
         if (item.metadata?.contains_third_party === true) {
            findings.push({
                id: `f_likeness_${item.id}`,
                domain: this.domain,
                severity: 'medium',
                title: 'Third Party Rights in Visuals',
                detail: 'Likeness or merch art contains third-party intellectual property.',
                confidence: 'high'
            });
            highestRiskLevel = Math.max(highestRiskLevel, 2);
         }
      }
    });

    if (highestRiskLevel > 2) {
      agentBriefs.push({
        agentId: 'legal_agent',
        brief: 'High or critical legal risks identified. Immediate review required.',
        inputs: input.items.map(i => i.id)
      });
    }

    scores.push({
      label: 'Legal Risk Index',
      value: highestRiskLevel,
      max: 4,
      status: highestRiskLevel >= 3 ? 'blocked' : highestRiskLevel >= 1 ? 'watch' : 'good',
      rationale: `Determined by highest severity finding (0-4 scale: ${highestRiskLevel}).`
    });

    const output: LegalComplianceOutput = {
      reviewStatus: highestRiskLevel >= 4 ? 'blocked' : highestRiskLevel >= 2 ? 'needs_review' : 'pass',
      totalRiskScore: highestRiskLevel
    };

    return createHarnessRun<LegalComplianceOutput>({
      userId: ctx.userId,
      projectId: ctx.projectId,
      domain: this.domain,
      schemaVersion: 1,
      inputRefs: input.items.map(i => ({ type: 'project', id: i.id })),
      scores,
      findings,
      recommendations,
      costLines: [],
      legalBasis: [],
      evidenceRefs: [],
      agentBriefs,
      approvalGates,
      assumptions: ['Assuming all input text has been fully transcribed or uploaded.'],
      confidence: 0.85,
      output
    });
  }
}
