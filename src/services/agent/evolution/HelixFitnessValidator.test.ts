import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Fitness Validator (Quality Control)', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 4,
    mutationRate: 1.0, // Force mutation
    eliteCount: 1, // Keep 1 elite
    maxGenerations: 5
  };

  const baseGene: AgentGene = {
    id: 'base',
    name: 'Base Agent',
    systemPrompt: 'Prompt',
    parameters: {},
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();
    // Default: Mutation and Crossover work
    mockMutationFn.mockImplementation(async (g) => ({ ...g, id: 'mutated-' + g.id }));
    mockCrossoverFn.mockImplementation(async (p1, p2) => ({ ...p1, id: 'child', lineage: [p1.id, p2.id] }));
  });

  it('The Zero-Fitness Barrier: Agents with 0.0 fitness are strictly excluded from the mating pool', async () => {
    // Scenario: Population has some healthy agents (1.0) and some dead-weight (0.0).
    // The dead-weight should NEVER become parents.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
      { ...baseGene, id: 'Alpha', fitness: 1.0 },
      { ...baseGene, id: 'Beta', fitness: 1.0 },
      { ...baseGene, id: 'Zombie1', fitness: 0.0 },
      { ...baseGene, id: 'Zombie2', fitness: 0.0 }
    ];

    // Mock Fitness Check: Just return the pre-assigned fitness
    mockFitnessFn.mockImplementation(async (g) => g.fitness);

    // Evolve
    const nextGen = await engine.evolve(population);

    // Assertions
    expect(nextGen).toHaveLength(4);

    // Check lineages of all new offspring (those that are not the elite survivor)
    // Since eliteCount=1, index 0 is the elite (Alpha or Beta).
    // Indices 1, 2, 3 are offspring.
    const offspring = nextGen.slice(1);

    offspring.forEach(child => {
        // Lineage must NOT contain Zombies
        expect(child.lineage).not.toContain('Zombie1');
        expect(child.lineage).not.toContain('Zombie2');
        // Must contain healthy parents
        const hasAlphaOrBeta = child.lineage.includes('Alpha') || child.lineage.includes('Beta');
        expect(hasAlphaOrBeta).toBe(true);
    });
  });

  it('Mass Extinction: Evolution halts if NO agents have >0 fitness', async () => {
    // Scenario: A catastrophic failure where all agents score 0.0.
    // The engine should not attempt to breed (division by zero / empty pool).
    // Instead, it should just return the surviving elites (even if they are 0 fitness, they are the best we have).

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
      { ...baseGene, id: 'Dead1', fitness: 0.0 },
      { ...baseGene, id: 'Dead2', fitness: 0.0 },
      { ...baseGene, id: 'Dead3', fitness: 0.0 }
    ];

    mockFitnessFn.mockResolvedValue(0.0);

    const nextGen = await engine.evolve(population);

    // Should return only the elites. Config eliteCount is 1.
    expect(nextGen).toHaveLength(1);
    expect(nextGen[0].id).toMatch(/Dead/);

    // Ensure NO breeding happened
    expect(mockCrossoverFn).not.toHaveBeenCalled();
    expect(mockMutationFn).not.toHaveBeenCalled();
  });

  it('Resilience: Agents that crash the fitness function are treated as 0.0 and culled', async () => {
    // Scenario: One agent causes the fitness function to throw.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
        { ...baseGene, id: 'Healthy', fitness: undefined }, // Needs eval
        { ...baseGene, id: 'Toxic', fitness: undefined }    // Needs eval
    ];

    mockFitnessFn.mockImplementation(async (g) => {
        if (g.id === 'Toxic') throw new Error("Kaboom");
        return 1.0;
    });

    const nextGen = await engine.evolve(population);

    // Healthy should be elite (1.0 > 0.0)
    expect(nextGen[0].id).toBe('Healthy');

    // Offspring should be born from Healthy (since Toxic is 0.0/excluded)
    const offspring = nextGen.slice(1);
    offspring.forEach(child => {
        expect(child.lineage).not.toContain('Toxic');
        expect(child.lineage).toContain('Healthy');
    });
  });
});
