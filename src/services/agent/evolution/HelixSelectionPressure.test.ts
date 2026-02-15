import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Selection Pressure (Tournament Logic)', () => {
  let engine: EvolutionEngine;

  // Configuration for a single breeding event to isolate selection logic
  const config: EvolutionConfig = {
    populationSize: 1, // Stop after 1 child
    mutationRate: 0.0,
    eliteCount: 0,
    maxGenerations: 5
  };

  const baseGene: AgentGene = {
    id: 'base',
    name: 'Base',
    systemPrompt: 'Prompt',
    parameters: {},
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockFitnessFn.mockImplementation(async (g) => g.fitness || 0);
    // Crossover returns a simple child with tracked lineage
    mockCrossoverFn.mockImplementation(async (p1, p2) => ({
      ...p1,
      id: `child-of-${p1.id}-${p2.id}`,
      lineage: [p1.id, p2.id]
    }));
    mockMutationFn.mockImplementation(async (g) => g);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Tournament Selection: Fitter agents eliminate weaker ones in head-to-head comparisons', async () => {
    // Scenario: A population of [Elite, Mid, Weak].
    // We orchestrate the "Random" values to force specific tournaments.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
      { ...baseGene, id: 'Elite', fitness: 100 }, // Index 0 (Sorted)
      { ...baseGene, id: 'Mid', fitness: 50 },    // Index 1
      { ...baseGene, id: 'Weak', fitness: 10 }    // Index 2
    ];

    // The Engine sorts by fitness descending, so indices are stable:
    // 0: Elite, 1: Mid, 2: Weak.

    const randomSpy = vi.spyOn(Math, 'random');

    // --- PARENT 1 SELECTION ---
    // Pool: [Elite, Mid, Weak] (Size 3)
    // Goal: Force "Mid" (Index 1) to beat "Weak" (Index 2).
    // Tournament: {Weak, Weak, Mid}
    randomSpy
      .mockReturnValueOnce(0.9) // Init: Index 2 (Weak)
      .mockReturnValueOnce(0.9) // Contender 1: Index 2 (Weak). Weak vs Weak -> No change.
      .mockReturnValueOnce(0.5); // Contender 2: Index 1 (Mid). Mid > Weak -> Best is Mid.
      // WINNER P1: Mid

    // --- PARENT 2 SELECTION ---
    // Pool: [Elite, Weak] (Size 2) - Mid is removed to prevent self-crossover
    // Indices: 0: Elite, 1: Weak
    // Goal: Force "Elite" (Index 0) to beat "Weak" (Index 1).
    // Tournament: {Weak, Elite, Weak}
    randomSpy
      .mockReturnValueOnce(0.9) // Init: Index 1 (Weak)
      .mockReturnValueOnce(0.1) // Contender 1: Index 0 (Elite). Elite > Weak -> Best is Elite.
      .mockReturnValueOnce(0.9); // Contender 2: Index 1 (Weak). Weak < Elite -> No change.
      // WINNER P2: Elite

    // --- MUTATION CHECK ---
    randomSpy.mockReturnValueOnce(0.99); // > 0.0 mutation rate (No mutation)

    // Run Evolution
    const nextGen = await engine.evolve(population);

    // Verify
    expect(nextGen).toHaveLength(1);
    const child = nextGen[0];

    // The child must be born of Mid and Elite
    expect(child.lineage).toContain('Mid');
    expect(child.lineage).toContain('Elite');

    // Crucially, 'Weak' should NOT be a parent, even though it started as the "Best" candidate in both tournaments.
    // This proves that fitness comparison logic works.
    expect(child.lineage).not.toContain('Weak');
  });
});
