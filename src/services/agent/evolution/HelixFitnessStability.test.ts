import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

/**
 * 🧬 HELIX: FITNESS STABILITY & EDGE CASES
 *
 * "Survival of the fittest... even if the fitness is infinite."
 *
 * This test suite verifies the robustness of the ranking and selection mechanisms
 * against numeric edge cases (Infinity, Negative, NaN) and ensures deterministic behavior.
 */

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Fitness Stability & Edge Cases', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 4,
    mutationRate: 0.0, // Disable mutation to focus on selection
    eliteCount: 1,
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
    mockFitnessFn.mockResolvedValue(0.5);
    // Simple clone crossover
    mockCrossoverFn.mockImplementation(async (p1, p2) => ({
      ...p1,
      id: `child-${p1.id}-${p2.id}`,
      lineage: [p1.id, p2.id]
    }));
    mockMutationFn.mockImplementation(async (g) => g);
  });

  it('The Icarus Check: Agents with Infinity fitness dominate but do not crash the engine', async () => {
    // Scenario: An agent achieves "God Mode" (Fitness = Infinity).
    // The engine must sort it to the top and allow it to breed.
    // It must NOT cause calculation errors (NaN) during sorting.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
      { ...baseGene, id: 'Mortal', fitness: 100.0 },
      { ...baseGene, id: 'God', fitness: Infinity },
      { ...baseGene, id: 'Peasant', fitness: 1.0 }
    ];

    const nextGen = await engine.evolve(population);

    // 1. Sort Check
    // Infinity - 100 = Infinity (Positive). So God comes before Mortal.
    expect(nextGen[0].id).toBe('God');
    // Helix: We sanitize Infinity to Number.MAX_VALUE for safety
    expect(nextGen[0].fitness).toBe(Number.MAX_VALUE);

    // 2. Breeding Check
    // God should be in the mating pool.
    // Elite count is 1, so God survives as elite.
    // Offspring should come from God (since it's in the pool and has highest fitness).

    // Check offspring lineage
    const offspring = nextGen.slice(1);
    const godLineage = offspring.filter(c => c.lineage.includes('God'));
    expect(godLineage.length).toBeGreaterThan(0);
  });

  it('The Negative Feedback Loop: Negative fitness is treated as "Death" (excluded from breeding)', async () => {
    // Scenario: An agent performs terribly (Fitness = -100).
    // The filter `fitness > 0` should exclude it.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
      { ...baseGene, id: 'Good', fitness: 10.0 },
      { ...baseGene, id: 'Bad', fitness: -100.0 },
      { ...baseGene, id: 'Zero', fitness: 0.0 }
    ];

    const nextGen = await engine.evolve(population);

    // 1. Survival Check
    // Good should be elite.
    expect(nextGen[0].id).toBe('Good');

    // 2. Exclusion Check
    // Bad and Zero should NOT breed.
    // All offspring must come from 'Good' (forced self-crossover or Good+Good)
    const offspring = nextGen.slice(1);
    offspring.forEach(child => {
        expect(child.lineage).not.toContain('Bad');
        expect(child.lineage).not.toContain('Zero');
        expect(child.lineage).toEqual(['Good', 'Good']);
    });
  });

  it('Deterministic Stability: Equal fitness preserves input order (Stable Sort)', async () => {
    // Scenario: We have 3 agents with identical fitness.
    // We want to ensure that the sort is "stable", meaning their relative order is preserved.
    // This is important for reproducibility and testing.
    // If Elite Count is 1, the FIRST one in the list should win.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
      { ...baseGene, id: 'A', fitness: 10.0 },
      { ...baseGene, id: 'B', fitness: 10.0 },
      { ...baseGene, id: 'C', fitness: 10.0 }
    ];

    const nextGen = await engine.evolve(population);

    // If sort is stable, A should remain at index 0 and be picked as the Elite.
    expect(nextGen[0].id).toBe('A');
  });

  it('NaN Handling: NaN fitness is treated as Zero/Failure', async () => {
    // Scenario: Fitness function returns NaN (calculation error).
    // Comparison with NaN is always false.
    // (NaN - 5) is NaN.
    // The sort behavior with NaN is technically undefined in standard sort,
    // but we want to ensure it doesn't crash or sneak into elites if possible.
    // Ideally, we should sanitize NaNs to 0.

    // In EvolutionEngine.ts:
    // scoredPopulation.sort((a, b) => (b.fitness || 0) - (a.fitness || 0));
    // If fitness is NaN, (NaN || 0) depends on if NaN is falsy. NaN IS falsy.
    // So (NaN || 0) becomes 0.
    // So it should be safe!

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
      { ...baseGene, id: 'Valid', fitness: 10.0 },
      { ...baseGene, id: 'NotANumber', fitness: NaN }
    ];

    const nextGen = await engine.evolve(population);

    expect(nextGen[0].id).toBe('Valid');

    // Check that NaN was treated as 0 (effectively)
    const nanAgent = nextGen.find(g => g.id === 'NotANumber');
    // If it survived (as non-elite), its fitness should be NaN (preserved)
    // but it should not have beaten 'Valid'.
    if (nanAgent) {
        expect(nextGen.indexOf(nanAgent)).toBeGreaterThan(nextGen.indexOf(nextGen[0]));
    }
  });
});
