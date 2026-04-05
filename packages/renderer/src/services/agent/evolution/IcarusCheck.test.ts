import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Icarus Check (Infinite Fitness Handling)', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 4,
    mutationRate: 0.1,
    eliteCount: 1,
    maxGenerations: 5
  };

  const mockGene: AgentGene = {
    id: 'gene-template',
    name: 'Agent Template',
    systemPrompt: 'Base Prompt',
    parameters: { temp: 0.7 },
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Default mocks
    mockMutationFn.mockImplementation(async (g) => g);
    mockCrossoverFn.mockImplementation(async (p1) => p1);

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);
  });

  it('In-Memory: Correctly ranks Infinity as the absolute Elite', async () => {
    const population: AgentGene[] = [
      { ...mockGene, id: 'normal', fitness: 100 },
      { ...mockGene, id: 'god', fitness: Infinity }, // The Icarus Agent
      { ...mockGene, id: 'weak', fitness: 0.1 }
    ];

    // We rely on the engine's sorting logic, but we need to run evolve to trigger it.
    // Evolve recalculates fitness if undefined, but ours are defined.
    // It then sorts.

    // We set eliteCount to 1 so only the best survives as elite.
    const testConfig = { ...config, eliteCount: 1, mutationRate: 0 };
    engine = new EvolutionEngine(testConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const nextGen = await engine.evolve(population);

    const survivor = nextGen[0];
    expect(survivor!.id).toBe('god');
    expect(survivor!.fitness).toBe(Number.MAX_VALUE);
  });

  it('Persistence: Infinity survives JSON serialization (Simulation of DB Save)', async () => {
    const population: AgentGene[] = [
      { ...mockGene, id: 'god', fitness: Infinity }
    ];

    const testConfig = { ...config, eliteCount: 1 };
    engine = new EvolutionEngine(testConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const nextGen = await engine.evolve(population);
    const survivor = nextGen[0];

    // Simulate DB Persistence (JSON.stringify)
    const serialized = JSON.stringify(survivor);
    const deserialized = JSON.parse(serialized);

    // If Infinity was not sanitized, it becomes null in JSON
    // And null is often treated as 0 or failure in fitness checks.

    // We expect the engine to have sanitized it to Number.MAX_VALUE or similar safe value
    // So that it remains a very large number.
    expect(deserialized.fitness).not.toBeNull();
    expect(deserialized.fitness).not.toBe(0);
    expect(typeof deserialized.fitness).toBe('number');
    expect(deserialized.fitness).toBeGreaterThan(1000000000); // Should be very large
  });
});
