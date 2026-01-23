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
});
