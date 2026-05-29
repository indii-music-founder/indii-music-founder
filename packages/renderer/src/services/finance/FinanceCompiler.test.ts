import { describe, expect, it } from 'vitest';
import { financeCompiler } from './FinanceCompiler';

describe('FinanceCompiler', () => {
  it('aggregates receipt -> expense -> cost line properly', () => {
    const run = financeCompiler.compile({
      userId: 'user-a',
      expenses: [{
        id: 'exp-1',
        userId: 'user-a',
        vendor: 'Sweetwater',
        description: 'New cables',
        amount: 250,
        category: 'Equipment',
        date: '2026-05-28'
      }],
      receipts: [{
        vendor: 'Guitar Center',
        amount: 14.99,
        category: 'Equipment'
      }]
    }, { userId: 'user-a' });

    expect(run.domain).toBe('finance');
    expect(run.costLines.length).toBe(2);
    expect(run.costLines.map(c => c.costType)).toEqual(['cash_expense', 'cash_expense']);
    expect(run.output.costSummary.byType.cash_expense).toBe(264.99);
  });

  it('aggregates hidden-cost summary including mileage and time value', () => {
    const run = financeCompiler.compile({
      userId: 'user-a',
      guitarStoreRuns: [{
        userId: 'user-a',
        equipmentCost: 14.99,
        milesRoundTrip: 18,
        driveMinutes: 42,
        hourlyRate: 50,
        mileageRate: 0.7,
      }]
    }, { userId: 'user-a' });

    expect(run.costLines.length).toBe(3);
    const summary = run.output.costSummary;
    expect(summary.byType.cash_expense).toBe(14.99);
    expect(summary.byType.mileage).toBe(12.6);
    expect(summary.byType.time_value).toBe(35);
    expect(summary.total).toBe(62.59);
  });

  it('aggregates royalty and recoupment into ROI calculation', () => {
    const run = financeCompiler.compile({
      userId: 'user-a',
      revenueStats: {
        totalRevenue: 500,
        sources: {
          streaming: 400,
          merch: 100,
          licensing: 0,
          social: 0
        }
      },
      expenses: [{
        userId: 'user-a',
        vendor: 'Ads',
        description: 'Facebook ads campaign',
        amount: 100,
        category: 'Marketing',
        date: '2026-05-28'
      }],
      royalties: {
        payouts: [{
          userId: 'collaborator',
          amount: 50,
          currency: 'USD',
          sourceTrackIsrc: 'USQY12600101',
          role: 'Producer',
          status: 'pending'
        }],
        recoupmentBalances: [{
          releaseId: 'rel-1',
          balance: 200,
          totalExpense: 200,
          updatedAt: null as any
        }]
      }
    }, { userId: 'user-a' });

    expect(run.output.costSummary.total).toBe(150); // 100 ad expense + 50 royalty payout
    expect(run.output.revenueSummary.total).toBe(500);
    expect(run.output.projectRoi).toBeCloseTo((500 - 150) / 150); // 350 / 150 = 2.333
    expect(run.findings.some(f => f.id === 'unrecouped_balances')).toBe(true);
  });

  it('calculates project ROI with cash and non-cash investment', () => {
    const run = financeCompiler.compile({
      userId: 'user-a',
      revenueStats: {
        totalRevenue: 200,
        sources: { streaming: 200, merch: 0, licensing: 0, social: 0 }
      },
      guitarStoreRuns: [{
        userId: 'user-a',
        equipmentCost: 50,     // cash
        milesRoundTrip: 20,    // 14 mileage
        driveMinutes: 60,      // 50 time
        hourlyRate: 50,
        mileageRate: 0.7,
      }]
    }, { userId: 'user-a' });

    const totalCosts = 50 + 14 + 50; // 114
    expect(run.output.costSummary.total).toBe(114);
    expect(run.output.projectRoi).toBeCloseTo((200 - 114) / 114);
  });
});
