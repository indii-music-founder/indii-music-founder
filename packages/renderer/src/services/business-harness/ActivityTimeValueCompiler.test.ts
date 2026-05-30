import { describe, it, expect } from 'vitest';
import { ActivityTimeValueCompiler } from './ActivityTimeValueCompiler';
import { BusinessActivityEvent } from '@indii/shared';

describe('ActivityTimeValueCompiler', () => {
  const compiler = new ActivityTimeValueCompiler();

  it('compiles an empty list of events safely', () => {
    const run = compiler.compile({ events: [] }, { userId: 'u1' });
    expect(run.domain).toBe('activity_time_value');
    expect(run.output.totalActiveMinutes).toBe(0);
    expect(run.output.totalValue).toBe(0);
    expect(run.costLines.length).toBe(0);
    expect(run.agentBriefs[0]?.brief).toContain('Total value: $0');
  });

  it('handles idle detection (excluding idle from value)', () => {
    const event: BusinessActivityEvent = {
      id: 'e1',
      userId: 'u1',
      sessionId: 's1',
      eventType: 'module_focus',
      category: 'admin_labor',
      startedAt: '2023-01-01T10:00:00Z',
      durationMinutes: 60,
      activeMinutes: 45,
      idleMinutes: 15,
      hourlyRate: 100, // $100/hr
      source: 'automatic'
    };

    const run = compiler.compile({ events: [event] }, { userId: 'u1' });
    
    // Only 45 minutes of active time should be valued. (45/60) * 100 = 75
    expect(run.output.totalActiveMinutes).toBe(45);
    expect(run.output.totalIdleMinutes).toBe(15);
    expect(run.output.totalValue).toBe(75);
    expect(run.costLines.length).toBe(1);
    expect(run.costLines[0]?.amount).toBe(75);
    expect(run.costLines[0]?.costType).toBe('time_value');
  });

  it('tracks route/module and project attribution', () => {
    const event1: BusinessActivityEvent = {
      id: 'e1',
      userId: 'u1',
      sessionId: 's1',
      eventType: 'module_focus',
      module: 'marketing',
      projectId: 'proj_A',
      category: 'marketing_labor',
      startedAt: '2023-01-01T10:00:00Z',
      durationMinutes: 30,
      activeMinutes: 30,
      idleMinutes: 0,
      hourlyRate: 50,
      source: 'automatic'
    };

    const event2: BusinessActivityEvent = {
      id: 'e2',
      userId: 'u1',
      sessionId: 's1',
      eventType: 'manual_work',
      module: 'creative',
      projectId: 'proj_B',
      category: 'creative_labor',
      startedAt: '2023-01-01T11:00:00Z',
      durationMinutes: 60,
      activeMinutes: 60,
      idleMinutes: 0,
      hourlyRate: 60,
      source: 'manual' // manual correction
    };

    const run = compiler.compile({ events: [event1, event2] }, { userId: 'u1' });
    
    // Total value: (30/60 * 50) + (60/60 * 60) = 25 + 60 = 85
    expect(run.output.totalValue).toBe(85);
    expect(run.output.valueByProject['proj_A']).toBe(25);
    expect(run.output.valueByProject['proj_B']).toBe(60);
    
    // Module attribution in inputRefs
    expect(run.inputRefs[0]?.label).toContain('marketing');
    expect(run.inputRefs[1]?.label).toContain('creative');
  });

  it('incorporates manual corrections with high confidence', () => {
    const event: BusinessActivityEvent = {
      id: 'e1',
      userId: 'u1',
      sessionId: 's1',
      eventType: 'manual_work',
      category: 'admin_labor',
      startedAt: '2023-01-01T10:00:00Z',
      durationMinutes: 120,
      activeMinutes: 120,
      idleMinutes: 0,
      hourlyRate: 40,
      source: 'manual' // manual correction
    };

    const run = compiler.compile({ events: [event] }, { userId: 'u1' });
    
    expect(run.confidence).toBeGreaterThanOrEqual(0.9); // Manual source increases confidence
    expect(run.costLines[0]?.confidence).toBe('high');
  });

  it('ensures time value is never treated as revenue', () => {
    const event: BusinessActivityEvent = {
      id: 'e1',
      userId: 'u1',
      sessionId: 's1',
      eventType: 'module_focus',
      category: 'admin_labor',
      startedAt: '2023-01-01T10:00:00Z',
      durationMinutes: 60,
      activeMinutes: 60,
      idleMinutes: 0,
      hourlyRate: 100,
      source: 'automatic'
    };

    const run = compiler.compile({ events: [event] }, { userId: 'u1' });
    
    // Verify explicit brief and assumptions about revenue
    const brief = run.agentBriefs[0]?.brief;
    expect(brief).toContain('NEVER treated as cash revenue');
    
    const assumptions = run.assumptions.join(' ');
    expect(assumptions).toContain('not realized revenue');
    
    expect(run.costLines[0]?.taxTreatment).toBe('artist_labor_value_tracking');
    expect(run.costLines[0]?.costType).toBe('time_value'); // Definitely not revenue
  });
});
