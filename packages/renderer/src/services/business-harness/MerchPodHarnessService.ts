import type { HarnessCostLine, HarnessRun } from './types';
import { createHarnessRun } from './types';

export interface MerchPodSkuInput {
  productType: string;
  provider: 'printful' | 'printify' | 'gooten' | 'internal';
  baseCost: number;
  shippingEstimate: number;
  targetRetailPrice: number;
  expectedUnits: number;
  legalFlag?: string;
}

export interface MerchPodHarnessInput {
  userId: string;
  projectId?: string;
  releaseId?: string;
  dropGoal: 'release_drop' | 'tour_table' | 'limited_drop' | 'fan_club' | 'evergreen';
  skus: MerchPodSkuInput[];
}

export interface MerchPodRecommendation {
  productType: string;
  provider: string;
  retailPrice: number;
  landedCost: number;
  grossMargin: number;
  breakEvenUnits: number;
  recommendation: 'approve_sample' | 'raise_price' | 'legal_review' | 'reject_margin';
  rationale: string;
}

export interface MerchPodHarnessOutput {
  dropGoal: MerchPodHarnessInput['dropGoal'];
  recommendations: MerchPodRecommendation[];
  preferredProvider?: string;
}

export class MerchPodHarnessService {
  compile(input: MerchPodHarnessInput): HarnessRun<MerchPodHarnessOutput> {
    const recommendations = input.skus.map(scoreSku);
    const preferred = recommendations
      .filter(rec => rec.recommendation !== 'legal_review' && rec.recommendation !== 'reject_margin')
      .sort((a, b) => b.grossMargin - a.grossMargin)[0];
    const costLines: HarnessCostLine[] = input.skus.map((sku, index) => ({
      id: `merch_cost_${Date.now()}_${index}`,
      userId: input.userId,
      amount: roundCurrency((sku.baseCost + sku.shippingEstimate) * sku.expectedUnits),
      currency: 'USD',
      category: 'Merchandise',
      costType: 'inventory_cost',
      sourceDomain: 'merch_pod',
      projectId: input.projectId,
      releaseId: input.releaseId,
      taxTreatment: 'inventory_or_cogs_review',
      reimbursable: false,
      confidence: 'medium',
      notes: `${sku.expectedUnits} expected ${sku.productType} units via ${sku.provider}.`,
      createdAt: new Date().toISOString(),
    }));

    return createHarnessRun<MerchPodHarnessOutput>({
      userId: input.userId,
      projectId: input.projectId,
      domain: 'merch_pod',
      inputRefs: [{ type: 'manual', label: input.dropGoal }],
      scores: [{
        label: 'Merch POD Margin',
        value: preferred ? Math.round(preferred.grossMargin * 100) : 0,
        max: 100,
        status: preferred && preferred.grossMargin >= 0.35 ? 'good' : 'watch',
        rationale: preferred ? `${preferred.productType} via ${preferred.provider} has strongest margin.` : 'No SKU cleared margin/legal checks.',
      }],
      findings: input.skus
        .filter(sku => sku.legalFlag)
        .map((sku, index) => ({
          id: `merch_legal_${index}`,
          domain: 'merch_pod',
          severity: 'high',
          title: `Legal review needed for ${sku.productType}`,
          detail: sku.legalFlag!,
          confidence: 'medium',
        })),
      recommendations: recommendations.map((rec, index) => ({
        id: `merch_rec_${index}`,
        domain: 'merch_pod',
        priority: rec.recommendation === 'legal_review' || rec.recommendation === 'reject_margin' ? 'high' : 'medium',
        title: `${rec.productType}: ${rec.recommendation.replaceAll('_', ' ')}`,
        detail: rec.rationale,
        ownerAgentId: rec.recommendation === 'legal_review' ? 'legal' : 'merchandise',
        approvalRequired: true,
      })),
      costLines,
      legalBasis: [],
      evidenceRefs: [],
      agentBriefs: [{
        agentId: 'merchandise',
        departmentId: 'merchandise',
        brief: 'Prepare POD product plan, mockups, samples, pricing, and drop calendar from cleared recommendations.',
        inputs: recommendations.map(rec => `${rec.productType}: ${rec.recommendation}`),
      }, {
        agentId: 'finance',
        departmentId: 'finance',
        brief: 'Review inventory cost, margin, break-even, and tax treatment.',
        inputs: costLines.map(line => line.notes),
      }],
      approvalGates: [{
        id: 'pod_paid_action_approval',
        label: 'Paid POD action approval',
        reason: 'Samples, manufacturing, storefront publishing, or paid orders can spend money or create public-facing products.',
        requiredFor: 'sample order, manufacture request, or storefront publish',
        riskTier: 'approval',
      }],
      assumptions: [
        'Provider prices are treated as estimates until live POD provider quote is fetched.',
        'No sample, order, or storefront publish is executed by this harness.',
      ],
      confidence: preferred ? 0.78 : 0.45,
      output: {
        dropGoal: input.dropGoal,
        recommendations,
        preferredProvider: preferred?.provider,
      },
    });
  }
}

export const merchPodHarnessService = new MerchPodHarnessService();

function scoreSku(sku: MerchPodSkuInput): MerchPodRecommendation {
  const landedCost = roundCurrency(sku.baseCost + sku.shippingEstimate);
  const grossMargin = sku.targetRetailPrice > 0 ? roundCurrency((sku.targetRetailPrice - landedCost) / sku.targetRetailPrice) : 0;
  const breakEvenUnits = Math.max(1, Math.ceil(100 / Math.max(1, sku.targetRetailPrice - landedCost)));
  const recommendation = sku.legalFlag
    ? 'legal_review'
    : grossMargin < 0.25
      ? 'reject_margin'
      : grossMargin < 0.4
        ? 'raise_price'
        : 'approve_sample';
  return {
    productType: sku.productType,
    provider: sku.provider,
    retailPrice: sku.targetRetailPrice,
    landedCost,
    grossMargin,
    breakEvenUnits,
    recommendation,
    rationale: sku.legalFlag
      ? sku.legalFlag
      : `Estimated landed cost is $${landedCost}; margin is ${Math.round(grossMargin * 100)}%.`,
  };
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

