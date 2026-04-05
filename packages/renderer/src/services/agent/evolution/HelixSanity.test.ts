import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Sanity Checks (Guardrails)', () => {
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

  it('The Bloat Check: Rejects offspring with oversized system prompts (>100k chars)', async () => {
    // Scenario: "Runaway Mutation"
    // A mutation function goes rogue and returns a 2MB string.
    // The engine must reject this to prevent context window explosions.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // 1. Setup Mutation failure sequence:
    // Call 1: Returns BLOATED gene (150k chars) -> Should be rejected
    // Subsequent calls: Return VALID gene -> Should be accepted
    const bloatedPrompt = 'A'.repeat(150000);

    mockMutationFn
        .mockResolvedValueOnce({ ...healthyGene, systemPrompt: bloatedPrompt }) // 1st attempt (Bloat)
        .mockResolvedValue({ ...healthyGene, systemPrompt: 'Valid Short Prompt' }); // 2nd attempt (Valid)

    const population: AgentGene[] = [
      { ...healthyGene, id: 'p1' },
      { ...healthyGene, id: 'p2' }
    ];

    // 2. Evolve
    const nextGen = await engine.evolve(population);

    // 3. Assertions
    expect(nextGen).toHaveLength(4);

    // Verify offspring do NOT have the bloated prompt
    const offspring = nextGen.slice(1);
    offspring.forEach(child => {
      expect(child.systemPrompt.length).toBeLessThan(100000);
      expect(child.systemPrompt).not.toBe(bloatedPrompt);
    });

    // Verify rejection occurred (Mutation called more than strictly necessary)
    // We need 3 offspring. 1st attempt failed. So at least 4 calls.
    expect(mockMutationFn.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
});
