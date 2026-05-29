import {
  HarnessCompiler,
  HarnessContext,
  HarnessRun,
  HarnessCostLine,
  HarnessCostSummary,
  createHarnessRun,
  BusinessActivityEvent,
  HarnessFinding,
  HarnessScore
} from '@indii/shared';
import { activityValueService } from '../business-harness/ActivityValueService';
import type { Expense } from '@/modules/finance/schemas';
import type { PayoutRecord, RecoupmentBalance } from './RoyaltyService';

export interface MileageTripInput {
  userId: string;
  miles: number;
  mileageRate: number;
  purpose: string;
  projectId?: string;
  tourId?: string;
  releaseId?: string;
  reimbursable?: boolean;
  notes?: string;
}

export interface GuitarStoreScenarioInput {
  userId: string;
  projectId?: string;
  vendor?: string;
  equipmentCost: number;
  milesRoundTrip: number;
  driveMinutes: number;
  hourlyRate: number;
  mileageRate: number;
}

export interface FinanceCompilerInput {
  userId: string;
  projectId?: string;
  
  revenueStats?: {
    totalRevenue: number;
    sources: {
      streaming: number;
      merch: number;
      licensing: number;
      social: number;
    }
  };
  expenses?: Expense[];
  receipts?: {
    vendor?: string;
    amount?: number;
    category?: string;
    date?: string;
    description?: string;
  }[];
  mileageTrips?: MileageTripInput[];
  guitarStoreRuns?: GuitarStoreScenarioInput[];
  royalties?: {
    payouts?: PayoutRecord[];
    recoupmentBalances?: RecoupmentBalance[];
  };
}

export interface FinanceCompilerOutput {
  projectRoi: number | null;
  costSummary: HarnessCostSummary;
  revenueSummary: {
    total: number;
    sources: Record<string, number>;
  };
}

export class FinanceCompiler implements HarnessCompiler<FinanceCompilerInput, FinanceCompilerOutput> {
  readonly domain = 'finance';

  compile(input: FinanceCompilerInput, ctx: HarnessContext): HarnessRun<FinanceCompilerOutput> {
    const costLines: HarnessCostLine[] = [];

    // Process Expenses
    if (input.expenses) {
      input.expenses.forEach(expense => {
        costLines.push(this.buildExpenseCostLine(expense));
      });
    }

    // Process Receipts (treat as expenses if not already in expenses)
    if (input.receipts) {
      input.receipts.forEach((receipt, index) => {
        costLines.push(this.buildExpenseCostLine({
          userId: input.userId,
          vendor: receipt.vendor || 'Unknown Receipt Vendor',
          amount: receipt.amount || 0,
          category: receipt.category || 'Other',
          date: receipt.date || new Date().toISOString().slice(0, 10),
          description: receipt.description || 'From receipt scan',
        }, `receipt_${index}`));
      });
    }

    // Process Mileage Trips
    if (input.mileageTrips) {
      input.mileageTrips.forEach(trip => {
        costLines.push(this.buildMileageCostLine(trip));
      });
    }

    // Process Guitar Store Runs
    if (input.guitarStoreRuns) {
      input.guitarStoreRuns.forEach(run => {
        costLines.push(...this.buildGuitarStoreScenario(run));
      });
    }

    // Process Royalties/Recoupment
    if (input.royalties?.payouts) {
      input.royalties.payouts.forEach((payout, idx) => {
        costLines.push({
          id: `cost_royalty_payout_${Date.now()}_${idx}`,
          userId: input.userId,
          amount: payout.amount,
          currency: payout.currency,
          category: 'Royalty',
          costType: 'royalty_obligation',
          sourceDomain: 'royalty_revenue',
          projectId: input.projectId,
          reimbursable: false,
          confidence: 'high',
          notes: `Royalty payout to ${payout.role} (${payout.userId})`,
          createdAt: new Date().toISOString(),
        });
      });
    }

    const costSummary = this.summarizeCostLines(costLines);
    
    let totalRevenue = 0;
    const revenueSources: Record<string, number> = {
      streaming: 0,
      merch: 0,
      licensing: 0,
      social: 0,
    };

    if (input.revenueStats) {
      totalRevenue = input.revenueStats.totalRevenue;
      revenueSources.streaming = input.revenueStats.sources.streaming;
      revenueSources.merch = input.revenueStats.sources.merch;
      revenueSources.licensing = input.revenueStats.sources.licensing;
      revenueSources.social = input.revenueStats.sources.social;
    }

    const projectRoi = costSummary.total > 0 
      ? (totalRevenue - costSummary.total) / costSummary.total 
      : (totalRevenue > 0 ? Infinity : null);

    const findings: HarnessFinding[] = [];
    if (costSummary.byType.time_value > totalRevenue) {
       findings.push({
         id: 'high_time_value_cost',
         domain: 'finance',
         severity: 'medium',
         title: 'High Time Value Cost',
         detail: 'Your time investment currently exceeds the project revenue.',
         confidence: 'high',
       });
    }

    const scores: HarnessScore[] = [];

    if (projectRoi !== null) {
      scores.push({
        label: 'Project ROI',
        value: projectRoi >= 0 ? 100 : Math.max(0, 100 + (projectRoi * 100)),
        max: 100,
        status: projectRoi >= 0 ? 'good' : (projectRoi < -0.5 ? 'blocked' : 'watch'),
        rationale: projectRoi >= 0 ? 'Project is profitable.' : 'Project is running at a loss.',
      });
    }

    if (input.royalties?.recoupmentBalances) {
      const unrecouped = input.royalties.recoupmentBalances.filter(r => r.balance > 0);
      if (unrecouped.length > 0) {
        findings.push({
          id: 'unrecouped_balances',
          domain: 'finance',
          severity: 'info',
          title: 'Unrecouped Balances',
          detail: `There are ${unrecouped.length} unrecouped balances remaining before full profit split.`,
          confidence: 'high',
        });
      }
    }

    const approvalGates: import('@indii/shared').HarnessApprovalGate[] = [];
    if (projectRoi !== null && projectRoi < 0) {
      approvalGates.push({
        id: 'negative_roi_spend_approval',
        label: 'Spend money with negative ROI',
        reason: 'The project is currently operating at a loss. Further expenditures should be approved.',
        requiredFor: 'spend money',
        riskTier: 'approval',
      });
    }

    return createHarnessRun<FinanceCompilerOutput>({
      schemaVersion: 1,
      userId: ctx.userId,
      projectId: ctx.projectId,
      domain: this.domain,
      inputRefs: [],
      scores,
      findings,
      recommendations: [],
      costLines,
      legalBasis: [],
      evidenceRefs: [],
      agentBriefs: [
        {
          agentId: 'finance',
          departmentId: 'finance',
          brief: 'Process ROI, hidden costs, and royalty recoupment.',
          inputs: ['revenue', 'expenses', 'time_value'],
        }
      ],
      approvalGates,
      assumptions: ['Time value is estimated based on hourly rate. ROI includes both cash and non-cash investments.'],
      confidence: 0.9,
      output: {
        projectRoi,
        costSummary,
        revenueSummary: {
          total: totalRevenue,
          sources: revenueSources,
        }
      }
    });
  }

  buildExpenseCostLine(expense: Expense, suffix?: string): HarnessCostLine {
    return {
      id: `cost_expense_${expense.id ?? Date.now()}_${suffix || '0'}`,
      userId: expense.userId,
      amount: expense.amount,
      currency: 'USD',
      category: expense.category,
      costType: 'cash_expense',
      sourceDomain: 'finance',
      expenseId: expense.id,
      taxTreatment: this.inferTaxTreatment(expense.category),
      reimbursable: false,
      confidence: 'high',
      notes: expense.description || `Cash expense from ${expense.vendor}`,
      createdAt: new Date().toISOString(),
    };
  }

  buildMileageCostLine(input: MileageTripInput): HarnessCostLine {
    return {
      id: `cost_mileage_${Date.now()}_${Math.random()}`,
      userId: input.userId,
      amount: this.roundCurrency(input.miles * input.mileageRate),
      currency: 'USD',
      category: 'Travel',
      costType: 'mileage',
      sourceDomain: 'road_travel',
      projectId: input.projectId,
      releaseId: input.releaseId,
      tourId: input.tourId,
      taxTreatment: 'business_mileage_rate_configurable_by_tax_year',
      reimbursable: input.reimbursable ?? false,
      confidence: 'medium',
      notes: input.notes ?? `${input.miles} miles for ${input.purpose}. Mileage rate must be configured by jurisdiction and tax year.`,
      createdAt: new Date().toISOString(),
    };
  }

  buildGuitarStoreScenario(input: GuitarStoreScenarioInput): HarnessCostLine[] {
    const expense = this.buildExpenseCostLine({
      userId: input.userId,
      vendor: input.vendor ?? 'Guitar Center',
      amount: input.equipmentCost,
      category: 'Equipment',
      date: new Date().toISOString().slice(0, 10),
      description: 'Consumable gear purchase tracked with travel and labor value.',
    });
    const mileage = this.buildMileageCostLine({
      userId: input.userId,
      projectId: input.projectId,
      miles: input.milesRoundTrip,
      mileageRate: input.mileageRate,
      purpose: 'equipment supply run',
      notes: 'Round-trip travel cost tied to an equipment purchase.',
    });
    const activity: BusinessActivityEvent = {
      id: `activity_supply_run_${Date.now()}`,
      userId: input.userId,
      sessionId: `session_supply_run_${Date.now()}`,
      eventType: 'travel',
      category: 'travel_labor',
      projectId: input.projectId,
      startedAt: new Date().toISOString(),
      durationMinutes: input.driveMinutes,
      activeMinutes: input.driveMinutes,
      idleMinutes: 0,
      hourlyRate: input.hourlyRate,
      notes: 'Drive time for equipment purchase tracked as artist business investment.',
      source: 'manual',
    };
    return [expense, mileage, activityValueService.buildTimeValueCostLine(activity)];
  }

  summarizeCostLines(costLines: HarnessCostLine[]): HarnessCostSummary {
    return costLines.reduce<HarnessCostSummary>((summary, line) => {
      summary.total = this.roundCurrency(summary.total + line.amount);
      summary.byType[line.costType] = this.roundCurrency((summary.byType[line.costType] ?? 0) + line.amount);
      if (line.sourceDomain) {
        summary.byDomain[line.sourceDomain] = this.roundCurrency((summary.byDomain[line.sourceDomain] ?? 0) + line.amount);
      }
      return summary;
    }, {
      total: 0,
      currency: 'USD',
      byType: {
        cash_expense: 0,
        time_value: 0,
        mileage: 0,
        asset_depreciation: 0,
        inventory_cost: 0,
        service_fee: 0,
        royalty_obligation: 0,
        opportunity_cost: 0,
        legal_protection_cost: 0,
      },
      byDomain: {},
    });
  }

  private inferTaxTreatment(category: string): string {
    const normalized = category.toLowerCase();
    if (normalized.includes('travel')) return 'travel_expense_review';
    if (normalized.includes('equipment')) return 'equipment_or_consumable_review';
    if (normalized.includes('marketing')) return 'marketing_expense_review';
    if (normalized.includes('software')) return 'software_subscription_review';
    return 'business_expense_review';
  }

  private roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
  }
}

export const financeCompiler = new FinanceCompiler();
