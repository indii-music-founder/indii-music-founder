import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

/**
 * 🧬 HELIX: SAFETY FILTER RESILIENCE
 *
 * "Evolution without boundaries is cancer; constrain the search space."
 *
 * This test suite verifies that the evolutionary engine correctly handles "Safety Filter" rejections
 * from the underlying LLM provider. If a mutation results in unsafe content (e.g., hate speech,
 * dangerous instructions), the mutation function should fail, and the engine must RETRY
 * rather than crashing or allowing the unsafe agent into the gene pool.
 */

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Safety Filter Resilience', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 3,
    mutationRate: 1.0, // Force mutation
    eliteCount: 1,     // Keep 1 elite
    maxGenerations: 5
  };

  const baseGene: AgentGene = {
    id: 'base',
    name: 'Base Agent',
    systemPrompt: 'Safe Prompt',
    parameters: {},
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockFitnessFn.mockResolvedValue(1.0);
    // Default: Crossover works
    mockCrossoverFn.mockResolvedValue({ ...baseGene, id: 'child' });
  });

  it('Safety Filter: Rejects mutations that trigger Safety Violations and retries until safe', async () => {
    // Scenario: The Mutation Function interacts with an LLM that has strict safety filters.
    // Sometimes, the random mutation produces output that is flagged as "Unsafe".
    // The engine must discard these attempts and try again.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
      { ...baseGene, id: 'p1' },
      { ...baseGene, id: 'p2' }
    ];

    // 1. Setup Mutation with Safety Violations
    // Attempt 1: "Safety Violation: Hate Speech"
    // Attempt 2: "Safety Violation: Dangerous Content"
    // Attempt 3: Success (Safe Mutation)
    // We need 2 offspring (Pop 3 - 1 Elite = 2).
    // So we need 2 successful mutations.

    const safetyError1 = new Error("Safety Violation: Hate Speech Detected");
    const safetyError2 = new Error("Safety Violation: Dangerous Content Detected");

    mockMutationFn
      .mockRejectedValueOnce(safetyError1) // Fail 1
      .mockRejectedValueOnce(safetyError2) // Fail 2
      .mockResolvedValueOnce({ ...baseGene, id: 'safe-child-1', systemPrompt: 'Safe Mutation 1' }) // Success 1
      .mockResolvedValueOnce({ ...baseGene, id: 'safe-child-2', systemPrompt: 'Safe Mutation 2' }); // Success 2

    // 2. Evolve
    const nextGen = await engine.evolve(population);

    // 3. Assertions

    // A. Population Integrity
    expect(nextGen).toHaveLength(3);

    // B. Quality Control: Verify survivors are the SAFE ones
    const offspring = nextGen.slice(1);
    expect(offspring.length).toBe(2);
    expect(offspring[0].systemPrompt).toBe('Safe Mutation 1');
    expect(offspring[1].systemPrompt).toBe('Safe Mutation 2');

    // C. Retry Verification: Verify that we called mutation 4 times (2 fails + 2 successes)
    expect(mockMutationFn).toHaveBeenCalledTimes(4);
  });
});
