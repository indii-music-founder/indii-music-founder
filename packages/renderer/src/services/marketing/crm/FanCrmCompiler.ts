import {
  HarnessCompiler,
  HarnessContext,
  HarnessRun,
  createHarnessRun,
  HarnessFinding,
  HarnessRecommendation,
  HarnessApprovalGate,
  HarnessAgentBrief,
} from '@indii/shared';

export interface FanData {
  id: string;
  location: string;
  lifetimeValue: number;
  engagementRate: number; // 0 to 1
  daysSinceLastPurchase: number;
  ticketRequests: number;
}

export interface FanCrmInput {
  fans: FanData[];
  vipLtvThreshold: number;
}

export interface FanCrmOutput {
  superfans: string[];
  churnRisks: string[];
  tourDemandSignals: Record<string, number>;
}

export class FanCrmCompiler implements HarnessCompiler<FanCrmInput, FanCrmOutput> {
  readonly domain = 'fan_crm';

  compile(input: FanCrmInput, ctx: HarnessContext): HarnessRun<FanCrmOutput> {
    const superfans: string[] = [];
    const churnRisks: string[] = [];
    const tourDemandSignals: Record<string, number> = {};

    const findings: HarnessFinding[] = [];
    const recommendations: HarnessRecommendation[] = [];
    const approvalGates: HarnessApprovalGate[] = [];
    const agentBriefs: HarnessAgentBrief[] = [];

    // Process fans
    for (const fan of input.fans) {
      // Superfan logic
      if (fan.lifetimeValue >= input.vipLtvThreshold && fan.engagementRate > 0.7) {
        superfans.push(fan.id);
      }

      // Churn risk
      if (fan.daysSinceLastPurchase > 180 && fan.lifetimeValue > 0) {
        churnRisks.push(fan.id);
      }

      // Tour demand
      if (fan.ticketRequests > 0 && fan.location) {
        tourDemandSignals[fan.location] = (tourDemandSignals[fan.location] || 0) + fan.ticketRequests;
      }
    }

    if (superfans.length > 0) {
      recommendations.push({
        id: `rec_vip_merch_${Date.now()}`,
        domain: this.domain,
        priority: 'high',
        title: 'VIP Merchandise Offer',
        detail: `Trigger VIP treatment flow for ${superfans.length} superfans.`,
        ownerAgentId: 'agent_marketing',
        approvalRequired: true,
      });

      approvalGates.push({
        id: `gate_vip_offer_${Date.now()}`,
        label: 'VIP Merchandise Release',
        reason: 'Requires approval to send exclusive merch offers to high-LTV fans.',
        requiredFor: 'vip_merch_campaign',
        riskTier: 'approval',
      });

      agentBriefs.push({
        agentId: 'agent_marketing',
        brief: `Design a VIP merch campaign for ${superfans.length} superfans.`,
        inputs: ['fan_crm_output'],
      });
    }

    if (churnRisks.length > 0) {
      recommendations.push({
        id: `rec_churn_winback_${Date.now()}`,
        domain: this.domain,
        priority: 'medium',
        title: 'Churn Win-back Campaign',
        detail: `Retargeting flow for ${churnRisks.length} at-risk fans.`,
        ownerAgentId: 'agent_marketing',
        approvalRequired: false,
      });
    }

    const highDemandRegions = Object.entries(tourDemandSignals)
      .filter(([_, demand]) => demand >= 100)
      .map(([region]) => region);

    if (highDemandRegions.length > 0) {
      findings.push({
        id: `find_tour_demand_${Date.now()}`,
        domain: this.domain,
        severity: 'info',
        title: 'High Regional Tour Demand',
        detail: `Strong ticket request signals detected in: ${highDemandRegions.join(', ')}`,
        confidence: 'high',
      });
    }

    const output: FanCrmOutput = {
      superfans,
      churnRisks,
      tourDemandSignals,
    };

    return createHarnessRun<FanCrmOutput>({
      schemaVersion: 1,
      userId: ctx.userId,
      projectId: ctx.projectId,
      domain: this.domain,
      inputRefs: [{ type: 'manual', label: 'Fan CRM Data Batch' }],
      scores: [
        {
          label: 'Superfan Ratio',
          value: superfans.length,
          max: input.fans.length > 0 ? input.fans.length : 1,
          status: superfans.length > 0 ? 'good' : 'watch',
          rationale: 'Health of high-LTV segment.',
        },
      ],
      findings,
      recommendations,
      costLines: [],
      legalBasis: [],
      evidenceRefs: [],
      agentBriefs,
      approvalGates,
      assumptions: ['Assuming provided fan data is current and accurate.'],
      confidence: 0.9,
      output,
    });
  }
}
