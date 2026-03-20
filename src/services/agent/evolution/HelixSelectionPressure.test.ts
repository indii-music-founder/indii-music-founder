import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock secureRandomInt for deterministic tournament selection
// secureRandomInt(min, max) returns a value in [min, max) (exclusive upper bound)
const mockSecureRandomInt = vi.fn();
vi.mock('@/utils/crypto-random', () => ({
    secureRandomInt: (...args: unknown[]) => mockSecureRandomInt(...args),
    secureRandomHex: vi.fn().mockReturnValue('deadbeef'),
}));

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
    // We orchestrate secureRandomInt to force specific tournament outcomes.
    //
    // The Engine sorts by fitness descending, so after sorting indices are:
    //   0: Elite (fitness=100), 1: Mid (fitness=50), 2: Weak (fitness=10)
    //
    // selectParent uses tournament of size 3:
    //   best = pool[secureRandomInt(0, pool.length)]   <-- initial pick
    //   contender1 = pool[secureRandomInt(0, pool.length)]  <-- compare
    //   contender2 = pool[secureRandomInt(0, pool.length)]  <-- compare

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
      { ...baseGene, id: 'Elite', fitness: 100 }, // Index 0 (Sorted)
      { ...baseGene, id: 'Mid', fitness: 50 },    // Index 1
      { ...baseGene, id: 'Weak', fitness: 10 }    // Index 2
    ];

    // --- PARENT 1 SELECTION ---
    // Pool: [Elite, Mid, Weak] (Size 3)
    // Goal: Force "Mid" (Index 1) to win the tournament.
    // Tournament: {Weak(2), Weak(2), Mid(1)} → Mid wins by fitness comparison.
    mockSecureRandomInt
      .mockReturnValueOnce(2)   // Init: Index 2 (Weak) — best = Weak
      .mockReturnValueOnce(2)   // Contender 1: Index 2 (Weak). Weak vs Weak → No change.
      .mockReturnValueOnce(1)   // Contender 2: Index 1 (Mid). Mid > Weak → best = Mid.
      // WINNER P1: Mid

    // --- PARENT 2 SELECTION ---
    // Pool: [Elite, Weak] (Size 2) - Mid removed to prevent self-crossover
    // Indices: 0: Elite, 1: Weak
    // Goal: Force "Elite" (Index 0) to win the tournament.
    // Tournament: {Weak(1), Elite(0), Weak(1)} → Elite wins.
      .mockReturnValueOnce(1)   // Init: Index 1 (Weak) — best = Weak
      .mockReturnValueOnce(0)   // Contender 1: Index 0 (Elite). Elite > Weak → best = Elite.
      .mockReturnValueOnce(1)   // Contender 2: Index 1 (Weak). Weak < Elite → No change.
      // WINNER P2: Elite

    // --- MUTATION CHECK ---
    // secureRandomInt(0, 1000) / 1000 ≥ 0.0 (mutationRate), so we want > 0 to NOT mutate
    // But mutationRate is 0.0, so any value ≥ 0 should prevent mutation.
    // Actually, the check is `secureRandomInt(0, 1000) / 1000 < 0.0` which is always false.
    // So mutation never happens regardless of this value. But we still need to provide it
    // since the code calls secureRandomInt.
      .mockReturnValueOnce(500);

    // Run Evolution
    const nextGen = await engine.evolve(population);

    // Verify
    expect(nextGen).toHaveLength(1);
    const child = nextGen[0];

    // The child must be born of Mid and Elite
    expect(child!.lineage).toContain('Mid');
    expect(child!.lineage).toContain('Elite');

    // Crucially, 'Weak' should NOT be a parent, even though it started as the "Best" candidate in both tournaments.
    // This proves that fitness comparison logic works.
    expect(child!.lineage).not.toContain('Weak');
  });
});
