import { describe, it, expect, vi, afterEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 🧬 HELIX: MACRO-EVOLUTION TRAJECTORY
 *
 * "Evolution is not a circle, but a spiral upwards."
 *
 * This test verifies the "Arrow of Time" in the evolutionary process.
 * Unlike Micro-Universe tests which check a single step, this test runs
 * a simulation over multiple generations to prove that the population
 * actually OPTIMIZES towards the fitness function.
 *
 * CRITICAL: This test enforces strict determinism by mocking Math.random.
 */

describe('🧬 Helix: Macro-Evolution Trajectory', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 10,
    mutationRate: 1.0, // High rate to ensure rapid evolution
    eliteCount: 2,     // Protect the best
    maxGenerations: 10
  };

  const baseGene: AgentGene = {
    id: 'genesis',
    name: 'Genesis',
    systemPrompt: 'Base',
    parameters: { iq: 100 },
    generation: 0,
    lineage: []
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('The "Arrow of Time": Verifies population fitness improves over generations (Deterministic)', async () => {
    // 0. Enforce Determinism using a Linear Congruential Generator (LCG)
    // This ensures that "Selection" and "Mutation" random events are repeatable.
    let seed = 42;
    const deterministicRandom = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    vi.spyOn(Math, 'random').mockImplementation(deterministicRandom);

    // 1. Setup Fitness: IQ is Fitness
    const fitnessFn = vi.fn().mockImplementation(async (g) => g.parameters.iq);

    // 2. Setup Mutation: Random Walk with Positive Bias
    // We allow -5 to +10 change.
    // Since we control Math.random, this will be predictable sequence.
    const mutationFn = vi.fn().mockImplementation(async (g) => {
      const change = Math.floor(Math.random() * 16) - 5; // -5 to +10
      return {
        ...g,
        parameters: {
          ...g.parameters,
          iq: g.parameters.iq + change
        }
      };
    });

    // 3. Setup Crossover: Average of parents
    const crossoverFn = vi.fn().mockImplementation(async (p1, p2) => ({
      ...p1,
      id: uuidv4(),
      parameters: {
        iq: Math.floor((p1.parameters.iq + p2.parameters.iq) / 2)
      },
      generation: Math.max(p1.generation, p2.generation) + 1,
      lineage: [p1.id, p2.id]
    }));

    engine = new EvolutionEngine(config, fitnessFn, mutationFn, crossoverFn);

    // 4. Initialize Population (IQ = 100)
    let population: AgentGene[] = Array.from({ length: 10 }, (_, i) => ({
      ...baseGene,
      id: `gen0-${i}`,
      parameters: { iq: 100 }
    }));

    // 5. Run Simulation (5 Generations)
    const generations = 5;
    const history: { gen: number, maxIQ: number, avgIQ: number }[] = [];

    for (let i = 0; i < generations; i++) {
      population = await engine.evolve(population);

      const iqs = population.map(g => g.parameters.iq);
      const maxIQ = Math.max(...iqs);
      const avgIQ = iqs.reduce((a, b) => a + b, 0) / iqs.length;

      history.push({ gen: i + 1, maxIQ, avgIQ });
    }

    // 6. Assertions

    // Debug output
    // console.log('🧬 Deterministic Evolution History:', history);

    // A. Elitism Check: Max IQ should NEVER decrease
    let currentMax = 100;
    history.forEach(stat => {
        expect(stat.maxIQ).toBeGreaterThanOrEqual(currentMax);
        currentMax = stat.maxIQ;
    });

    // B. Optimization Check
    // With seed 42, we expect specific results.
    // If the logic changes, these values might change, but they should still show improvement.
    // We keep the assertions relatively loose (>110) to allow for minor logic tweaks,
    // but strict enough to prove optimization.
    const finalStat = history[history.length - 1];
    expect(finalStat.avgIQ).toBeGreaterThan(110);
    expect(finalStat.maxIQ).toBeGreaterThan(120);

    // C. Diversity Check
    const ids = new Set(population.map(g => g.id));
    expect(ids.size).toBe(population.length);
  });
});
