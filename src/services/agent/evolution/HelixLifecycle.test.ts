import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

/**
 * HELIX TEST SUITE: LIFECYCLE & STATE INTEGRITY
 * Verifies that the Evolutionary Engine correctly manages the state transitions of genes.
 * Focus: Preventing "Zombie Genes" (agents bypassing fitness checks) and ensuring structural continuity.
 */

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Lifecycle & State Integrity', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 4,
    mutationRate: 0.5,
    eliteCount: 1,
    maxGenerations: 5
  };

  const parentGene: AgentGene = {
    id: 'parent',
    name: 'Parent Agent',
    systemPrompt: 'Legacy Prompt',
    parameters: { temp: 0.8, model: 'gemini-pro' }, // Genetic Payload
    fitness: 1.0,
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Default favorable mocks
    mockFitnessFn.mockResolvedValue(0.5); // Default fitness for new agents

    // Crossover returns a gene that *looks* like it has fitness (simulating a bug in crossover logic)
    mockCrossoverFn.mockImplementation(async (p1, p2) => ({
      ...p1,
      id: 'child-draft',
      // CRITICAL: We simulate a crossover function that accidentally copies the parent's fitness
      // The Engine MUST overwrite this to undefined.
      fitness: p1.fitness,
      parameters: p1.parameters // Inherit payload
    }));

    mockMutationFn.mockImplementation(async (g) => ({
      ...g,
      systemPrompt: g.systemPrompt + ' [MUTATED]'
    }));

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);
  });

  it('The Zombie Check: Offspring must be born with undefined fitness to force re-evaluation', async () => {
    // Scenario: A "Zombie Gene" is an agent that inherits a high fitness score from a parent
    // but has never actually been evaluated itself. If the engine doesn't reset fitness,
    // this agent will bypass the fitness function in the next generation.

    const population: AgentGene[] = [
      { ...parentGene, id: 'elite', fitness: 1.0 },
      { ...parentGene, id: 'p2', fitness: 0.9 },
      { ...parentGene, id: 'weak1', fitness: 0.1 },
      { ...parentGene, id: 'weak2', fitness: 0.1 }
    ];

    // 1. Evolve
    const nextGen = await engine.evolve(population);

    // 2. Identify the Elite (who keeps fitness) vs The Offspring (who must lose it)
    const elite = nextGen[0];
    const offspring = nextGen[1]; // Index 1 is the first child

    // Assert Elite behavior (Control Group)
    expect(elite.id).toBe('elite');
    expect(elite.fitness).toBe(1.0); // Elite preserves fitness (efficiency)

    // Assert Zombie Prevention
    expect(offspring.id).not.toBe('elite');
    expect(offspring.fitness).toBeUndefined(); // MUST be undefined

    // 3. Verify that if we ran another cycle, this offspring WOULD be evaluated
    // (We simulate this by checking if the engine would call fitnessFn for it)
    // We can't easily call evolve again on just this agent without full setup,
    // but the undefined state proves the intent.
  });

  it('Genetic Payload Integrity: Parameters are preserved through the birth channel', async () => {
    // Scenario: Ensure that while we reset metadata (id, fitness, lineage),
    // we do NOT accidentally wipe the "Genetic Payload" (parameters).

    const population: AgentGene[] = [
      { ...parentGene, id: 'p1', fitness: 1.0 },
      { ...parentGene, id: 'p2', fitness: 1.0 }
    ];

    const testConfig = { ...config, populationSize: 2, eliteCount: 0 }; // No elites, pure breeding
    engine = new EvolutionEngine(testConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const nextGen = await engine.evolve(population);
    const child = nextGen[0];

    // Assert Parameters still exist
    expect(child.parameters).toBeDefined();
    expect(child.parameters.temp).toBe(0.8);
    expect(child.parameters.model).toBe('gemini-pro');

    // Assert Metadata was updated
    expect(child.generation).toBe(1);
    expect(child.lineage.length).toBe(2);
  });
});
