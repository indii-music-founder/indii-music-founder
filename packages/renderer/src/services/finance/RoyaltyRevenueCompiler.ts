import { HarnessCompiler, HarnessContext } from '../business-harness/HarnessCompiler';
import {
  HarnessRun,
  HarnessScore,
  HarnessFinding,
  HarnessRecommendation,
  HarnessApprovalGate,
  HarnessInputRef,
  createHarnessRun,
  HarnessAgentBrief,
} from '../business-harness/types';
import { waterfallEngine, WaterfallConfig, WaterfallResult } from './WaterfallEngine';
import type { RoyaltyPayout } from './RoyaltyPayoutService';
import type { RevenueReportItem } from './RoyaltyService';
import type { RevenueStats } from '../revenue/schema';

export interface RoyaltyStatementImport {
  id: string;
  source: string;
  items: RevenueReportItem[];
  imported: boolean;
}

export interface RoyaltyRevenueInput {
  projectId: string;
  projectName: string;
  revenueStats: Partial<RevenueStats>;
  unpaidPayouts: RoyaltyPayout[];
  statements: RoyaltyStatementImport[];
  waterfallConfig: WaterfallConfig;
}

export interface RoyaltyRevenueOutput {
  totalGrossRevenue: number;
  totalUnpaidBalance: number;
  pendingStatementCount: number;
  waterfallResult: WaterfallResult;
  projectRoiPercentage: number;
  isRecouped: boolean;
}

export class RoyaltyRevenueCompiler implements HarnessCompiler<RoyaltyRevenueInput, RoyaltyRevenueOutput> {
  readonly domain = 'royalty_revenue';

  compile(input: RoyaltyRevenueInput, ctx: HarnessContext): HarnessRun<RoyaltyRevenueOutput> {
    const findings: HarnessFinding[] = [];
    const recommendations: HarnessRecommendation[] = [];
    const scores: HarnessScore[] = [];
    const approvalGates: HarnessApprovalGate[] = [];
    const agentBriefs: HarnessAgentBrief[] = [];

    // Calculate Gross Revenue from RevenueStats
    const totalGrossRevenue = input.revenueStats?.totalRevenue || 0;

    // Run Waterfall Calculation
    const waterfallResult = waterfallEngine.calculate(totalGrossRevenue, input.waterfallConfig);

    // Calculate Unpaid Balances
    let totalUnpaidBalance = 0;
    input.unpaidPayouts.forEach((payout) => {
      totalUnpaidBalance += payout.amount;
      findings.push({
        id: `unpaid_payout_${payout.id || payout.artistId}`,
        domain: this.domain,
        severity: 'medium',
        title: 'Unpaid Royalty Balance',
        detail: `Payee ${payout.artistName} has an unpaid balance of $${payout.amount} for period ${payout.period}.`,
        confidence: 'high',
      });
    });

    if (totalUnpaidBalance > 0) {
      recommendations.push({
        id: 'process_unpaid_royalties',
        domain: this.domain,
        priority: 'high',
        title: 'Process Unpaid Royalties',
        detail: `Process pending payouts to clear $${totalUnpaidBalance} in unpaid balances.`,
        ownerAgentId: 'finance_agent',
        approvalRequired: true,
      });

      approvalGates.push({
        id: 'approve_royalty_payouts',
        label: 'Approve Royalty Payouts',
        reason: `Authorize payment of $${totalUnpaidBalance} to payees.`,
        requiredFor: 'Distributing unpaid royalty balances.',
        riskTier: 'approval',
      });
    }

    // Process Statements
    let pendingStatementCount = 0;
    let pendingRevenueItems = 0;
    input.statements.forEach((stmt) => {
      if (!stmt.imported) {
        pendingStatementCount++;
        pendingRevenueItems += stmt.items.length;
        findings.push({
          id: `pending_statement_${stmt.id}`,
          domain: this.domain,
          severity: 'info',
          title: 'Pending Statement Import',
          detail: `Statement ${stmt.id} from source ${stmt.source} has not been imported. It contains ${stmt.items.length} items.`,
          confidence: 'high',
        });
      }
    });

    if (pendingStatementCount > 0) {
      agentBriefs.push({
        agentId: 'finance_agent',
        brief: `Import and process ${pendingStatementCount} pending statements containing ${pendingRevenueItems} uningested items.`,
        inputs: ['Statements list', 'Revenue mapping'],
        blockedBy: [],
      });
    }

    // ROI and Recoupment
    const recoupableExpenses = input.waterfallConfig.recoupableExpenses;
    const projectRoiPercentage = recoupableExpenses > 0 ? (totalGrossRevenue / recoupableExpenses) * 100 : 0;
    const isRecouped = waterfallResult.remainingRecoupable <= 0 && recoupableExpenses > 0;

    if (recoupableExpenses > 0 && !isRecouped) {
      scores.push({
        label: 'Recoupment Status',
        value: waterfallResult.recoupedAmount,
        max: recoupableExpenses,
        status: 'watch',
        rationale: `Project is $${waterfallResult.remainingRecoupable} away from fully recouping.`,
      });
    } else if (recoupableExpenses > 0 && isRecouped) {
      scores.push({
        label: 'Recoupment Status',
        value: recoupableExpenses,
        max: recoupableExpenses,
        status: 'good',
        rationale: `Project is fully recouped.`,
      });
    }

    // Financial Health Score
    scores.push({
      label: 'Statement Processing',
      value: input.statements.length - pendingStatementCount,
      max: input.statements.length,
      status: pendingStatementCount > 0 ? 'watch' : 'good',
      rationale: pendingStatementCount > 0 ? `${pendingStatementCount} statements need processing.` : 'All statements processed.',
    });

    const output: RoyaltyRevenueOutput = {
      totalGrossRevenue,
      totalUnpaidBalance,
      pendingStatementCount,
      waterfallResult,
      projectRoiPercentage,
      isRecouped,
    };

    const inputRefs: HarnessInputRef[] = [
      {
        type: 'project',
        id: input.projectId,
        label: input.projectName,
      },
    ];

    return createHarnessRun<RoyaltyRevenueOutput>({
      userId: ctx.userId,
      projectId: ctx.projectId || input.projectId,
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
        'Revenue by source accurately reflects all un-waterfalled gross revenue.',
        'Recoupable expenses correctly reflect the total remaining amount to recoup before applying current revenue.'
      ],
      confidence: 1.0,
      output,
      schemaVersion: 1,
    });
  }
}
