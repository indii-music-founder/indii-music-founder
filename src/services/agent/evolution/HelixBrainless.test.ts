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
    populationSize: 4,
    mutationRate: 1.0, // Force mutation
    eliteCount: 0, // No elites, pure chaos
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

  it('Rejects mutated agents with missing or null parameters (The Brainless Defect)', async () => {
    // Scenario: A mutation deletes the 'parameters' object (e.g., returning null or undefined).
    // The engine must catch this before adding the agent to the population.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
      { ...healthyGene, id: 'p1' },
      { ...healthyGene, id: 'p2' }
    ];

    // Verify rejection occurred (Mutation called more than strictly necessary)
    // We expect 4 offspring (since eliteCount=0 and populationSize=4).
    // We will inject 3 failures.
    // So we need at least 3 failures + 4 successes = 7 calls.

    mockMutationFn
      .mockResolvedValueOnce({ ...healthyGene, parameters: null }) // Fail 1
      .mockResolvedValueOnce({ ...healthyGene, parameters: undefined }) // Fail 2
      .mockResolvedValueOnce({ ...healthyGene, parameters: "string" as any }) // Fail 3
      .mockResolvedValueOnce({ ...healthyGene, id: 'child1', parameters: { temp: 0.8 } }) // Success 1
      .mockResolvedValueOnce({ ...healthyGene, id: 'child2', parameters: { temp: 0.9 } }) // Success 2
      .mockResolvedValueOnce({ ...healthyGene, id: 'child3', parameters: { temp: 0.5 } }) // Success 3
      .mockResolvedValueOnce({ ...healthyGene, id: 'child4', parameters: { temp: 0.6 } }); // Success 4

    // Evolve
    const nextGen = await engine.evolve(population);

    // Assertions
    // 1. Full population size (failures were retried)
    expect(nextGen).toHaveLength(4);

    // 2. All survivors have valid parameters
    nextGen.forEach(agent => {
      expect(agent.parameters).toBeDefined();
      expect(typeof agent.parameters).toBe('object');
      expect(agent.parameters).not.toBeNull();
    });

    // 3. Verify retries happened (3 failures + 4 successes = 7 calls minimum)
    expect(mockMutationFn).toHaveBeenCalledTimes(7);
  });
});
