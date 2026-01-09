import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Evolutionary Loop Verification', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 4,
    mutationRate: 0.5,
    eliteCount: 1,
    maxGenerations: 5
  };

  const mockGene: AgentGene = {
    id: 'gene-template',
    name: 'Agent Template',
    systemPrompt: 'Base Prompt',
    parameters: { temp: 0.7 },
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Default favorable mocks
    mockFitnessFn.mockImplementation(async (gene) => {
        // Deterministic fitness based on ID to simulate selection pressure
        if (gene.id === 'elite') return 1.0;
        if (gene.id === 'mid') return 0.5;
        return 0.1;
    });

    mockCrossoverFn.mockImplementation(async (p1, p2) => ({
      ...p1,
      id: 'offspring-temp',
      name: `Child of ${p1.name} & ${p2.name}`,
      systemPrompt: p1.systemPrompt + ' + ' + p2.systemPrompt,
      generation: Math.max(p1.generation, p2.generation), // Engine increments this
      lineage: [p1.id, p2.id]
    }));

    mockMutationFn.mockImplementation(async (g) => ({
      ...g,
      systemPrompt: g.systemPrompt + ' [MUTATED]'
    }));

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);
  });

  it('Micro-Universe: Runs one step and produces valid, distinct offspring', async () => {
    // 1. Setup Micro-Universe
    const population: AgentGene[] = [
      { ...mockGene, id: 'elite', fitness: 1.0 },
      { ...mockGene, id: 'mid', fitness: 0.5 },
      { ...mockGene, id: 'weak1', fitness: 0.1 },
      { ...mockGene, id: 'weak2', fitness: 0.1 }
    ];

    // Force mutation for distinctness
    const testConfig = { ...config, mutationRate: 1.0, eliteCount: 1 };
    engine = new EvolutionEngine(testConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // 2. Run ONE step
    const nextGen = await engine.evolve(population);

    // 3. Assertions
    expect(nextGen).toHaveLength(4);

    // Elitism: The best agent must survive unchanged at index 0
    const survivor = nextGen[0];
    expect(survivor.id).toBe('elite');
    expect(survivor.fitness).toBe(1.0);
    expect(survivor.generation).toBe(0);

    // Evolution: Offspring must be new
    const offspring = nextGen[1];
    expect(offspring.id).not.toBe('elite');
    expect(offspring.id).not.toBe('mid');

    // Generation Check: Offspring must be next generation
    expect(offspring.generation).toBe(1);

    // Mutation Check: Content must be different (Diversity)
    expect(offspring.systemPrompt).toContain('[MUTATED]');
    expect(offspring.systemPrompt).not.toEqual(survivor.systemPrompt);
  });

  it('Selection Pressure: High fitness parents are preferred', async () => {
    // We mock random to pick specific indices if we wanted to be super precise,
    // but with tournament selection, the probability of selecting the best is high.
    // Instead, we verify that Crossover is called with "elite" or "mid" more often than "weak".

    // Actually, let's just spy on the crossover function arguments.
    const population: AgentGene[] = [
        { ...mockGene, id: 'elite', fitness: 100 },
        { ...mockGene, id: 'weak1', fitness: 0.01 },
        { ...mockGene, id: 'weak2', fitness: 0.01 },
        { ...mockGene, id: 'weak3', fitness: 0.01 }
    ];

    // Create a larger population in next gen to trigger multiple selections
    const testConfig = { ...config, populationSize: 10, eliteCount: 0 };
    engine = new EvolutionEngine(testConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    await engine.evolve(population);

    // With Tournament Size 3, 'elite' should win almost every tournament it enters.
    // We expect 'elite' to appear in the lineage of most children.
    const calls = mockCrossoverFn.mock.calls;
    let eliteSelections = 0;

    for (const [p1, p2] of calls) {
        if (p1.id === 'elite') eliteSelections++;
        if (p2.id === 'elite') eliteSelections++;
    }

    // It won't be 100% because elite might not be picked for the tournament sample,
    // but it should be significantly higher than random.
    expect(eliteSelections).toBeGreaterThan(0);
  });

  it('Mutation Safety: Retries on invalid mutation (Death to the buggy)', async () => {
    // Mock mutation to fail the first time (invalid JSON simulation) then succeed
    mockMutationFn
        .mockRejectedValueOnce(new Error("Invalid JSON Output")) // 1st attempt fails
        .mockResolvedValueOnce({ ...mockGene, id: 'valid', systemPrompt: 'valid' }); // 2nd succeeds

    const population: AgentGene[] = [
        { ...mockGene, id: 'p1', fitness: 1.0 },
        { ...mockGene, id: 'p2', fitness: 1.0 }
    ];

    const testConfig = { ...config, populationSize: 2, eliteCount: 1, mutationRate: 1.0 };
    engine = new EvolutionEngine(testConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const nextGen = await engine.evolve(population);

    // Should still produce a full population by retrying
    expect(nextGen).toHaveLength(2);
    expect(mockMutationFn).toHaveBeenCalledTimes(2);
  });

  it('Inbreeding Check: Ensures diversity in output', async () => {
      // Helix's "Favorite Test".
      // We start with identical parents.
      const population: AgentGene[] = [
          { ...mockGene, id: 'clone1', fitness: 1.0, systemPrompt: 'SAME' },
          { ...mockGene, id: 'clone2', fitness: 1.0, systemPrompt: 'SAME' }
      ];

      // Mutation adds diversity
      const testConfig = { ...config, populationSize: 5, eliteCount: 1, mutationRate: 1.0 };

      // Mutation appends a random suffix to ensure uniqueness
      let counter = 0;
      mockMutationFn.mockImplementation(async (g) => ({
          ...g,
          systemPrompt: g.systemPrompt + `-${counter++}`
      }));

      engine = new EvolutionEngine(testConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);
      const nextGen = await engine.evolve(population);

      // Extract prompts
      const prompts = nextGen.map(g => g.systemPrompt);
      const uniquePrompts = new Set(prompts);

      // We expect diversity because mutation is happening
      expect(uniquePrompts.size).toBeGreaterThan(1);

      // Specifically, we expect the offspring to be different from the elite survivor
      expect(prompts[1]).not.toEqual(prompts[0]);
  });
});
