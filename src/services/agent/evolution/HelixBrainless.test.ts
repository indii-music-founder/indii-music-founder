import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Brainless Check (Schema Compliance)', () => {
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
    // Default mutation is valid
    mockMutationFn.mockImplementation(async (g) => ({ ...g, systemPrompt: 'Valid Mutated Prompt' }));
  });

  it('The Brainless Check: Rejects offspring with missing/null parameters', async () => {
    // Scenario: "Lobotomy Mutation"
    // A mutation function fails to preserve the 'parameters' object (e.g., returns null or undefined).
    // The engine must reject these "Brainless" agents to prevent runtime crashes in execution.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // 1. Setup Mutation failure sequence:
    // Call 1: Returns INVALID gene (parameters: null) -> Should be rejected
    // Call 2: Returns INVALID gene (parameters: missing/undefined) -> Should be rejected
    // Subsequent calls: Return VALID gene -> Should be accepted

    // We expect 3 offspring (Pop 4 - 1 Elite).
    // So we need at least 2 failures + 3 successes = 5 calls minimum.

    mockMutationFn
        .mockResolvedValueOnce({ ...healthyGene, parameters: null as any }) // Fail 1 (Null)
        .mockResolvedValueOnce({ ...healthyGene, parameters: undefined as any }) // Fail 2 (Undefined)
        .mockResolvedValue({ ...healthyGene, parameters: { temp: 0.9 } }); // Success (Valid)

    const population: AgentGene[] = [
      { ...healthyGene, id: 'p1' },
      { ...healthyGene, id: 'p2' }
    ];

    // 2. Evolve
    const nextGen = await engine.evolve(population);

    // 3. Assertions
    expect(nextGen).toHaveLength(4);

    // Verify offspring have valid parameters
    const offspring = nextGen.slice(1);
    offspring.forEach(child => {
      expect(child.parameters).toBeDefined();
      expect(child.parameters).not.toBeNull();
      expect(typeof child.parameters).toBe('object');
      // Should eventually get the valid one
      if (child.parameters.temp) {
          expect(child.parameters.temp).toBe(0.9);
      }
    });

    // Verify rejection occurred (Mutation called more than strictly necessary)
    // We need 3 offspring. 2 failed. So at least 5 calls.
    expect(mockMutationFn.mock.calls.length).toBeGreaterThanOrEqual(5);
  });
});
