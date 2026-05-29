import { describe, it, expect } from 'vitest';
import { RoyaltyRevenueCompiler, RoyaltyRevenueInput } from './RoyaltyRevenueCompiler';
import { Timestamp } from 'firebase/firestore';

describe('RoyaltyRevenueCompiler', () => {
  const compiler = new RoyaltyRevenueCompiler();
  const ctx = { userId: 'user_123', projectId: 'proj_abc' };

  it('handles statement import correctly', () => {
    const input: RoyaltyRevenueInput = {
      projectId: 'proj_abc',
      projectName: 'Alpha Release',
      revenueStats: {
        totalRevenue: 1500,
      },
      unpaidPayouts: [],
      statements: [
        { 
          id: 'stmt_1', 
          source: 'streaming', 
          imported: true,
          items: [{ transactionId: 't1', isrc: 'USABC123', platform: 'Spotify', territory: 'US', grossRevenue: 1000, currency: 'USD' }]
        },
        { 
          id: 'stmt_2', 
          source: 'publishing', 
          imported: false,
          items: [{ transactionId: 't2', isrc: 'USABC123', platform: 'BMI', territory: 'US', grossRevenue: 500, currency: 'USD' }]
        },
      ],
      waterfallConfig: {
        artistSplit: 0.5,
        labelSplit: 0.5,
        recoupableExpenses: 0,
        recoupmentPriority: 'direct',
        featuredArtistSplits: {},
      },
    };

    const run = compiler.compile(input, ctx);
    expect(run.output.pendingStatementCount).toBe(1);
    
    const statementScore = run.scores.find(s => s.label === 'Statement Processing');
    expect(statementScore?.value).toBe(1);
    expect(statementScore?.max).toBe(2);
    expect(statementScore?.status).toBe('watch');

    const pendingFinding = run.findings.find(f => f.id === 'pending_statement_stmt_2');
    expect(pendingFinding).toBeDefined();

    const financeAgentBrief = run.agentBriefs.find(b => b.agentId === 'finance_agent');
    expect(financeAgentBrief).toBeDefined();
    expect(financeAgentBrief?.brief).toContain('1 pending statements');
  });

  it('calculates recoupment and ROI accurately', () => {
    const input: RoyaltyRevenueInput = {
      projectId: 'proj_abc',
      projectName: 'Alpha Release',
      revenueStats: {
        totalRevenue: 2000,
      },
      unpaidPayouts: [],
      statements: [],
      waterfallConfig: {
        artistSplit: 0.5,
        labelSplit: 0.5,
        recoupableExpenses: 5000,
        recoupmentPriority: 'direct',
        featuredArtistSplits: {},
      },
    };

    const run = compiler.compile(input, ctx);
    
    // totalGrossRevenue: 2000, recoupableExpenses: 5000
    // projectRoiPercentage: (2000 / 5000) * 100 = 40%
    expect(run.output.totalGrossRevenue).toBe(2000);
    expect(run.output.projectRoiPercentage).toBe(40);
    expect(run.output.isRecouped).toBe(false);

    expect(run.output.waterfallResult.recoupedAmount).toBe(2000);
    expect(run.output.waterfallResult.remainingRecoupable).toBe(3000);

    const recoupmentScore = run.scores.find(s => s.label === 'Recoupment Status');
    expect(recoupmentScore?.value).toBe(2000);
    expect(recoupmentScore?.max).toBe(5000);
    expect(recoupmentScore?.status).toBe('watch');
  });

  it('calculates split waterfall and fully recoups', () => {
    const input: RoyaltyRevenueInput = {
      projectId: 'proj_abc',
      projectName: 'Alpha Release',
      revenueStats: {
        totalRevenue: 10000,
      },
      unpaidPayouts: [],
      statements: [],
      waterfallConfig: {
        artistSplit: 0.6,
        labelSplit: 0.4,
        recoupableExpenses: 2000,
        recoupmentPriority: 'direct',
        featuredArtistSplits: {
          'artist_feat_1': 0.1, // 10% of the 60% artist share
        },
      },
    };

    const run = compiler.compile(input, ctx);
    
    expect(run.output.isRecouped).toBe(true);
    expect(run.output.projectRoiPercentage).toBe(500); // 10000 / 2000 = 500%

    // 10000 gross - 2000 recoup = 8000 shareable
    const waterfall = run.output.waterfallResult;
    expect(waterfall.recoupedAmount).toBe(2000);
    expect(waterfall.remainingRecoupable).toBe(0);
    
    // 8000 * 0.6 = 4800 artist share total
    // 8000 * 0.4 = 3200 label share
    expect(waterfall.artistShare).toBe(4800);
    expect(waterfall.labelShare).toBe(3200);

    // featured artist gets 10% of 4800 = 480
    // main artist nets 4800 - 480 = 4320
    expect(waterfall.featuredShares['artist_feat_1']).toBe(480);
    expect(waterfall.netArtistPayable).toBe(4320);

    const recoupmentScore = run.scores.find(s => s.label === 'Recoupment Status');
    expect(recoupmentScore?.status).toBe('good');
  });

  it('detects unpaid balances and sets approval gates', () => {
    const input: RoyaltyRevenueInput = {
      projectId: 'proj_abc',
      projectName: 'Alpha Release',
      revenueStats: {
        totalRevenue: 1000,
      },
      unpaidPayouts: [
        { id: 'p1', artistId: 'artist_1', artistName: 'Artist One', amount: 500, currency: 'USD', period: '2026-Q1', status: 'pending', method: 'stripe' },
        { id: 'p2', artistId: 'artist_2', artistName: 'Artist Two', amount: 1500, currency: 'USD', period: '2026-Q1', status: 'pending', method: 'wire' }
      ],
      statements: [],
      waterfallConfig: {
        artistSplit: 0.5,
        labelSplit: 0.5,
        recoupableExpenses: 0,
        recoupmentPriority: 'direct',
        featuredArtistSplits: {},
      },
    };

    const run = compiler.compile(input, ctx);

    expect(run.output.totalUnpaidBalance).toBe(2000);

    const unpaidFinding = run.findings.find(f => f.id === 'unpaid_payout_p1');
    expect(unpaidFinding).toBeDefined();

    const recommendation = run.recommendations.find(r => r.id === 'process_unpaid_royalties');
    expect(recommendation).toBeDefined();
    expect(recommendation?.priority).toBe('high');

    const approvalGate = run.approvalGates.find(g => g.id === 'approve_royalty_payouts');
    expect(approvalGate).toBeDefined();
    expect(approvalGate?.riskTier).toBe('approval');
  });
});
