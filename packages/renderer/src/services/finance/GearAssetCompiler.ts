import {
  HarnessCompiler,
  HarnessContext,
  HarnessDomain,
  HarnessRun,
  createHarnessRun,
  HarnessFinding,
  HarnessRecommendation,
  HarnessCostLine,
  HarnessAgentBrief,
  HarnessApprovalGate
} from '@indii/shared';

export type GearCategory = 'instrument' | 'string' | 'cable' | 'pedal' | 'laptop' | 'software' | 'repair' | 'warranty' | 'other';
export type GearAssetType = 'durable' | 'consumable';

export interface GearAssetInput {
  assetId: string;
  name: string;
  category: GearCategory;
  assetType: GearAssetType;
  purchasePrice: number;
  currency?: string;
  purchaseDate: string;
  lifespanMonths?: number;
  warrantyExpirationDate?: string;
  projectId?: string;
  releaseId?: string;
  tourId?: string;
  sessionId?: string;
  taxCategory?: string;
  repairTargetId?: string;
}

export interface GearAssetOutput {
  monthlyDepreciation: number;
  warrantyStatus: 'active' | 'expiring_soon' | 'expired' | 'none';
  replacementStatus: 'good' | 'replace_soon' | 'overdue' | 'not_applicable';
  allocatedContexts: string[];
}

export class GearAssetCompiler implements HarnessCompiler<GearAssetInput, GearAssetOutput> {
  readonly domain: HarnessDomain = 'gear_asset';

  compile(input: GearAssetInput, ctx: HarnessContext): HarnessRun<GearAssetOutput> {
    const currency = input.currency || 'USD';
    const now = new Date();
    const purchaseDate = new Date(input.purchaseDate);
    const isValidPurchaseDate = !isNaN(purchaseDate.getTime());
    const validPurchaseDate = isValidPurchaseDate ? purchaseDate : now;
    const monthsSincePurchase = (now.getTime() - validPurchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    const safePurchasePrice = Math.max(0, input.purchasePrice || 0);

    const findings: HarnessFinding[] = [];
    const recommendations: HarnessRecommendation[] = [];
    const costLines: HarnessCostLine[] = [];
    const agentBriefs: HarnessAgentBrief[] = [];
    const approvalGates: HarnessApprovalGate[] = [];

    let monthlyDepreciation = 0;
    let replacementStatus: GearAssetOutput['replacementStatus'] = 'not_applicable';
    let warrantyStatus: GearAssetOutput['warrantyStatus'] = 'none';

    // 1. Consumable vs Durable
    if (input.assetType === 'consumable') {
      costLines.push({
        id: `cost_consume_${input.assetId}_${Date.now()}`,
        userId: ctx.userId,
        amount: safePurchasePrice,
        currency,
        category: 'gear_consumable',
        costType: 'cash_expense',
        sourceDomain: this.domain,
        projectId: input.projectId,
        releaseId: input.releaseId,
        tourId: input.tourId,
        taxTreatment: input.taxCategory || 'supplies',
        reimbursable: false,
        confidence: 'high',
        notes: `Consumable gear purchase: ${input.name}`,
        createdAt: new Date().toISOString()
      });

      findings.push({
        id: `find_consume_${input.assetId}`,
        domain: this.domain,
        severity: 'info',
        title: 'Consumable Gear Logged',
        detail: `${input.name} logged as an immediate expense.`,
        confidence: 'high'
      });
      
      if (input.category === 'string' || input.category === 'cable') {
        recommendations.push({
          id: `rec_bulk_${input.assetId}`,
          domain: this.domain,
          priority: 'low',
          title: 'Consider Bulk Purchasing',
          detail: `You buy ${input.category}s frequently. Buying in bulk might save money.`,
          ownerAgentId: 'finance_agent',
          approvalRequired: false,
        });
      }
    } else {
      // Durable Asset
      const lifespan = Math.max(1, input.lifespanMonths || 60); // Default 5 years, min 1 month
      monthlyDepreciation = safePurchasePrice / lifespan;

      costLines.push({
        id: `cost_deprec_${input.assetId}_${Date.now()}`,
        userId: ctx.userId,
        amount: monthlyDepreciation,
        currency,
        category: 'gear_depreciation',
        costType: 'asset_depreciation',
        sourceDomain: this.domain,
        projectId: input.projectId,
        releaseId: input.releaseId,
        tourId: input.tourId,
        taxTreatment: input.taxCategory || 'equipment_depreciation',
        reimbursable: false,
        confidence: 'high',
        notes: `Monthly depreciation for: ${input.name}`,
        createdAt: new Date().toISOString()
      });

      if (monthsSincePurchase >= lifespan) {
        replacementStatus = 'overdue';
      } else if (lifespan - monthsSincePurchase <= 6) {
        replacementStatus = 'replace_soon';
        findings.push({
          id: `find_replace_${input.assetId}`,
          domain: this.domain,
          severity: 'medium',
          title: 'Gear Nearing End of Life',
          detail: `${input.name} is approaching its expected replacement cycle.`,
          confidence: 'high'
        });
        approvalGates.push({
          id: `gate_replace_${input.assetId}`,
          label: `Approve budget for replacing ${input.name}`,
          reason: `Asset has reached its useful life of ${lifespan} months.`,
          requiredFor: 'purchase_replacement',
          riskTier: 'approval'
        });
      } else {
        replacementStatus = 'good';
      }
      
      if (safePurchasePrice >= 2000) {
        agentBriefs.push({
          agentId: 'finance_agent',
          departmentId: 'finance',
          brief: `High value asset ${input.name} acquired. Ensure insurance policy is updated.`,
          inputs: [input.assetId]
        });
      }
    }

    // 2. Warranties & Repairs
    if (input.category === 'repair') {
      costLines.push({
        id: `cost_repair_${input.assetId}_${Date.now()}`,
        userId: ctx.userId,
        amount: safePurchasePrice,
        currency,
        category: 'gear_repair',
        costType: 'cash_expense',
        sourceDomain: this.domain,
        projectId: input.projectId,
        releaseId: input.releaseId,
        tourId: input.tourId,
        taxTreatment: input.taxCategory || 'repairs_maintenance',
        reimbursable: false,
        confidence: 'high',
        notes: `Repair cost for: ${input.repairTargetId || 'unknown gear'}`,
        createdAt: new Date().toISOString()
      });
      findings.push({
        id: `find_repair_${input.assetId}`,
        domain: this.domain,
        severity: 'info',
        title: 'Gear Repair Logged',
        detail: `Logged repair expense for gear. Consider replacing if repairs become frequent.`,
        confidence: 'medium'
      });
    }

    if (input.warrantyExpirationDate) {
      const warrantyDate = new Date(input.warrantyExpirationDate);
      if (!isNaN(warrantyDate.getTime())) {
        const monthsUntilWarrantyExpires = (warrantyDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

        if (monthsUntilWarrantyExpires < 0) {
          warrantyStatus = 'expired';
        } else if (monthsUntilWarrantyExpires <= 2) {
          warrantyStatus = 'expiring_soon';
          findings.push({
            id: `find_warranty_${input.assetId}`,
            domain: this.domain,
            severity: 'medium',
            title: 'Warranty Expiring Soon',
            detail: `The warranty for ${input.name} expires in less than 2 months. Check for any needed repairs now.`,
            confidence: 'high'
          });
          agentBriefs.push({
            agentId: 'music_agent',
            departmentId: 'music',
            brief: `Verify condition of ${input.name} before warranty expires on ${input.warrantyExpirationDate}.`,
            inputs: [input.assetId]
          });
        } else {
          warrantyStatus = 'active';
        }
      }
    }

    // 3. Project / Tour Allocation
    const allocatedContexts: string[] = [];
    if (input.projectId) allocatedContexts.push(`project:${input.projectId}`);
    if (input.releaseId) allocatedContexts.push(`release:${input.releaseId}`);
    if (input.tourId) allocatedContexts.push(`tour:${input.tourId}`);
    if (input.sessionId) allocatedContexts.push(`session:${input.sessionId}`);

    if (allocatedContexts.length > 0) {
      findings.push({
        id: `find_alloc_${input.assetId}`,
        domain: this.domain,
        severity: 'info',
        title: 'Gear Allocated to Contexts',
        detail: `${input.name} usage mapped to ${allocatedContexts.join(', ')}`,
        confidence: 'high'
      });
    }

    const output: GearAssetOutput = {
      monthlyDepreciation,
      warrantyStatus,
      replacementStatus,
      allocatedContexts
    };

    return createHarnessRun<GearAssetOutput>({
      schemaVersion: 1,
      userId: ctx.userId,
      projectId: input.projectId,
      domain: this.domain,
      inputRefs: [{
        type: 'asset',
        id: input.assetId,
        label: input.name
      }],
      scores: [],
      findings,
      recommendations,
      costLines,
      legalBasis: [],
      evidenceRefs: [],
      agentBriefs,
      approvalGates,
      assumptions: [
        'Depreciation uses straight-line method over lifespanMonths',
        'Consumables are treated as immediate cash expense'
      ],
      confidence: 0.9,
      output
    });
  }
}
