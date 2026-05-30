import type { Expense } from '@/modules/finance/schemas';
import type { BusinessActivityEvent, HarnessCostLine, HarnessCostSummary } from './types';
import { activityValueService } from './ActivityValueService';

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

export class HiddenCostHarnessService {
  buildExpenseCostLine(expense: Expense): HarnessCostLine {
    return {
      id: `cost_expense_${expense.id ?? Date.now()}`,
      userId: expense.userId,
      amount: expense.amount,
      currency: 'USD',
      category: expense.category,
      costType: 'cash_expense',
      sourceDomain: 'finance',
      expenseId: expense.id,
      taxTreatment: inferTaxTreatment(expense.category),
      reimbursable: false,
      confidence: 'high',
      notes: expense.description || `Cash expense from ${expense.vendor}`,
      createdAt: new Date().toISOString(),
    };
  }

  buildMileageCostLine(input: MileageTripInput): HarnessCostLine {
    return {
      id: `cost_mileage_${Date.now()}`,
      userId: input.userId,
      amount: roundCurrency(input.miles * input.mileageRate),
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

  buildGuitarStoreScenario(input: {
    userId: string;
    projectId?: string;
    vendor?: string;
    equipmentCost: number;
    milesRoundTrip: number;
    driveMinutes: number;
    hourlyRate: number;
    mileageRate: number;
  }): HarnessCostLine[] {
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
      summary.total = roundCurrency(summary.total + line.amount);
      summary.byType[line.costType] = roundCurrency((summary.byType[line.costType] ?? 0) + line.amount);
      summary.byDomain[line.sourceDomain] = roundCurrency((summary.byDomain[line.sourceDomain] ?? 0) + line.amount);
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
}

export const hiddenCostHarnessService = new HiddenCostHarnessService();

function inferTaxTreatment(category: string): string {
  const normalized = category.toLowerCase();
  if (normalized.includes('travel')) return 'travel_expense_review';
  if (normalized.includes('equipment')) return 'equipment_or_consumable_review';
  if (normalized.includes('marketing')) return 'marketing_expense_review';
  if (normalized.includes('software')) return 'software_subscription_review';
  return 'business_expense_review';
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

