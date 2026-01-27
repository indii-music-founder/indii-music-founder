import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Evolutionary Resilience', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 4,
    mutationRate: 0.0, // No mutation for this test
    eliteCount: 1,
    maxGenerations: 5
  };

  const mockGene: AgentGene = {
    id: 'gene-template',
    name: 'Agent',
    systemPrompt: 'Prompt',
    parameters: {},
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockMutationFn.mockImplementation(async (g) => g);
    mockCrossoverFn.mockImplementation(async (p1) => ({ ...p1, id: 'child' }));

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);
  });

  it('Fitness Resilience: Toxic agents crashing fitness check are assigned 0.0 and do not halt evolution', async () => {
    const population: AgentGene[] = [
      { ...mockGene, id: 'healthy1' },
      { ...mockGene, id: 'toxic' },
      { ...mockGene, id: 'healthy2' }
    ];

    mockFitnessFn.mockImplementation(async (gene) => {
      if (gene.id === 'toxic') {
        throw new Error("Safety Filter Triggered");
      }
      return 1.0;
    });

    // This should NOT throw
    const nextGen = await engine.evolve(population);

    expect(nextGen).toHaveLength(4); // Should still fill population

    // The toxic agent should effectively be treated as 0 fitness
    // Since we have elitism=1, one of the healthy ones (fitness 1.0) should be elite.
    // The toxic one (fitness 0 or undefined) should likely not be elite.

    const survivor = nextGen[0];
    expect(survivor.id).not.toBe('toxic');
    expect(survivor.fitness).toBe(1.0);
  });

  it('Infinite Loop Protection: Returns partial population when breeding consistently fails (Retry Exhaustion)', async () => {
    // Scenario: All breeding attempts fail (e.g. LLM down, strict safety filters).
    // The engine must NOT hang forever. It should try up to MAX_ATTEMPTS and then give up,
    // returning whatever elites survived.

    const testConfig = { ...config, populationSize: 5, eliteCount: 1, mutationRate: 1.0 };
    engine = new EvolutionEngine(testConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
      { ...mockGene, id: 'elite', fitness: 1.0 }, // 1 Elite
      { ...mockGene, id: 'weak1', fitness: 0.1 },
      { ...mockGene, id: 'weak2', fitness: 0.1 }
    ];

    // Mock 100% Failure Rate
    mockMutationFn.mockRejectedValue(new Error("Persistent Failure"));

    const nextGen = await engine.evolve(population);

    // Assertion 1: Did not crash
    // Assertion 2: Returns ONLY the elite (since no offspring could be born)
    expect(nextGen).toHaveLength(1);
    expect(nextGen[0].id).toBe('elite');

    // Assertion 3: Tried HARD enough (MAX_ATTEMPTS)
    // Formula: populationSize * 5 = 5 * 5 = 25 attempts
    // Note: Crossover happens first. If Crossover succeeds but Mutation fails, we retry.
    // If Mutation fails, the loop continues.
    // So mutationFn should be called ~25 times.
    expect(mockMutationFn).toHaveBeenCalledTimes(25);
  });
});
