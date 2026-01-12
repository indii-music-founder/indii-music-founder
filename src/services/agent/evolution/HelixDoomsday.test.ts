import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Doomsday Switch (Generation Limits)', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 4,
    mutationRate: 0.5,
    eliteCount: 1,
    maxGenerations: 5
  };

  const mockGene: AgentGene = {
    id: 'gene-template',
    name: 'Agent',
    systemPrompt: 'Prompt',
    parameters: {},
    generation: 5, // Already at limit
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockFitnessFn.mockResolvedValue(0.5);
    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);
  });

  it('Doomsday Switch: Evolution halts when Max Generations is reached', async () => {
    // 1. Setup: Population at Max Generation (5)
    // We provide genes that are already at the limit.
    const population: AgentGene[] = [
      { ...mockGene, id: 'a1', generation: 5, fitness: 0.8 },
      { ...mockGene, id: 'a2', generation: 5, fitness: 0.7 }
    ];

    // 2. Evolve
    const nextGen = await engine.evolve(population);

    // 3. Assertions
    // Should NOT produce Generation 6
    // It should return the evaluated/sorted population (stasis) or just the elites if logic differs,
    // but crucially, no new generation number should appear.

    // Check that we didn't evolve forward
    const generations = nextGen.map(g => g.generation);
    expect(Math.max(...generations)).toBeLessThanOrEqual(5);

    // Verify Crossover/Mutation was NOT called (Efficiency check)
    expect(mockCrossoverFn).not.toHaveBeenCalled();
    expect(mockMutationFn).not.toHaveBeenCalled();
  });

  it('Doomsday Switch: Allows evolution if below limit', async () => {
    // 1. Setup: Population at Gen 4 (Limit 5)
    const population: AgentGene[] = [
        { ...mockGene, id: 'a1', generation: 4, fitness: 0.8 },
        { ...mockGene, id: 'a2', generation: 4, fitness: 0.8 }
    ];

    mockCrossoverFn.mockResolvedValue({ ...mockGene, id: 'child', generation: 0 }); // Generation gets overwritten by engine
    mockMutationFn.mockResolvedValue({ ...mockGene, id: 'child', generation: 0 });

    // 2. Evolve
    const nextGen = await engine.evolve(population);

    // 3. Assertions
    // Should produce Gen 5
    const generations = nextGen.map(g => g.generation);
    expect(Math.max(...generations)).toBe(5);

    // Verify breeding happened
    expect(mockCrossoverFn).toHaveBeenCalled();
  });
});
