import {
  HarnessCompiler,
  HarnessContext,
  HarnessRun,
  HarnessDomain,
  createHarnessRun,
  HarnessApprovalGate,
  HarnessRecommendation,
  HarnessAgentBrief,
  HarnessScore,
  HarnessFinding,
  HarnessCostLine
} from '@indii/shared';

export interface MarketingCampaign {
  id: string;
  name: string;
  channels: string[];
  budget: number;
  expectedConversionRate: number;
  brandAlignmentScore: number; // 0-100
  organicReachEstimate: number;
}

export interface MarketingGrowthInput {
  totalBudgetLimit: number;
  campaigns: MarketingCampaign[];
  testMatrix: Record<string, string[]>;
  contentCalendarId: string;
}

export interface MarketingGrowthOutput {
  totalAdSpend: number;
  averageConversionRate: number;
  totalOrganicReach: number;
  channelsMixed: string[];
  campaignOptimizations: string[];
}

export class MarketingGrowthCompiler implements HarnessCompiler<MarketingGrowthInput, MarketingGrowthOutput> {
  readonly domain: HarnessDomain = 'marketing_growth';

  compile(input: MarketingGrowthInput, ctx: HarnessContext): HarnessRun<MarketingGrowthOutput> {
    const findings: HarnessFinding[] = [];
    const recommendations: HarnessRecommendation[] = [];
    const approvalGates: HarnessApprovalGate[] = [];
    const agentBriefs: HarnessAgentBrief[] = [];
    const scores: HarnessScore[] = [];
    const costLines: HarnessCostLine[] = [];

    let totalAdSpend = 0;
    let sumConversionRate = 0;
    let totalOrganicReach = 0;
    const channels = new Set<string>();
    
    // Process campaigns
    for (const campaign of input.campaigns) {
      totalAdSpend += campaign.budget;
      sumConversionRate += campaign.expectedConversionRate;
      totalOrganicReach += campaign.organicReachEstimate;
      campaign.channels.forEach(ch => channels.add(ch));

      costLines.push({
        id: `cost_ad_${campaign.id}`,
        userId: ctx.userId,
        amount: campaign.budget,
        currency: 'USD',
        category: 'Ad Spend',
        costType: 'cash_expense',
        sourceDomain: this.domain,
        projectId: ctx.projectId,
        reimbursable: false,
        confidence: 'high',
        notes: `Budget for campaign: ${campaign.name}`,
        createdAt: new Date().toISOString()
      });

      if (campaign.brandAlignmentScore < 70) {
        findings.push({
          id: `off_brand_${campaign.id}`,
          domain: this.domain,
          severity: 'high',
          title: 'Off-Brand Asset Warning',
          detail: `Campaign '${campaign.name}' has a low brand alignment score (${campaign.brandAlignmentScore}).`,
          confidence: 'high'
        });
      }

      if (campaign.expectedConversionRate >= 5) {
        recommendations.push({
          id: `amp_${campaign.id}`,
          domain: this.domain,
          priority: 'high',
          title: 'High-Conversion Channel Amplification',
          detail: `Campaign '${campaign.name}' has a strong conversion rate. Recommend amplifying spend on channels: ${campaign.channels.join(', ')}`,
          ownerAgentId: 'marketing',
          approvalRequired: true,
          nextAction: 'Reallocate budget to this campaign'
        });
      }
    }

    const avgConversionRate = input.campaigns.length > 0 ? sumConversionRate / input.campaigns.length : 0;

    // Budget overrun check
    if (totalAdSpend > input.totalBudgetLimit) {
      approvalGates.push({
        id: 'budget_overrun_gate',
        label: 'Budget Overrun Approval',
        reason: `Total ad spend (${totalAdSpend}) exceeds budget limit (${input.totalBudgetLimit}).`,
        requiredFor: 'Execution of campaigns',
        riskTier: 'approval'
      });
      findings.push({
        id: 'budget_overrun_finding',
        domain: this.domain,
        severity: 'critical',
        title: 'Budget Overrun',
        detail: `Spend of ${totalAdSpend} exceeds limit of ${input.totalBudgetLimit}.`,
        confidence: 'high'
      });
    }

    agentBriefs.push({
      agentId: 'marketing',
      departmentId: 'growth',
      brief: `Execute ${input.campaigns.length} campaigns across ${channels.size} channels with total budget ${totalAdSpend}.`,
      inputs: ['campaigns', 'testMatrix', 'contentCalendarId'],
      blockedBy: totalAdSpend > input.totalBudgetLimit ? ['budget_overrun_gate'] : []
    });

    agentBriefs.push({
      agentId: 'brand',
      brief: `Review campaigns for brand alignment.`,
      inputs: ['campaigns']
    });

    agentBriefs.push({
      agentId: 'social',
      brief: `Distribute organic content via calendar ${input.contentCalendarId}. Estimated reach: ${totalOrganicReach}.`,
      inputs: ['contentCalendarId']
    });

    agentBriefs.push({
      agentId: 'publicist',
      brief: `Coordinate PR push with the content calendar ${input.contentCalendarId}.`,
      inputs: ['contentCalendarId']
    });

    const averageBrandScore = input.campaigns.length > 0 ? input.campaigns.reduce((acc, c) => acc + c.brandAlignmentScore, 0) / input.campaigns.length : 0;

    scores.push({
      label: 'Brand Alignment',
      value: averageBrandScore,
      max: 100,
      status: (input.campaigns.every(c => c.brandAlignmentScore >= 70)) ? 'good' : 'watch',
      rationale: 'Average of campaign brand alignment scores.'
    });

    const output: MarketingGrowthOutput = {
      totalAdSpend,
      averageConversionRate: avgConversionRate,
      totalOrganicReach,
      channelsMixed: Array.from(channels),
      campaignOptimizations: recommendations.filter(r => r.title === 'High-Conversion Channel Amplification').map(r => r.detail)
    };

    return createHarnessRun<MarketingGrowthOutput>({
      schemaVersion: 1,
      userId: ctx.userId,
      projectId: ctx.projectId,
      domain: this.domain,
      inputRefs: [
        { type: 'manual', id: input.contentCalendarId, label: 'Content Calendar' }
      ],
      scores,
      findings,
      recommendations,
      costLines,
      legalBasis: [],
      evidenceRefs: [],
      agentBriefs,
      approvalGates,
      assumptions: ['Conversion rates hold steady across the duration.'],
      confidence: 0.85,
      output
    });
  }
}
