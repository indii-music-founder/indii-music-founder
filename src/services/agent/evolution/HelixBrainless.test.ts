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
    systemPrompt: 'Valid Prompt',
    systemPrompt: 'Valid Code',
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
