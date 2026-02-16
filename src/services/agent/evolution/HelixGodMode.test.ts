import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: God Mode (Infinity Handling)', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 4,
    mutationRate: 0.5,
    eliteCount: 1,
    maxGenerations: 5
  };

  const baseGene: AgentGene = {
    id: 'base',
    name: 'Base Agent',
    systemPrompt: 'Prompt',
    parameters: {},
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockMutationFn.mockImplementation(async (g) => g);
    mockCrossoverFn.mockImplementation(async (p1) => ({ ...p1, id: 'child', lineage: [p1.id] }));
  });

  it('Serialization Safety: Converts Infinity fitness to MAX_VALUE to prevent JSON nullification', async () => {
    // Scenario: An agent achieves "God Mode" (Infinity Fitness).
    // JSON.stringify(Infinity) results in "null", which means when this agent is saved and reloaded,
    // its fitness becomes 0 (or null), causing it to be culled as "Dead Weight".
    // Helix must prevent this by clamping Infinity to Number.MAX_VALUE.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
      { ...baseGene, id: 'God', fitness: undefined }, // Will get Infinity
      { ...baseGene, id: 'Mortal', fitness: undefined } // Will get 1.0
    ];

    // Mock Fitness: Return Infinity for God
    mockFitnessFn.mockImplementation(async (g) => {
      if (g.id === 'God') return Infinity;
      return 1.0;
    });

    // FORCE ELITE COUNT to 2 to preserve both God and Mortal as elites.
    // This ensures sufficient genetic diversity for the test.
    engine['config'].eliteCount = 2;

    // Evolve
    const nextGen = await engine.evolve(population);

    // Verify
    expect(nextGen).toHaveLength(4);

    // The Elite (Index 0) should be 'God'
    const elite = nextGen[0];
    expect(elite.id).toBe('God');

    // CRITICAL ASSERTION: Fitness must be clamped
    expect(elite.fitness).toBe(Number.MAX_VALUE);
    expect(elite.fitness).not.toBe(Infinity);

    // Verify JSON safety
    const json = JSON.stringify(elite);
    expect(json).toContain(`"fitness":${Number.MAX_VALUE}`);
    expect(json).not.toContain('"fitness":null');
  });

  it('Serialization Safety: Converts -Infinity fitness to -MAX_VALUE to prevent JSON nullification', async () => {
    // Scenario: An agent has catastrophic failure (-Infinity Fitness).
    // JSON.stringify(-Infinity) results in "null", causing database corruption.
    // Helix must prevent this by clamping -Infinity to -Number.MAX_VALUE.

    // Use eliteCount: 2 so both agents survive as elites (Doomed won't reproduce due to negative fitness)
    const preserveConfig: EvolutionConfig = { ...config, eliteCount: 2, populationSize: 2 };
    engine = new EvolutionEngine(preserveConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
      { ...baseGene, id: 'Doomed', fitness: undefined }, // Will get -Infinity
      { ...baseGene, id: 'Mortal', fitness: undefined } // Will get 1.0
    ];

    // Mock Fitness: Return -Infinity for Doomed
    mockFitnessFn.mockImplementation(async (g) => {
      if (g.id === 'Doomed') return -Infinity;
      return 1.0;
    });

    // FORCE ELITE COUNT to 2 so Broken survives as an elite (since it has 0 fitness)
    // Otherwise, with eliteCount=1, only 'Mortal' (1.0) survives, and Broken is culled.
    engine['config'].eliteCount = 2;

    // Evolve
    const nextGen = await engine.evolve(population);

    // Verify the Doomed agent is in the population (not excluded)
    expect(nextGen).toHaveLength(2);
    const doomed = nextGen.find(g => g.id === 'Doomed');
    expect(doomed).toBeDefined();

    // CRITICAL ASSERTION: Fitness must be clamped
    expect(doomed!.fitness).toBe(-Number.MAX_VALUE);
    expect(doomed!.fitness).not.toBe(-Infinity);

    // Verify JSON safety
    const json = JSON.stringify(doomed);
    expect(json).toContain(`"fitness":${-Number.MAX_VALUE}`);
    expect(json).not.toContain('"fitness":null');
  });

  it('Serialization Safety: Converts NaN fitness to 0 to prevent JSON nullification', async () => {
    // Scenario: An agent has invalid fitness calculation (NaN).
    // JSON.stringify(NaN) results in "null", causing database corruption.
    // Helix must prevent this by converting NaN to 0 (failure state).

    // Use eliteCount: 2 so both agents survive as elites (Broken has fitness 0 after sanitization)
    const preserveConfig: EvolutionConfig = { ...config, eliteCount: 2, populationSize: 2 };
    engine = new EvolutionEngine(preserveConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
      { ...baseGene, id: 'Broken', fitness: undefined }, // Will get NaN
      { ...baseGene, id: 'Mortal', fitness: undefined } // Will get 1.0
    ];

    // Mock Fitness: Return NaN for Broken
    mockFitnessFn.mockImplementation(async (g) => {
      if (g.id === 'Broken') return NaN;
      return 1.0;
    });

    // Evolve
    const nextGen = await engine.evolve(population);

    // Verify the Broken agent is in the population
    const broken = nextGen.find(g => g.id === 'Broken');
    expect(broken).toBeDefined();

    // CRITICAL ASSERTION: Fitness must be converted to 0
    expect(broken!.fitness).toBe(0);
    expect(Number.isNaN(broken!.fitness)).toBe(false);

    // Verify JSON safety
    const json = JSON.stringify(broken);
    expect(json).toContain('"fitness":0');
    expect(json).not.toContain('"fitness":null');
  });
});
