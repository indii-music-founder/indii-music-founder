
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

/**
 * HELIX: GENETIC VERIFICATION SUITE
 *
 * "Evolution without boundaries is cancer; constrain the search space."
 *
 * This test strictly enforces the "Micro-Universe" protocol:
 * 1. Isolate a small population (3 Agents).
 * 2. Execute exactly ONE reproductive cycle (Select 2 Parents -> Breed 1 Offspring).
 * 3. Verify the integrity of the loop (Selection -> Crossover -> Mutation -> Fitness).
 * 4. Ensure Gemini 3 Pro (Mocked) is the engine of change.
 */

// Mocks
const mockFitnessFn = vi.fn();
const mockCrossoverFn = vi.fn();
const mockGeminiMutation = vi.fn();

describe('🧬 Helix: Gemini 3 Pro Evolutionary Verification', () => {
  let engine: EvolutionEngine;

  // Configuration for "Select 2, Breed 1" Scenario
  // We want a population of 3.
  // We want to keep 2 Elites (to force exactly 1 breeding slot).
  const config: EvolutionConfig = {
    populationSize: 3,
    mutationRate: 1.0, // Force mutation to verify Gemini interaction
    eliteCount: 2,     // 2 Elites + 1 Offspring = 3 Total
    maxGenerations: 5
  };

  const baseGene: AgentGene = {
    id: 'genesis',
    name: 'Genesis Agent',
    systemPrompt: 'You are a helpful assistant.',
    parameters: { temperature: 0.5 },
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // 1. Fitness Mock: Rank by explicit ID to control Selection
    // Agent-A (100) > Agent-B (50) > Agent-C (10)
    mockFitnessFn.mockImplementation(async (gene) => {
      if (gene.id === 'Agent-A') return 100;
      if (gene.id === 'Agent-B') return 50;
      if (gene.id === 'Agent-C') return 10;
      return 0;
    });

    // 2. Crossover Mock: The "Merging" Phase
    // Returns a "Half-Baked" child that combines parent traits
    mockCrossoverFn.mockImplementation(async (p1, p2) => ({
      ...p1,
      id: 'child-draft',
      name: `Hybrid of ${p1.name} & ${p2.name}`,
      systemPrompt: `${p1.systemPrompt} + ${p2.systemPrompt}`,
      generation: Math.max(p1.generation, p2.generation),
      lineage: [p1.id, p2.id]
    }));

    // 3. Gemini Mutation Mock: The "Evolution" Phase
    // Simulates Gemini 3 Pro refining the prompt
    mockGeminiMutation.mockImplementation(async (gene) => ({
      ...gene,
      systemPrompt: `[GEMINI-3-PRO: ${gene.systemPrompt}]`, // Predictable mutation
      parameters: {
        ...gene.parameters,
        temperature: 0.9 // Mutation shift
      }
    }));

    engine = new EvolutionEngine(config, mockFitnessFn, mockGeminiMutation, mockCrossoverFn);
  });

  it('Micro-Universe: Executes one precise step of evolution', async () => {
    // 1. Setup the Micro-Universe (3 Agents)
    const population: AgentGene[] = [
      { ...baseGene, id: 'Agent-A', name: 'Alpha', fitness: 100 },
      { ...baseGene, id: 'Agent-B', name: 'Beta', fitness: 50 },
      { ...baseGene, id: 'Agent-C', name: 'Gamma', fitness: 10 }
    ];

    // 2. Execute Evolution
    const nextGen = await engine.evolve(population);

    // 3. Assert: Population Stability
    expect(nextGen).toHaveLength(3);

    // 4. Assert: Elitism (Selection)
    // The top 2 agents (Alpha, Beta) must survive untouched
    expect(nextGen[0].id).toBe('Agent-A');
    expect(nextGen[1].id).toBe('Agent-B');
    expect(nextGen[0].fitness).toBe(100);
    expect(nextGen[1].fitness).toBe(50);

    // 5. Assert: The Offspring (Breeding)
    const offspring = nextGen[2];

    // A. Identity: Must be new
    expect(offspring.id).not.toBe('Agent-A');
    expect(offspring.id).not.toBe('Agent-B');
    expect(offspring.id).not.toBe('Agent-C');

    // B. Lineage: Must come from the pool (Likely Alpha & Beta due to high fitness)
    // Note: With Tournament Selection, C is unlikely to be picked, but possible.
    // We check that lineage contains valid IDs.
    expect(['Agent-A', 'Agent-B', 'Agent-C']).toContain(offspring.lineage[0]);
    expect(['Agent-A', 'Agent-B', 'Agent-C']).toContain(offspring.lineage[1]);

    // C. Crossover: Prompt must show combination
    // The Crossover mock produces "Prompt + Prompt"
    // The Mutation mock wraps it in "[GEMINI-3-PRO: ...]"
    // We verify both layers happened.
    expect(offspring.systemPrompt).toContain('GEMINI-3-PRO');
    expect(offspring.systemPrompt).toContain('+');

    // D. Mutation: Parameters changed
    expect(offspring.parameters.temperature).toBe(0.9);

    // E. Fitness: Must be reset (Zombie Check)
    expect(offspring.fitness).toBeUndefined();

    // F. Generation: Must be incremented
    expect(offspring.generation).toBe(1);
  });

  it('Mutation Resilience: Ensures valid offspring despite flaky Gemini calls', async () => {
    // Scenario: Gemini fails twice before succeeding.
    mockGeminiMutation
      .mockRejectedValueOnce(new Error("Rate Limit Exceeded"))
      .mockRejectedValueOnce(new Error("Safety Violation"))
      .mockResolvedValueOnce({
         ...baseGene,
         id: 'survivor',
         systemPrompt: 'Stable Gemini Output'
      });

    const population: AgentGene[] = [
      { ...baseGene, id: 'Agent-A', fitness: 100 },
      { ...baseGene, id: 'Agent-B', fitness: 50 },
      { ...baseGene, id: 'Agent-C', fitness: 10 }
    ];

    const nextGen = await engine.evolve(population);

    expect(nextGen).toHaveLength(3);
    const offspring = nextGen[2];
    expect(offspring.systemPrompt).toBe('Stable Gemini Output');

    // Verify we kept trying
    expect(mockGeminiMutation).toHaveBeenCalledTimes(3);
  });
});
