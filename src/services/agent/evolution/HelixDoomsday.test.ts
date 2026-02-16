import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Doomsday Switch Verification', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 4,
    mutationRate: 0.5,
    eliteCount: 1,
    maxGenerations: 5 // The Doomsday Limit
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

    // Default valid fitness
    mockFitnessFn.mockResolvedValue(0.5);

    // Default valid crossover
    mockCrossoverFn.mockImplementation(async (p1, p2) => ({
      ...p1,
      id: 'offspring',
      generation: Math.max(p1.generation, p2.generation) + 1, // Logic handled by engine, but mock reflects expectation
      lineage: [p1.id, p2.id]
    }));

    // Default valid mutation
    mockMutationFn.mockImplementation(async (g) => ({
        ...g,
        systemPrompt: g.systemPrompt + ' [MUTATED]'
    }));
  });

  it('Doomsday Triggered: Evolution strictly halts when Max Generations is reached', async () => {
    // 1. Setup: Population is already at the limit (Generation 5)
    const population: AgentGene[] = [
      { ...mockGene, id: 'old1', generation: 5, fitness: 0.8 },
      { ...mockGene, id: 'old2', generation: 5, fitness: 0.7 },
      { ...mockGene, id: 'old3', generation: 5, fitness: 0.6 },
      { ...mockGene, id: 'old4', generation: 5, fitness: 0.5 }
    ];

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // 2. Evolve
    const nextGen = await engine.evolve(population);

    // 3. Assertions
    // Should simply return the sorted population, stripped to populationSize
    expect(nextGen).toHaveLength(4);
    expect(nextGen[0].id).toBe('old1'); // Highest fitness

    // CRITICAL: Breeding functions must NOT be called
    expect(mockCrossoverFn).not.toHaveBeenCalled();
    expect(mockMutationFn).not.toHaveBeenCalled();

    // Verify no new generations were born
    const maxGen = Math.max(...nextGen.map(g => g.generation));
    expect(maxGen).toBe(5);
  });

  it('Doomsday Safe: Evolution proceeds normally when below the limit', async () => {
    // 1. Setup: Population is safely below limit (Generation 4)
    const population: AgentGene[] = [
      { ...mockGene, id: 'gen4_1', generation: 4, fitness: 0.8 },
      { ...mockGene, id: 'gen4_2', generation: 4, fitness: 0.7 }
    ];

    // We want to breed to fill the population size of 4
    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // 2. Evolve
    const nextGen = await engine.evolve(population);

    // 3. Assertions
    expect(nextGen).toHaveLength(4);

    // CRITICAL: Breeding functions MUST be called to fill the pool
    expect(mockCrossoverFn).toHaveBeenCalled();

    // Verify next generation exists
    const generations = nextGen.map(g => g.generation);
    expect(generations).toContain(5); // 4 + 1 = 5
  });

  it('Doomsday Edge Case: Mixed generations trigger halt if ANY reach limit', async () => {
     // Helix Philosophy: If any agent is "too old", we halt to inspect/preserve.
     // (Or strictly: if the max generation in the pool >= limit)

    // 1. Setup: Mixed generations, one hits the limit
    const population: AgentGene[] = [
      { ...mockGene, id: 'young', generation: 1, fitness: 0.9 },
      { ...mockGene, id: 'ancient', generation: 5, fitness: 0.8 } // Hits limit
    ];

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // 2. Evolve
    const nextGen = await engine.evolve(population);

    // 3. Assertions
    // Should halt because max(generations) == 5
    expect(mockCrossoverFn).not.toHaveBeenCalled();
    expect(nextGen).toHaveLength(2); // Just the sorted parents
    expect(nextGen[0].id).toBe('young'); // Fitness 0.9 wins sort
  });
});
