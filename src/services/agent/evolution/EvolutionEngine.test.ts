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

  it('Resilience: Should discard offspring that fail mutation and continue evolution', async () => {
    // Force mutation to 100%
    const testConfig = { ...config, mutationRate: 1.0, populationSize: 2, eliteCount: 1 };
    engine = new EvolutionEngine(testConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // First mutation call fails, second succeeds
    mockMutationFn
      .mockRejectedValueOnce(new Error("Invalid JSON"))
      .mockResolvedValueOnce({ ...mockGene, id: 'valid-offspring', systemPrompt: 'valid' });

    const population: AgentGene[] = [
        { ...mockGene, id: 'p1', fitness: 0.8 },
        { ...mockGene, id: 'p2', fitness: 0.8 }
    ];

    const nextGen = await engine.evolve(population);

    expect(nextGen).toHaveLength(2);
    expect(nextGen[0].id).toBe('p1'); // Elite (or p2 depending on sort, but both 0.8)
    expect(nextGen[1].id).not.toBe('p1'); // New offspring
    expect(mockMutationFn).toHaveBeenCalledTimes(2); // One fail, one success
  });

  it('Full Evolutionary Loop: Should evaluate fitness, select, breed, and mutate', async () => {
    // Setup Micro-Universe (3 agents) with NO fitness scores
    const population: AgentGene[] = [
      { ...mockGene, id: 'a1', name: 'A1', fitness: undefined },
      { ...mockGene, id: 'a2', name: 'A2', fitness: undefined },
      { ...mockGene, id: 'a3', name: 'A3', fitness: undefined }
    ];

    // Mock Fitness Function to return distinct values based on ID
    mockFitnessFn.mockImplementation(async (gene) => {
      if (gene.id === 'a1') return 0.1;
      if (gene.id === 'a2') return 0.9;
      if (gene.id === 'a3') return 0.5;
      return 0;
    });

    // Force Mutation to happen for the test
    const testConfig = { ...config, mutationRate: 1.0, eliteCount: 1, populationSize: 2 };
    engine = new EvolutionEngine(testConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const nextGen = await engine.evolve(population);

    // 1. Verify Fitness Evaluation happened
    expect(mockFitnessFn).toHaveBeenCalledTimes(3); // Once for each initial agent
    expect(mockFitnessFn).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));

    // 2. Verify Elitism based on the calculated fitness
    // A2 should be the elite (0.9)
    expect(nextGen[0].id).toBe('a2');
    expect(nextGen[0].fitness).toBe(0.9);

    // 3. Verify Offspring creation (Selection + Crossover + Mutation)
    const offspring = nextGen[1];
    expect(offspring.generation).toBe(1);
    expect(offspring.fitness).toBeUndefined(); // Offspring should be unscored
    expect(offspring.systemPrompt).toContain('(mutated)');

    // 4. Verify Selection used the scored population
    expect(mockCrossoverFn).toHaveBeenCalled();
    const crossoverCall = mockCrossoverFn.mock.calls[0];
    const p1 = crossoverCall[0] as AgentGene;
    const p2 = crossoverCall[1] as AgentGene;
    expect(p1.fitness).toBeDefined();
    expect(p2.fitness).toBeDefined();
  });
});
