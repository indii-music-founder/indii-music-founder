import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: JSON Safety (Serialization & Schema)', () => {
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

  it('Schema Integrity: Rejects offspring where parameters are an Array instead of an Object', async () => {
    // Scenario: The LLM returns a list of parameters `[{"temp": 0.7}]` instead of a map `{"temp": 0.7}`.
    // The engine must enforce that parameters are a strict Object (Map), not an Array.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // 1. Setup Mutation failure sequence:
    // Call 1: Returns INVALID parameters (Array) -> Should be rejected
    // Call 2: Returns VALID parameters (Object) -> Should be accepted
    mockMutationFn
      .mockResolvedValueOnce({ ...healthyGene, parameters: [{ temp: 0.5 }] as unknown as Record<string, unknown> }) // Defect: Array
      .mockResolvedValue({ ...healthyGene, parameters: { temp: 0.8 } });       // Valid

    const population: AgentGene[] = [
      { ...healthyGene, id: 'p1' },
      { ...healthyGene, id: 'p2' }
    ];

    // 2. Evolve
    const nextGen = await engine.evolve(population);

    // 3. Assertions
    expect(nextGen).toHaveLength(4);

    const offspring = nextGen.slice(1);
    offspring.forEach(child => {
      // Must be object
      expect(typeof child.parameters).toBe('object');
      // Must NOT be array
      expect(Array.isArray(child.parameters)).toBe(false);
      expect(child.parameters.temp).toBe(0.8);
    });

    // Verify rejection occurred (Mutation called more than necessary)
    // 1 Fail + 3 Success = 4 calls minimum
    expect(mockMutationFn.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('Serialization Safety: Rejects offspring with non-serializable properties (Circular References)', async () => {
    // Scenario: A mutation injects a Circular Reference into the agent parameters.
    // This renders the agent un-persistable to the database (JSON.stringify fails).
    // The engine must detect this and purge the agent.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // Create a circular object
    const circular: any = { temp: 0.5 };
    circular.self = circular;

    // 1. Setup Mutation failure sequence:
    // Call 1: Circular Reference -> Reject (JSON.stringify throws)
    // Call 2+: Valid -> Accept
    mockMutationFn
      .mockResolvedValueOnce({ ...healthyGene, parameters: circular })
      .mockResolvedValue({ ...healthyGene, parameters: { temp: 0.9 } });

    const population: AgentGene[] = [
      { ...healthyGene, id: 'p1' },
      { ...healthyGene, id: 'p2' }
    ];

    // 2. Evolve
    const nextGen = await engine.evolve(population);

    // 3. Assertions
    expect(nextGen).toHaveLength(4);

    const offspring = nextGen.slice(1);
    offspring.forEach(child => {
      // Must be serializable (implied by surviving the check we will add)
      expect(child.parameters.temp).toBe(0.9);
      expect(child.parameters.self).toBeUndefined();
    });

    // Verify rejection occurred
    // 1 Fail + 3 Success = 4 calls minimum
    expect(mockMutationFn.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
});
