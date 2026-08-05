import {
  HarnessCompiler,
  HarnessContext,
  HarnessRun,
  createHarnessRun,
  HarnessDomain,
  HarnessScore,
  HarnessInputRef,
  HarnessFinding,
  HarnessRecommendation,
  HarnessAgentBrief,
  HarnessApprovalGate
} from '@indii/shared';

export type OpportunityType = 'show' | 'playlist' | 'collab' | 'sponsorship' | 'grant' | 'press' | 'brand_deal';

export interface OpportunityInput {
  id: string;
  type: OpportunityType;
  title: string;
  description: string;
  financialOffered: number; // USD
  financialCost: number; // USD
  exposureEstimate: number; // Expected reach/impressions
  brandAlignmentScore: number; // 0 to 10
  strategicValueScore: number; // 0 to 10
  url?: string;
}

export interface OpportunityOutput {
  roiScore: number;
  overallScore: number;
  viability: 'strong_yes' | 'yes' | 'maybe' | 'no' | 'hard_pass';
  flags: string[];
}

export class OpportunityCompiler implements HarnessCompiler<OpportunityInput, OpportunityOutput> {
  readonly domain: HarnessDomain = 'opportunity';

  compile(input: OpportunityInput, ctx: HarnessContext): HarnessRun<OpportunityOutput> {
    const findings: HarnessFinding[] = [];
    const recommendations: HarnessRecommendation[] = [];
    const agentBriefs: HarnessAgentBrief[] = [];
    const approvalGates: HarnessApprovalGate[] = [];
    const flags: string[] = [];

    const netFinancial = input.financialOffered - input.financialCost;
    let roiScore = 0;
    if (input.financialCost > 0) {
      roiScore = netFinancial / input.financialCost;
    } else if (netFinancial > 0) {
      roiScore = 10;
    }

    // 1. low-pay/high-exposure gig evaluation
    if (input.type === 'show') {
      if (input.financialOffered <= 100 && input.exposureEstimate >= 5000) {
         findings.push({
           id: `finding_show_exposure_${input.id}`,
           domain: this.domain,
           severity: 'info',
           title: 'Low-Pay / High-Exposure Gig',
           detail: `The gig pays poorly ($${input.financialOffered}) but offers significant exposure (${input.exposureEstimate} estimated reach).`,
           confidence: 'high'
         });
         recommendations.push({
           id: `rec_show_merch_${input.id}`,
           domain: this.domain,
           priority: 'medium',
           title: 'Leverage Merch for Show',
           detail: 'Since the upfront pay is low, ensure a merch booth is set up to capture value from the high exposure.',
           ownerAgentId: 'marketing',
           approvalRequired: false
         });
         flags.push('exposure_play');
      }
    }

    // 2. brand-mismatch sponsorship warning
    if (input.type === 'sponsorship' || input.type === 'brand_deal') {
      if (input.brandAlignmentScore < 5) {
         findings.push({
           id: `finding_brand_mismatch_${input.id}`,
           domain: this.domain,
           severity: 'high',
           title: 'Brand Mismatch Warning',
           detail: `This sponsorship has a low brand alignment score (${input.brandAlignmentScore}/10). Proceeding could damage long-term brand equity.`,
           confidence: 'high'
         });
         approvalGates.push({
           id: `gate_brand_mismatch_${input.id}`,
           label: 'Brand Mismatch Override',
           reason: 'Sponsorship has poor brand alignment. Requires manual override to accept.',
           requiredFor: 'acceptance',
           riskTier: 'approval'
         });
         flags.push('brand_risk');
      }
    }

    // 3. high-ROI grant priority
    if (input.type === 'grant') {
       if (input.financialOffered > 0 && input.financialCost <= input.financialOffered * 0.1) {
         findings.push({
           id: `finding_high_roi_grant_${input.id}`,
           domain: this.domain,
           severity: 'low',
           title: 'High-ROI Grant Opportunity',
           detail: `This grant offers $${input.financialOffered} with very low application/fulfillment cost ($${input.financialCost}).`,
           confidence: 'high'
         });
         recommendations.push({
           id: `rec_grant_priority_${input.id}`,
           domain: this.domain,
           priority: 'high',
           title: 'Prioritize Grant Application',
           detail: 'This is a high-ROI opportunity. Fast-track the application process.',
           ownerAgentId: 'generalist',
           approvalRequired: false
         });
         flags.push('high_priority');
       }
    }

    if (netFinancial < 0 && input.exposureEstimate < 1000 && input.strategicValueScore < 5) {
       findings.push({
         id: `finding_net_negative_${input.id}`,
         domain: this.domain,
         severity: 'high',
         title: 'Net Negative Opportunity',
         detail: `This opportunity costs more ($${input.financialCost}) than it pays ($${input.financialOffered}), with negligible exposure or strategic upside.`,
         confidence: 'high'
       });
       flags.push('net_negative');
    }

    let financialPoints = 0;
    if (netFinancial > 1000) financialPoints = 30;
    else if (netFinancial > 0) financialPoints = 20;
    else if (netFinancial === 0) financialPoints = 10;
    else financialPoints = 0;
    
    const brandPoints = (input.brandAlignmentScore / 10) * 30;
    const strategicPoints = (input.strategicValueScore / 10) * 40;
    
    const overallScoreValue = Math.min(100, Math.max(0, Math.round(financialPoints + brandPoints + strategicPoints)));

    let viability: OpportunityOutput['viability'] = 'maybe';
    if (flags.includes('net_negative') || flags.includes('brand_risk')) {
      viability = flags.includes('net_negative') && flags.includes('brand_risk') ? 'hard_pass' : 'no';
    } else if (overallScoreValue >= 80 || flags.includes('high_priority')) {
      viability = 'strong_yes';
    } else if (overallScoreValue >= 60) {
      viability = 'yes';
    }

    const scores: HarnessScore[] = [
      {
        label: 'Overall Opportunity Score',
        value: overallScoreValue,
        max: 100,
        status: overallScoreValue >= 60 ? 'good' : (overallScoreValue >= 40 ? 'watch' : 'blocked'),
        rationale: 'Weighted score based on financial return (30%), brand alignment (30%), and strategic value (40%).'
      },
      {
        label: 'Brand Alignment',
        value: input.brandAlignmentScore,
        max: 10,
        status: input.brandAlignmentScore >= 7 ? 'good' : (input.brandAlignmentScore >= 5 ? 'watch' : 'blocked'),
        rationale: 'Measures how well this opportunity aligns with the core artist brand.'
      },
      {
        label: 'Strategic Value',
        value: input.strategicValueScore,
        max: 10,
        status: input.strategicValueScore >= 7 ? 'good' : (input.strategicValueScore >= 5 ? 'watch' : 'blocked'),
        rationale: 'Measures long-term career advancement potential.'
      }
    ];

    const inputRefs: HarnessInputRef[] = [
      {
        type: 'project',
        id: input.id,
        label: `Opportunity: ${input.title}`,
        url: input.url
      }
    ];

    agentBriefs.push({
      agentId: 'generalist',
      departmentId: 'management',
      brief: `Evaluated ${input.type} opportunity "${input.title}". Viability: ${viability}. Score: ${overallScoreValue}/100.`,
      inputs: [input.id],
      blockedBy: approvalGates.map(g => g.id)
    });

    if (flags.includes('brand_risk')) {
      agentBriefs.push({
        agentId: 'marketing',
        departmentId: 'marketing',
        brief: `Brand risk flagged for ${input.type} "${input.title}". Alignment score is low (${input.brandAlignmentScore}/10). Needs review before proceeding.`,
        inputs: [input.id]
      });
    }

    if (input.financialCost > 0 || netFinancial < 0) {
      agentBriefs.push({
        agentId: 'finance',
        departmentId: 'finance',
        brief: `Opportunity "${input.title}" requires an upfront cost of $${input.financialCost}. Expected return: $${input.financialOffered}.`,
        inputs: [input.id]
      });
    }

    return createHarnessRun<OpportunityOutput>({
      schemaVersion: 1,
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
        'Financial values are estimated and may change.',
        'Exposure estimate is based on provided reach metrics.'
      ],
      confidence: 0.8,
      output: {
        roiScore,
        overallScore: overallScoreValue,
        viability,
        flags
      }
    });
  }
}
