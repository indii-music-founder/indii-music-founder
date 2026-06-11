import { describe, it, expect } from 'vitest';
import { RoadTravelCompiler, RoadTravelInput } from './RoadTravelCompiler';

describe('RoadTravelCompiler', () => {
  const compiler = new RoadTravelCompiler();
  const ctx = { userId: 'user_123' };

  it('should compile a local supply run', () => {
    const input: RoadTravelInput = {
      eventName: 'Guitar Center Run',
      route: {
        origin: 'Home',
        destination: 'Guitar Center',
        mileage: 15,
        driveTimeHours: 0.5,
        crossesBorder: false,
      },
      expenses: {
        gas: 0,
        lodging: 0,
        perDiem: 0,
        tolls: 0,
        parking: 0,
        insurance: 0,
      },
      logistics: {
        crewSize: 1,
        requiresBackline: false,
        rehearsalHours: 0,
        loadInHours: 0,
        loadOutHours: 0,
      },
    };

    const run = compiler.compile(input, ctx);

    expect(run.domain).toBe('road_travel');
    expect(run.schemaVersion).toBe(1);
    expect(run.output.totalTravelCost).toBe(0);
    expect(run.output.totalHours).toBe(0.5);
    
    // Mileage cost line should exist
    const mileageLine = run.costLines.find(c => c.costType === 'mileage');
    expect(mileageLine).toBeDefined();
    expect(mileageLine?.amount).toBeCloseTo(15 * 0.67);
  });

  it('should compile a gig trip with time value', () => {
    const input: RoadTravelInput = {
      eventName: 'Local Club Gig',
      route: {
        origin: 'Home',
        destination: 'Downtown Club',
        mileage: 40,
        driveTimeHours: 1,
        crossesBorder: false,
      },
      expenses: {
        gas: 10,
        lodging: 0,
        perDiem: 20,
        tolls: 5,
        parking: 15,
        insurance: 0,
      },
      logistics: {
        crewSize: 3,
        requiresBackline: true,
        rehearsalHours: 2,
        loadInHours: 1.5,
        loadOutHours: 1,
      },
      timeValueRate: 25, // $25/hr
    };

    const run = compiler.compile(input, ctx);

    expect(run.output.totalTravelCost).toBe(10 + 20 + 5 + 15); // 50
    expect(run.output.totalHours).toBe(1 + 2 + 1.5 + 1); // 5.5

    const timeValueLine = run.costLines.find(c => c.costType === 'time_value');
    expect(timeValueLine).toBeDefined();
    expect(timeValueLine?.amount).toBe(5.5 * 25);
    
    // Heavy logistics finding should be present
    expect(run.findings.some(f => f.title === 'Heavy Logistics Footprint')).toBe(true);
  });

  it('should compile a tour leg with high drive time', () => {
    const input: RoadTravelInput = {
      eventName: 'East Coast Run Leg 1',
      route: {
        origin: 'NYC',
        destination: 'Chicago',
        mileage: 790,
        driveTimeHours: 12,
        crossesBorder: false,
      },
      expenses: {
        gas: 150,
        lodging: 200,
        perDiem: 100,
        tolls: 40,
        parking: 0,
        insurance: 50,
      },
      logistics: {
        crewSize: 4,
        requiresBackline: true,
        rehearsalHours: 0,
        loadInHours: 2,
        loadOutHours: 1.5,
      },
    };

    const run = compiler.compile(input, ctx);

    expect(run.output.totalTravelCost).toBe(150 + 200 + 100 + 40 + 50); // 540
    expect(run.output.totalHours).toBe(12 + 2 + 1.5); // 15.5

    // Should have an excessive drive time finding
    expect(run.findings.some(f => f.title === 'Excessive Drive Time')).toBe(true);
    expect(run.agentBriefs.some(b => b.agentId === 'touring')).toBe(true);
  });

  it('should compile and trigger border/visa warnings', () => {
    const input: RoadTravelInput = {
      eventName: 'Toronto Show',
      route: {
        origin: 'Detroit',
        destination: 'Toronto',
        mileage: 240,
        driveTimeHours: 4,
        crossesBorder: true,
      },
      expenses: {
        gas: 50,
        lodging: 150,
        perDiem: 75,
        tolls: 0,
        parking: 20,
        insurance: 25,
      },
      logistics: {
        crewSize: 5,
        requiresBackline: true,
        rehearsalHours: 1,
        loadInHours: 2,
        loadOutHours: 2,
      },
      visaRequired: true,
    };

    const run = compiler.compile(input, ctx);

    // Border warnings
    expect(run.output.borderWarnings.length).toBeGreaterThan(0);
    expect(run.findings.some(f => f.title === 'International Border Crossing Detected')).toBe(true);
    
    // Agent briefs for legal and finance
    expect(run.agentBriefs.some(b => b.agentId === 'legal')).toBe(true);
    expect(run.agentBriefs.some(b => b.agentId === 'finance')).toBe(true);
    
    // Approval gates
    expect(run.approvalGates.some(g => g.label === 'Visa and Customs Clearance')).toBe(true);
    expect(run.scores[0]?.status).toBe('blocked');
  });
});
