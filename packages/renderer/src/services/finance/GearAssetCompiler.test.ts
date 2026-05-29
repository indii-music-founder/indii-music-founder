import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GearAssetCompiler, GearAssetInput } from './GearAssetCompiler';
import { HarnessContext } from '@indii/shared';

describe('GearAssetCompiler', () => {
  let compiler: GearAssetCompiler;
  let ctx: HarnessContext;

  beforeEach(() => {
    compiler = new GearAssetCompiler();
    ctx = {
      userId: 'test-user-123',
    };
    vi.useFakeTimers();
    // Set fixed date for predictable tests
    vi.setSystemTime(new Date('2024-06-01T00:00:00Z'));
  });

  it('handles consumable purchase correctly', () => {
    const input: GearAssetInput = {
      assetId: 'cable-001',
      name: 'XLR Cable 20ft',
      category: 'cable',
      assetType: 'consumable',
      purchasePrice: 25.00,
      purchaseDate: '2024-05-01T00:00:00Z',
    };

    const result = compiler.compile(input, ctx);

    expect(result.domain).toBe('gear_asset');
    expect(result.schemaVersion).toBe(1);
    expect(result.costLines).toHaveLength(1);
    expect(result.costLines?.[0]?.confidence).toBe('high');
    expect(result.costLines?.[0]?.costType).toBe('cash_expense');
    expect(result.costLines?.[0]?.amount).toBe(25.00);
    
    expect(result.recommendations.some(r => r.title === 'Consider Bulk Purchasing')).toBe(true);
    expect(result.output.monthlyDepreciation).toBe(0);
    expect(result.output.replacementStatus).toBe('not_applicable');
  });

  it('calculates durable asset depreciation', () => {
    const input: GearAssetInput = {
      assetId: 'laptop-001',
      name: 'MacBook Pro M3',
      category: 'laptop',
      assetType: 'durable',
      purchasePrice: 2400.00,
      purchaseDate: '2024-06-01T00:00:00Z',
      lifespanMonths: 24 // Very short lifespan for testing
    };

    const result = compiler.compile(input, ctx);

    expect(result.costLines).toHaveLength(1);
    expect(result.costLines?.[0]?.amount).toBe(100.00); // 2400 / 24
    expect(result.costLines?.[0]?.costType).toBe('asset_depreciation');

    expect(result.agentBriefs.some(b => b.brief.includes('insurance policy'))).toBe(true);
  });

  it('triggers repair/warranty reminder', () => {
    const input: GearAssetInput = {
      assetId: 'synth-001',
      name: 'Prophet 5',
      category: 'instrument',
      assetType: 'durable',
      purchasePrice: 3500.00,
      purchaseDate: '2023-01-01T00:00:00Z',
      warrantyExpirationDate: '2024-07-01T00:00:00Z', // Expires in 1 month from test time
    };

    const result = compiler.compile(input, ctx);

    expect(result.output.warrantyStatus).toBe('expiring_soon');
    expect(result.findings.some(f => f.title === 'Warranty Expiring Soon')).toBe(true);
    expect(result.agentBriefs.some(b => b.agentId === 'music_agent')).toBe(true);
  });

  it('handles project allocation', () => {
    const input: GearAssetInput = {
      assetId: 'pedal-001',
      name: 'Strymon BigSky',
      category: 'pedal',
      assetType: 'durable',
      purchasePrice: 479.00,
      purchaseDate: '2024-01-01T00:00:00Z',
      tourId: 'tour-summer-2024',
      sessionId: 'session-album-3'
    };

    const result = compiler.compile(input, ctx);

    expect(result.output!.allocatedContexts).toContain('tour:tour-summer-2024');
    expect(result.output!.allocatedContexts).toContain('session:session-album-3');
    expect(result.costLines?.[0]?.tourId).toBe('tour-summer-2024');
  });

  it('flags replacement soon and requires approval', () => {
    const input: GearAssetInput = {
      assetId: 'laptop-002',
      name: 'Old MacBook',
      category: 'laptop',
      assetType: 'durable',
      purchasePrice: 2000.00,
      purchaseDate: '2019-12-01T00:00:00Z', // 54 months ago. Lifespan is 60. Remaining is 6 months
      lifespanMonths: 60
    };

    const result = compiler.compile(input, ctx);

    expect(result.output.replacementStatus).toBe('replace_soon');
    expect(result.findings.some(f => f.title === 'Gear Nearing End of Life')).toBe(true);
    expect(result.approvalGates?.length).toBeGreaterThan(0);
    expect(result.approvalGates?.[0]?.requiredFor).toBe('purchase_replacement');
  });
});
