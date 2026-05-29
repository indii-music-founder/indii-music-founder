import { describe, it, expect } from 'vitest';
import { MarketingGrowthCompiler, MarketingGrowthInput } from './MarketingGrowthCompiler';

describe('MarketingGrowthCompiler', () => {
  it('should compile successfully and generate correct output', () => {
    const compiler = new MarketingGrowthCompiler();
    const input: MarketingGrowthInput = {
      totalBudgetLimit: 5000,
      contentCalendarId: 'cal_123',
      testMatrix: { A: ['v1', 'v2'] },
      campaigns: [
        {
          id: 'camp_1',
          name: 'Spring Launch',
          channels: ['Instagram', 'TikTok'],
          budget: 2000,
          expectedConversionRate: 3.5,
          brandAlignmentScore: 85,
          organicReachEstimate: 15000
        },
        {
          id: 'camp_2',
          name: 'Summer Teaser',
          channels: ['YouTube'],
          budget: 1500,
          expectedConversionRate: 6.0,
          brandAlignmentScore: 90,
          organicReachEstimate: 20000
        }
      ]
    };

    const run = compiler.compile(input, { userId: 'user_1', projectId: 'proj_1' });
    
    expect(run.domain).toBe('marketing_growth');
    expect(run.output.totalAdSpend).toBe(3500);
    expect(run.output.averageConversionRate).toBe(4.75);
    expect(run.output.totalOrganicReach).toBe(35000);
    expect(run.output.channelsMixed.sort()).toEqual(['Instagram', 'TikTok', 'YouTube'].sort());
    
    // Check recommendations (conversion > 5)
    expect(run.recommendations.length).toBe(1);
    expect(run.recommendations[0].title).toBe('High-Conversion Channel Amplification');
    expect(run.recommendations[0].detail).toContain('Summer Teaser');

    // No budget overrun gate
    expect(run.approvalGates).toHaveLength(0);
    
    // Agent briefs present
    expect(run.agentBriefs.length).toBeGreaterThanOrEqual(4);
    
    // Cost lines present
    expect(run.costLines.length).toBe(2);
    expect(run.costLines[0].amount).toBe(2000);
  });

  it('should flag budget overrun', () => {
    const compiler = new MarketingGrowthCompiler();
    const input: MarketingGrowthInput = {
      totalBudgetLimit: 1000,
      contentCalendarId: 'cal_123',
      testMatrix: {},
      campaigns: [
        {
          id: 'camp_1',
          name: 'Expensive Launch',
          channels: ['Instagram'],
          budget: 2000,
          expectedConversionRate: 3.5,
          brandAlignmentScore: 85,
          organicReachEstimate: 15000
        }
      ]
    };

    const run = compiler.compile(input, { userId: 'user_1' });
    
    const gate = run.approvalGates.find(g => g.id === 'budget_overrun_gate');
    expect(gate).toBeDefined();
    
    const finding = run.findings.find(f => f.id === 'budget_overrun_finding');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('critical');
  });

  it('should warn on off-brand assets', () => {
    const compiler = new MarketingGrowthCompiler();
    const input: MarketingGrowthInput = {
      totalBudgetLimit: 5000,
      contentCalendarId: 'cal_123',
      testMatrix: {},
      campaigns: [
        {
          id: 'camp_off',
          name: 'Edgy Ad',
          channels: ['TikTok'],
          budget: 500,
          expectedConversionRate: 2.0,
          brandAlignmentScore: 50,
          organicReachEstimate: 5000
        }
      ]
    };

    const run = compiler.compile(input, { userId: 'user_1' });
    
    const finding = run.findings.find(f => f.id === 'off_brand_camp_off');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('high');
    expect(finding?.title).toBe('Off-Brand Asset Warning');
  });
});
