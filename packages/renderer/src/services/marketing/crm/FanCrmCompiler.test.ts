import { describe, it, expect } from 'vitest';
import { FanCrmCompiler, FanCrmInput } from './FanCrmCompiler';

describe('FanCrmCompiler', () => {
  it('should identify high-LTV superfans and gate VIP merchandise offers', () => {
    const compiler = new FanCrmCompiler();
    
    const input: FanCrmInput = {
      vipLtvThreshold: 500,
      fans: [
        {
          id: 'fan_1',
          location: 'New York',
          lifetimeValue: 600,
          engagementRate: 0.8,
          daysSinceLastPurchase: 30,
          ticketRequests: 2
        },
        {
          id: 'fan_2',
          location: 'Los Angeles',
          lifetimeValue: 100,
          engagementRate: 0.2,
          daysSinceLastPurchase: 200,
          ticketRequests: 0
        }
      ]
    };

    const result = compiler.compile(input, { userId: 'test_user' });

    // Output correctness
    expect(result.output.superfans).toContain('fan_1');
    expect(result.output.superfans).not.toContain('fan_2');
    expect(result.output.churnRisks).toContain('fan_2');
    expect(result.output.churnRisks).not.toContain('fan_1');
    
    // Recommendations & Gates for VIP merch
    const vipRec = result.recommendations.find(r => r.id.startsWith('rec_vip_merch'));
    expect(vipRec).toBeDefined();
    expect(vipRec?.priority).toBe('high');
    expect(vipRec?.approvalRequired).toBe(true);

    const gate = result.approvalGates.find(g => g.id.startsWith('gate_vip_offer'));
    expect(gate).toBeDefined();
    expect(gate?.riskTier).toBe('approval');
    
    // Agent briefs
    const brief = result.agentBriefs.find(b => b.agentId === 'agent_marketing');
    expect(brief).toBeDefined();
    expect(brief?.brief).toContain('VIP merch campaign');
  });

  it('should detect regional tour demand signal', () => {
    const compiler = new FanCrmCompiler();
    
    const input: FanCrmInput = {
      vipLtvThreshold: 500,
      fans: Array.from({ length: 150 }).map((_, i) => ({
        id: `fan_chicago_${i}`,
        location: 'Chicago',
        lifetimeValue: 50,
        engagementRate: 0.5,
        daysSinceLastPurchase: 60,
        ticketRequests: 1
      }))
    };

    const result = compiler.compile(input, { userId: 'test_user' });

    expect(result.output.tourDemandSignals['Chicago']).toBe(150);

    const demandFinding = result.findings.find(f => f.id.startsWith('find_tour_demand'));
    expect(demandFinding).toBeDefined();
    expect(demandFinding?.detail).toContain('Chicago');
  });
});
