import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Brainless Check (Schema Integrity)', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 3,
    mutationRate: 1.0, // Force mutation
    eliteCount: 0, // No elites, pure chaos
    maxGenerations: 5
  };

  const healthyGene: AgentGene = {
    id: 'healthy',
    name: 'Healthy Agent',
    systemPrompt: 'Valid Code',
    parameters: { temp: 0.7 },
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockFitnessFn.mockResolvedValue(1.0);
    mockCrossoverFn.mockResolvedValue({ ...healthyGene, id: 'child-draft' });
  });

  it('Rejects mutated agents with missing or null parameters (The Brainless Defect)', async () => {
    // Scenario: A mutation deletes the 'parameters' object (e.g., returning null or undefined).
    // The engine must catch this before adding the agent to the population.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
      { ...healthyGene, id: 'p1' },
      { ...healthyGene, id: 'p2' }
    ];

    // Mock sequence:
    // 1. Returns agent with null parameters (Should fail "Brainless" check)
    // 2. Returns agent with missing parameters (Should fail)
    // 3. Returns agent with parameters as non-object (Should fail)
    // 4. Returns valid agent (Success 1)
    // 5. Returns valid agent (Success 2)
    // 6. Returns valid agent (Success 3)

    mockMutationFn
      .mockResolvedValueOnce({ ...healthyGene, parameters: null }) // Fail 1
      .mockResolvedValueOnce({ ...healthyGene, parameters: undefined }) // Fail 2
      // @ts-expect-error Testing invalid type at runtime
      .mockResolvedValueOnce({ ...healthyGene, parameters: "string" }) // Fail 3
      .mockResolvedValueOnce({ ...healthyGene, id: 'child1', parameters: { temp: 0.8 } }) // Success 1
      .mockResolvedValueOnce({ ...healthyGene, id: 'child2', parameters: { temp: 0.9 } }) // Success 2
      .mockResolvedValueOnce({ ...healthyGene, id: 'child3', parameters: { temp: 0.5 } }); // Success 3

    const nextGen = await engine.evolve(population);

    // Assertions
    // 1. Full population size (failures were retried)
    expect(nextGen).toHaveLength(3);

    // 2. All survivors have valid parameters
    nextGen.forEach(agent => {
      expect(agent.parameters).toBeDefined();
      expect(typeof agent.parameters).toBe('object');
      expect(agent.parameters).not.toBeNull();
    });

    // 3. Verify retries happened (3 failures + 3 successes = 6 calls minimum)
    expect(mockMutationFn).toHaveBeenCalledTimes(6);
  });
});
