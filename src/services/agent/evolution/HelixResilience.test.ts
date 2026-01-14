import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Evolutionary Resilience', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 4,
    mutationRate: 0.0, // No mutation for this test
    eliteCount: 1,
    maxGenerations: 5
  };

  const mockGene: AgentGene = {
    id: 'gene-template',
    name: 'Agent',
    systemPrompt: 'Prompt',
    parameters: {},
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockMutationFn.mockImplementation(async (g) => g);
    mockCrossoverFn.mockImplementation(async (p1) => ({ ...p1, id: 'child' }));

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);
  });

  it('Fitness Resilience: Toxic agents crashing fitness check are assigned 0.0 and do not halt evolution', async () => {
    const population: AgentGene[] = [
      { ...mockGene, id: 'healthy1' },
      { ...mockGene, id: 'toxic' },
      { ...mockGene, id: 'healthy2' }
    ];

    mockFitnessFn.mockImplementation(async (gene) => {
      if (gene.id === 'toxic') {
        throw new Error("Safety Filter Triggered");
      }
      return 1.0;
    });

    // This should NOT throw
    const nextGen = await engine.evolve(population);

    expect(nextGen).toHaveLength(4); // Should still fill population

    // The toxic agent should effectively be treated as 0 fitness
    // Since we have elitism=1, one of the healthy ones (fitness 1.0) should be elite.
    // The toxic one (fitness 0 or undefined) should likely not be elite.

    const survivor = nextGen[0];
    expect(survivor.id).not.toBe('toxic');
    expect(survivor.fitness).toBe(1.0);
  });
});
