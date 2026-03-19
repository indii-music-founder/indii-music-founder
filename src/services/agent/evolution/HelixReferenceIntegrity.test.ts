import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

/**
 * HELIX TEST SUITE: REFERENCE INTEGRITY
 * Verifies that the Evolutionary Engine protects existing agents (Elites)
 * from being corrupted by "Rogue" Crossover/Mutation functions that modify objects in-place.
 */

const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Reference Integrity (Anti-Corruption)', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 4,
    mutationRate: 1.0, // Force mutation
    eliteCount: 1,     // Keep 1 Elite
    maxGenerations: 5
  };

  const eliteGene: AgentGene = {
    id: 'elite-agent',
    name: 'The Elite',
    systemPrompt: 'Perfect Prompt',
    parameters: { temp: 0.1 },
    fitness: 100.0,
    generation: 0,
    lineage: []
  };

  const weakGene: AgentGene = {
    id: 'weak-agent',
    name: 'Weakling',
    systemPrompt: 'Bad Prompt',
    parameters: { temp: 0.9 },
    fitness: 1.0,
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockFitnessFn.mockImplementation(async (g) => g.fitness || 0);
  });

  it('Mutation by Reference: Elite agents must NOT be modified by rogue mutation functions', async () => {
    // Scenario:
    // 1. "Lazy Crossover": Returns parent reference instead of new object.
    // 2. "In-Place Mutation": Modifies the gene object directly.
    // 3. Result: If not guarded, the Elite (parent) in the next generation gets mutated!

    // Setup: Lazy Crossover (Returns Parent 1 directly)
    mockCrossoverFn.mockImplementation(async (p1, p2) => {
      return p1; // DANGER: Returning reference!
    });

    // Setup: Rogue Mutation (Modifies in-place)
    mockMutationFn.mockImplementation(async (g) => {
      g.systemPrompt += ' [CORRUPTED]'; // DANGER: Modifying in-place!
      return g;
    });

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population = [
      { ...eliteGene }, // Pass a copy to start, so we don't modify our test constant
      { ...weakGene },
      { ...weakGene },
      { ...weakGene }
    ];

    // Verify initial state
    expect(population[0]!.systemPrompt).toBe('Perfect Prompt');

    // Evolve
    const nextGen = await engine.evolve(population);

    // Assertions
    const survivor = nextGen[0];

    // 1. Elite Integrity
    // The survivor (index 0) must be the Elite.
    expect(survivor!.id).toBe('elite-agent');

    // CRITICAL CHECK: It must NOT have the [CORRUPTED] tag.
    // If this fails, it means the Mutation corrupted the Elite held in the 'elites' array.
    expect(survivor!.systemPrompt).toBe('Perfect Prompt');
    expect(survivor!.systemPrompt).not.toContain('[CORRUPTED]');

    // 2. Offspring Check
    // The offspring (index 1) SHOULD be mutated (that's the point of evolution)
    const offspring = nextGen[1];
    expect(offspring!.systemPrompt).toContain('[CORRUPTED]');

    // 3. Independence
    // The offspring must be a DIFFERENT object than the survivor,
    // even though Crossover returned the same reference initially.
    expect(offspring).not.toBe(survivor);
  });

  it('Parameter Integrity: Nested objects (parameters) must be deep-cloned to prevent shared mutable state', async () => {
    // Scenario: The "Quantum Entanglement" Bug.
    // 1. Crossover returns Parent 1 reference.
    // 2. Mutation modifies `parameters.temp` IN PLACE.
    // 3. Since `parameters` is an object, if we only did a shallow copy, the Elite's parameters would change too.
    // Helix `structuredClone` guardrail must prevent this.

    // Setup: Lazy Crossover (Returns Parent 1 directly)
    mockCrossoverFn.mockImplementation(async (p1, p2) => {
      return p1; // DANGER: Reference return
    });

    // Setup: Rogue Mutation (Modifies nested property in-place)
    mockMutationFn.mockImplementation(async (g) => {
      g.parameters.temp = 999.999; // DANGER: Nested In-Place Modification!
      return g;
    });

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population = [
      { ...eliteGene, parameters: { temp: 0.1 } }, // Elite starts with 0.1
      { ...weakGene },
      { ...weakGene },
      { ...weakGene }
    ];

    // Evolve
    const nextGen = await engine.evolve(population);

    const survivor = nextGen[0];
    const offspring = nextGen[1];

    // 1. Elite Integrity
    expect(survivor!.id).toBe('elite-agent');
    // The Elite must STILL have temp 0.1.
    // If it is 999.999, the guardrail failed and the Elite was corrupted by its child.
    expect(survivor!.parameters.temp).toBe(0.1);

    // 2. Offspring Check
    // The offspring SHOULD have the mutation
    expect(offspring!.parameters.temp).toBe(999.999);

    // 3. Deep Independence
    expect(offspring!.parameters).not.toBe(survivor!.parameters);
  });
});
