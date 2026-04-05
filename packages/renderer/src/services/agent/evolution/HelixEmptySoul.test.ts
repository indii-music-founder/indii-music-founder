import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Empty Soul Check (Guardrails)', () => {
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

  it('The Empty Soul Check: Rejects offspring with empty or whitespace-only system prompts', async () => {
    // Scenario: "The Empty Soul Defect"
    // A mutation (LLM hallucination or refusal) produces an empty string or just whitespace as the system prompt.
    // The engine must catch this "Soul-less" agent and prevent it from entering the population.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
      { ...healthyGene, id: 'p1' },
      { ...healthyGene, id: 'p2' }
    ];

    // 1. Setup Mutation failure sequence:
    // Call 1: Returns EMPTY string -> Should be rejected
    // Call 2: Returns WHITESPACE string -> Should be rejected
    // Call 3: Returns NULL (if type allows) -> Should be rejected
    // Subsequent calls: Return VALID prompts -> Should be accepted

    mockMutationFn
      .mockResolvedValueOnce({ ...healthyGene, systemPrompt: '' })         // Empty Soul 1
      .mockResolvedValueOnce({ ...healthyGene, systemPrompt: '   ' })      // Empty Soul 2
      .mockResolvedValueOnce({ ...healthyGene, systemPrompt: null as unknown as string }) // Empty Soul 3 (Type violation simulation)
      .mockResolvedValueOnce({ ...healthyGene, id: 'child1', systemPrompt: 'Valid 1' }) // Success 1
      .mockResolvedValueOnce({ ...healthyGene, id: 'child2', systemPrompt: 'Valid 2' }) // Success 2
      .mockResolvedValueOnce({ ...healthyGene, id: 'child3', systemPrompt: 'Valid 3' }) // Success 3
      .mockResolvedValueOnce({ ...healthyGene, id: 'child4', systemPrompt: 'Valid 4' }); // Success 4

    // 2. Evolve
    const nextGen = await engine.evolve(population);

    // 3. Assertions
    // A. Population Integrity: Full population size (failures were retried)
    expect(nextGen).toHaveLength(4);

    // B. Quality Control: All survivors have valid, non-empty prompts
    nextGen.forEach(child => {
      expect(child.systemPrompt).toBeTruthy();
      expect(child.systemPrompt.trim().length).toBeGreaterThan(0);
      expect(child.systemPrompt).toMatch(/Valid \d/);
    });

    // C. Verify Rejection Count
    // We expect 4 offspring.
    // We injected 3 failures.
    // Total calls should be at least 3 (fails) + 4 (successes) = 7 calls.
    expect(mockMutationFn).toHaveBeenCalledTimes(7);
  });
});
