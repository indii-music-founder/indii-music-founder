
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Bloat Check (Prompt Length Limit)', () => {
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

  it('Resource Exhaustion: Rejects offspring with oversized prompts (>100k chars)', async () => {
    // Scenario: A mutation causes the prompt to explode in size (e.g. recursive expansion).
    // This must be caught to prevent DoS or memory exhaustion.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // Create a giant prompt (100,001 chars)
    const giantPrompt = 'A'.repeat(100001);

    // 1. Setup Mutation failure sequence:
    // Call 1: Returns INVALID gene (Bloated Prompt) -> Should be rejected
    // Call 2: Returns VALID gene -> Should be accepted
    mockMutationFn
      .mockResolvedValueOnce({ ...healthyGene, systemPrompt: giantPrompt }) // Defect
      .mockResolvedValue({ ...healthyGene, systemPrompt: 'Valid Size Prompt' }); // Valid

    const population: AgentGene[] = [
      { ...healthyGene, id: 'p1' },
      { ...healthyGene, id: 'p2' }
    ];

    // 2. Evolve
    const nextGen = await engine.evolve(population);

    // 3. Assertions
    expect(nextGen).toHaveLength(4);

    // Verify offspring (non-elites) have valid prompt sizes
    const offspring = nextGen.slice(1);
    offspring.forEach(child => {
      expect(child.systemPrompt.length).toBeLessThanOrEqual(100000);
      expect(child.systemPrompt).not.toBe(giantPrompt);
    });

    // Verify rejection count
    // We expect mutation to be called:
    // 1 (Bloated) + 3 (Success needed for 3 spots) = 4 calls
    expect(mockMutationFn).toHaveBeenCalledTimes(4);
  });
});
