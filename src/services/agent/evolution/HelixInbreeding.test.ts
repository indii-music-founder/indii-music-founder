import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

/**
 * 🧬 HELIX: INBREEDING & DIVERSITY CHECK
 *
 * "Diversity is a metric; measure it."
 *
 * This test suite verifies that the evolutionary engine actively prevents inbreeding
 * and maintains population diversity, even when resources are scarce.
 */

describe('🧬 Helix: Inbreeding Prevention', () => {
  // Top-level mocks to avoid shadowing issues
  const mockFitnessFn = vi.fn();
  const mockMutationFn = vi.fn();
  const mockCrossoverFn = vi.fn();

  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 4,
    mutationRate: 0.5,
    eliteCount: 0, // Disable elitism to focus on breeding behavior
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

    // Default: All agents are perfectly fit
    mockFitnessFn.mockResolvedValue(1.0);

    // Default: Mutation is neutral (identity)
    mockMutationFn.mockImplementation(async (g) => g);

    // Default: Crossover creates a valid child with tracked lineage
    mockCrossoverFn.mockImplementation(async (p1, p2) => ({
      ...p1,
      id: `child-of-${p1.id}-${p2.id}`,
      lineage: [p1.id, p2.id]
    }));
  });

  it('Sexual Selection: Enforces distinct parents when compatible partners exist', async () => {
    // Scenario: We have 3 distinct, fit agents.
    // The engine MUST NOT select the same agent twice for crossover (Asexual reproduction).

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
      { ...baseGene, id: 'agent-A' },
      { ...baseGene, id: 'agent-B' },
      { ...baseGene, id: 'agent-C' }
    ];

    await engine.evolve(population);

    // Verify every crossover event used two DIFFERENT parents
    expect(mockCrossoverFn).toHaveBeenCalled();
    mockCrossoverFn.mock.calls.forEach(call => {
      const [p1, p2] = call as [AgentGene, AgentGene];
      expect(p1.id).not.toBe(p2.id);
    });
  });

  it('Emergency Breeding: Allows self-crossover only when no other partners exist (Last Man Standing)', async () => {
    // Scenario: Mass Extinction event. Only ONE agent survives (Fitness > 0).
    // The engine must fallback to self-crossover (asexual) to repopulate the earth.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
      { ...baseGene, id: 'survivor', fitness: 1.0 },
      { ...baseGene, id: 'dead1', fitness: 0.0 }, // Killed by fitness validator
      { ...baseGene, id: 'dead2', fitness: 0.0 }
    ];

    await engine.evolve(population);

    expect(mockCrossoverFn).toHaveBeenCalled();
    mockCrossoverFn.mock.calls.forEach(call => {
      const [p1, p2] = call as [AgentGene, AgentGene];
      expect(p1.id).toBe('survivor');
      expect(p2.id).toBe('survivor');
    });
  });

  it('Lineage Tracking: Offspring record correct parent IDs', async () => {
    // Scenario: Verify that the engine correctly passes the selected parents to the crossover function
    // and that the resulting lineage is preserved.

    const population: AgentGene[] = [
      { ...baseGene, id: 'X' },
      { ...baseGene, id: 'Y' },
      { ...baseGene, id: 'Z' }
    ];

    // Use a smaller population to make tracing easier
    const testConfig = { ...config, populationSize: 3 };
    engine = new EvolutionEngine(testConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const nextGen = await engine.evolve(population);

    expect(nextGen).toHaveLength(3);
    nextGen.forEach(child => {
      expect(child.lineage).toHaveLength(2);
      // The lineage must consist of IDs from our initial population
      const validIds = ['X', 'Y', 'Z'];
      expect(validIds).toContain(child.lineage[0]);
      expect(validIds).toContain(child.lineage[1]);

      // Because we have 3 agents, we expect distinct parents
      expect(child.lineage[0]).not.toBe(child.lineage[1]);
    });
  });

  it('Diversity Metric: Ensures population does not collapse into clones (Diversity > 0)', async () => {
    // Scenario: "Diversity is a metric; measure it."
    // We check if the population maintains unique identities after evolution.
    // If we start with unique agents, we should end with unique agents (given our mocks produce unique IDs).

    // We force mutation to append unique IDs to system prompts to simulate divergence
    mockMutationFn.mockImplementation(async (g) => ({
      ...g,
      systemPrompt: `${g.systemPrompt}-${Math.random()}`
    }));

    // FIX: Set mutationRate to 1.0 to ensure every offspring is mutated and thus unique.
    // If mutationRate is < 1.0, some offspring will clone their parents (via our simple crossover mock), reducing diversity.
    const diversityConfig = { ...config, mutationRate: 1.0 };
    engine = new EvolutionEngine(diversityConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
      { ...baseGene, id: 'A', systemPrompt: 'SP-A' },
      { ...baseGene, id: 'B', systemPrompt: 'SP-B' },
      { ...baseGene, id: 'C', systemPrompt: 'SP-C' },
      { ...baseGene, id: 'D', systemPrompt: 'SP-D' }
    ];

    const nextGen = await engine.evolve(population);

    // 1. Calculate Diversity (Unique Prompts / Total Population)
    const prompts = nextGen.map(g => g.systemPrompt);
    const uniquePrompts = new Set(prompts);
    const diversityScore = uniquePrompts.size / nextGen.length;

    // 2. Assert Diversity
    // Since our mutation guarantees uniqueness, score should be 1.0.
    // If the engine was duplicating objects by reference without mutation, this would fail.
    expect(diversityScore).toBe(1.0);
    expect(uniquePrompts.size).toBe(4);
  });
});
