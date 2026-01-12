import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Genetic Validation (Quality Control)', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 4,
    mutationRate: 1.0, // Force mutation
    eliteCount: 1,
    maxGenerations: 5
  };

  const healthyGene: AgentGene = {
    id: 'healthy',
    name: 'Healthy Agent',
    systemPrompt: 'Valid Prompt',
    parameters: { temp: 0.7 },
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockFitnessFn.mockResolvedValue(1.0);
    // Crossover produces valid child
    mockCrossoverFn.mockResolvedValue({ ...healthyGene, id: 'child' });
    // Default mutation is valid (to prevent mock exhaustion)
    mockMutationFn.mockImplementation(async (g) => ({ ...g, systemPrompt: 'Valid Mutated Prompt' }));
  });

  it('Mutation Validity: Rejects offspring with empty system prompts ("The Empty Soul")', async () => {
    // Scenario: Mutation function returns a gene with an empty system prompt.
    // This represents a "loss of function" mutation that should be purged.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // 1. Setup Mutation failure sequence:
    // Call 1: Returns INVALID gene (Empty Prompt) -> Should be rejected (retry)
    // Subsequent calls: Return VALID gene (via default implementation) -> Should be accepted
    mockMutationFn.mockResolvedValueOnce({ ...healthyGene, systemPrompt: '' });

    const population: AgentGene[] = [
      { ...healthyGene, id: 'p1' },
      { ...healthyGene, id: 'p2' }
    ];

    // 2. Evolve
    const nextGen = await engine.evolve(population);

    // 3. Assertions
    expect(nextGen).toHaveLength(4); // Config pop size

    // The offspring (index 1-3) should NOT have empty prompts
    const offspring = nextGen.slice(1);
    offspring.forEach(child => {
      expect(child.systemPrompt).not.toBe('');
      expect(child.systemPrompt.length).toBeGreaterThan(0);
    });

    // Verify that we successfully filled the population despite the defect
    // This implies that the engine retried.
    // We expect mutation to be called at least 4 times:
    // 1 (Fail) + 3 (Success) to fill the 3 slots (4 total - 1 elite)
    expect(mockMutationFn).toHaveBeenCalledTimes(4);
  });
});
