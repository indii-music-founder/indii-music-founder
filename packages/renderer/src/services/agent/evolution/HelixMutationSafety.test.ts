import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Mutation Safety (Evolutionary Loop)', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 4,
    mutationRate: 1.0, // Force mutation for every offspring
    eliteCount: 1,
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
    mockMutationFn.mockImplementation(async (g) => ({ ...g, systemPrompt: 'Mutated Code' }));
  });

  it('Mutation Safety: Retries evolution step if mutation fails (simulating invalid syntax/JSON)', async () => {
    // Scenario: The Mutation Function (LLM) is flaky and frequently returns invalid JSON or syntax errors.
    // The "Helix Philosophy" requires that we do not let these broken agents into the population.
    // Instead, the engine should catch the error and RETRY the breeding step until a valid offspring is born.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
      { ...healthyGene, id: 'p1' },
      { ...healthyGene, id: 'p2' }
    ];

    // 1. Setup Flaky Mutation
    // Attempts 1-2: Throw Error (Simulating "Syntax Error" or "Invalid JSON")
    // Attempt 3: Success
    // Attempts 4-5: Throw Error
    // Attempt 6: Success
    // We need 3 offspring (Pop 4 - 1 Elite = 3).
    // So we expect multiple failures before filling the pool.

    const error = new Error("Helix Guardrail: Invalid JSON Syntax");
    mockMutationFn
        .mockRejectedValueOnce(error) // Fail 1
        .mockRejectedValueOnce(error) // Fail 2
        .mockResolvedValueOnce({ ...healthyGene, id: 'child1', systemPrompt: 'Valid 1' }) // Success 1
        .mockRejectedValueOnce(error) // Fail 3
        .mockRejectedValueOnce(error) // Fail 4
        .mockResolvedValueOnce({ ...healthyGene, id: 'child2', systemPrompt: 'Valid 2' }) // Success 2
        .mockResolvedValue({ ...healthyGene, id: 'child3', systemPrompt: 'Valid 3' });    // Success 3 (Rest)

    // 2. Evolve
    const nextGen = await engine.evolve(population);

    // 3. Assertions

    // A. Population Integrity: We must still have a full population
    expect(nextGen).toHaveLength(4);

    // B. Quality Control: All survivors must be valid (no errors leaked)
    const offspring = nextGen.slice(1);
    offspring.forEach(child => {
        expect(child.systemPrompt).toMatch(/Valid \d/);
    });

    // C. Persistence: Verify that the engine actually retried multiple times
    // We mocked 4 failures and 3 successes. Total calls should be >= 7.
    // (Note: it might be slightly different depending on exact retry loop, but definitely > 3)
    expect(mockMutationFn.mock.calls.length).toBeGreaterThanOrEqual(7);
  });

  it('Infinite Loop Prevention: Halts evolution and returns partial population if mutation consistently fails', async () => {
    // Scenario: "Total Mutation Failure" (e.g., API Down or Fatal Prompt Error).
    // If the mutation function FAILS 100% of the time, the engine must NOT hang in an infinite `while` loop.
    // It should hit the `MAX_ATTEMPTS` safety break and return whatever population it has managed to build (likely just elites).

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
      { ...healthyGene, id: 'p1' },
      { ...healthyGene, id: 'p2' }
    ];

    // 1. Setup Fatal Mutation
    // Always rejects.
    const fatalError = new Error("Helix Guardrail: API DOWN");
    mockMutationFn.mockRejectedValue(fatalError);

    // 2. Evolve
    // This calls `evolve`, which enters the while loop.
    // It should retry until `MAX_ATTEMPTS` (PopSize * 5 = 20) is reached, then exit.
    const nextGen = await engine.evolve(population);

    // 3. Assertions

    // A. Population Integrity: Should only contain the Elite (since no offspring survived)
    // Config: EliteCount = 1.
    expect(nextGen).toHaveLength(1);
    expect(nextGen[0]!.id).toBe('p1'); // p1 is first in list, assuming fit. (Mock fitness is 1.0)

    // B. Infinite Loop Check: Verify we didn't run forever, but DID try enough times
    // MAX_ATTEMPTS = 4 * 5 = 20.
    // The engine increments `attempts` on every loop.
    // Ideally, mutationFn calls should be close to 20.
    expect(mockMutationFn.mock.calls.length).toBeGreaterThanOrEqual(20);
    expect(mockMutationFn.mock.calls.length).toBeLessThan(30); // Sanity check to ensure it didn't run *too* long
  });
});
