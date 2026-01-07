import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('EvolutionEngine (Helix Guardrails)', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 4,
    mutationRate: 0.5, // 50% chance for test determinism
    eliteCount: 1,
    maxGenerations: 5
  };

  const mockGene: AgentGene = {
    id: 'gene-1',
    name: 'Agent Alpha',
    systemPrompt: 'You are a helpful assistant.',
    parameters: { temp: 0.7 },
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();
    // Default mocks
    mockFitnessFn.mockResolvedValue(0.5);
    mockCrossoverFn.mockImplementation(async (p1, p2) => ({
      ...p1,
      id: 'temp-id',
      name: `Child of ${p1.name} and ${p2.name}`,
      systemPrompt: p1.systemPrompt + ' + ' + p2.systemPrompt,
      generation: 0,
      lineage: []
    }));
    mockMutationFn.mockImplementation(async (g) => ({
      ...g,
      systemPrompt: g.systemPrompt + ' (mutated)'
    }));

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);
  });

  it('Micro-Universe: Should select, breed, and mutate correctly in one step', async () => {
    // Setup Micro-Universe (3 agents)
    const population: AgentGene[] = [
      { ...mockGene, id: 'a1', name: 'A1', fitness: 0.1 },
      { ...mockGene, id: 'a2', name: 'A2', fitness: 0.9 }, // Elite
      { ...mockGene, id: 'a3', name: 'A3', fitness: 0.5 }
    ];

    // Mock specific fitness outcomes if needed (already set in population for this test step)
    // The engine re-evaluates fitness if undefined, but we provided it.
    // Wait, the engine checks `if (gene.fitness === undefined)`.
    // So if we provide fitness, it skips evaluation. Perfect for testing selection.

    // Force Mutation to happen for the test
    const testConfig = { ...config, mutationRate: 1.0, eliteCount: 1, populationSize: 2 };
    engine = new EvolutionEngine(testConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const nextGen = await engine.evolve(population);

    // Assertions
    expect(nextGen).toHaveLength(2); // Population size maintained (or clipped)

    // 1. Elitism Check
    // The best agent (A2, fitness 0.9) should survive exactly as is (first element)
    expect(nextGen[0].id).toBe('a2');
    expect(nextGen[0].fitness).toBe(0.9);

    // 2. Offspring Check
    const offspring = nextGen[1];
    expect(offspring.id).not.toBe('a1');
    expect(offspring.id).not.toBe('a2');
    expect(offspring.id).not.toBe('a3');
    expect(offspring.generation).toBe(1); // 0 + 1

    // 3. Lineage Check
    expect(offspring.lineage).toHaveLength(2);
    expect(offspring.lineage[0]).toMatch(/a[1-3]/);

    // 4. Mutation Check
    expect(mockMutationFn).toHaveBeenCalled();
    expect(offspring.systemPrompt).toContain('(mutated)');
  });

  it('Gene Loss: Should preserve high fitness agents via elitism', async () => {
     const population: AgentGene[] = [
      { ...mockGene, id: 'weak', fitness: 0.1 },
      { ...mockGene, id: 'strong', fitness: 0.95 },
      { ...mockGene, id: 'avg', fitness: 0.5 }
    ];

    const nextGen = await engine.evolve(population);

    expect(nextGen[0].id).toBe('strong');
    expect(nextGen).toHaveLength(4); // Config pop size
  });

  it('Mutation Safety: Should handle mutation returning invalid structure (mocked rejection)', async () => {
    // Force mutation to 100% to ensure the mock is hit
    const testConfig = { ...config, mutationRate: 1.0 };
    engine = new EvolutionEngine(testConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    mockMutationFn.mockRejectedValueOnce(new Error("Invalid JSON"));

    const population: AgentGene[] = [
        { ...mockGene, id: 'p1', fitness: 0.8 },
        { ...mockGene, id: 'p2', fitness: 0.8 }
    ];

    // We expect the evolve function to fail or handle it.
    // If it fails, that's "guardrail" behavior (evolution stops on error).
    await expect(engine.evolve(population)).rejects.toThrow("Invalid JSON");
  });
});
