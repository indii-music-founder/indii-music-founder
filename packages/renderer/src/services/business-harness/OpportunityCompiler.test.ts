import { describe, it, expect } from 'vitest';
import { OpportunityCompiler } from './OpportunityCompiler';
import { HarnessContext } from '@indii/shared';

describe('OpportunityCompiler', () => {
  const compiler = new OpportunityCompiler();
  const ctx: HarnessContext = { userId: 'user123', projectId: 'proj456' };

  it('should evaluate a low-pay/high-exposure gig', () => {
    const run = compiler.compile({
      id: 'gig1',
      type: 'show',
      title: 'Local Festival',
      description: 'Opening slot',
      financialOffered: 50,
      financialCost: 20,
      exposureEstimate: 6000,
      brandAlignmentScore: 8,
      strategicValueScore: 7
    }, ctx);

    expect(run.domain).toBe('opportunity');
    expect(run.output.flags).toContain('exposure_play');
    expect(run.findings.some(f => f.title === 'Low-Pay / High-Exposure Gig')).toBe(true);
    expect(run.recommendations.some(r => r.title === 'Leverage Merch for Show')).toBe(true);
    
    const generalistBrief = run.agentBriefs.find(b => b.agentId === 'generalist');
    expect(generalistBrief).toBeDefined();
    expect(run.output.viability).toBe('yes'); // Should be fairly high due to brand and strategic scores
  });

  it('should warn on brand-mismatch sponsorship', () => {
    const run = compiler.compile({
      id: 'spon1',
      type: 'sponsorship',
      title: 'Energy Drink Deal',
      description: 'Post 3 times',
      financialOffered: 5000,
      financialCost: 0,
      exposureEstimate: 10000,
      brandAlignmentScore: 3, // Low alignment
      strategicValueScore: 4
    }, ctx);

    expect(run.output.flags).toContain('brand_risk');
    expect(run.findings.some(f => f.title === 'Brand Mismatch Warning')).toBe(true);
    expect(run.approvalGates.some(g => g.label === 'Brand Mismatch Override')).toBe(true);
    
    const marketingBrief = run.agentBriefs.find(b => b.agentId === 'marketing');
    expect(marketingBrief).toBeDefined();
    expect(marketingBrief!.brief).toContain('Brand risk flagged');
    
    expect(run.output.viability).toBe('no'); // Because flags includes brand_risk
  });

  it('should prioritize high-ROI grant', () => {
    const run = compiler.compile({
      id: 'grant1',
      type: 'grant',
      title: 'Arts Council Grant',
      description: 'Funding for album',
      financialOffered: 10000,
      financialCost: 100, // Application fee
      exposureEstimate: 0,
      brandAlignmentScore: 9,
      strategicValueScore: 9
    }, ctx);

    expect(run.output.flags).toContain('high_priority');
    expect(run.findings.some(f => f.title === 'High-ROI Grant Opportunity')).toBe(true);
    expect(run.recommendations.some(r => r.title === 'Prioritize Grant Application')).toBe(true);
    expect(run.output.viability).toBe('strong_yes'); // High priority flag and high overall score
  });

  it('should flag net-negative opportunity', () => {
    const run = compiler.compile({
      id: 'paytoplay1',
      type: 'show',
      title: 'Pay to Play Show',
      description: 'Buy tickets to sell',
      financialOffered: 0,
      financialCost: 500,
      exposureEstimate: 100,
      brandAlignmentScore: 4,
      strategicValueScore: 2
    }, ctx);

    expect(run.output.flags).toContain('net_negative');
    expect(run.findings.some(f => f.title === 'Net Negative Opportunity')).toBe(true);
    
    const financeBrief = run.agentBriefs.find(b => b.agentId === 'finance');
    expect(financeBrief).toBeDefined();
    
    expect(run.output.viability).toBe('no');
  });

  it('should combine flags for hard pass', () => {
    const run = compiler.compile({
      id: 'bad_spon',
      type: 'brand_deal',
      title: 'Scam Deal',
      description: 'Give us money for bad brand',
      financialOffered: 0,
      financialCost: 1000,
      exposureEstimate: 500,
      brandAlignmentScore: 2,
      strategicValueScore: 1
    }, ctx);

    expect(run.output.flags).toContain('net_negative');
    expect(run.output.flags).toContain('brand_risk');
    expect(run.output.viability).toBe('hard_pass');
  });
});
