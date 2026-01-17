import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

/**
 * 🧬 HELIX: GEMINI 3 PRO EVOLUTIONARY LOOP
 *
 * "Survival of the fittest, but death to the buggy."
 *
 * This test fulfills the "EXECUTE" mission:
 * 1. Micro-Universe: Small population of 3 agents.
 * 2. Evolution Step: Select 2, Breed 1.
 * 3. Engine: Gemini 3 Pro (Mocked).
 * 4. Verification: Full loop integrity (Selection -> Crossover -> Mutation -> Fitness).
 */

// Mock Dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Gemini 3 Pro Evolutionary Loop', () => {
  let engine: EvolutionEngine;

  // Configuration:
  // Population 3 (Small Universe)
  // Elite Count 2 (High stability, only 1 breeding slot)
  // Mutation Rate 1.0 (Force Gemini intervention)
  const config: EvolutionConfig = {
    populationSize: 3,
    mutationRate: 1.0,
    eliteCount: 2,
    maxGenerations: 5
  };

  const baseGene: AgentGene = {
    id: 'genesis',
    name: 'Genesis Agent',
    systemPrompt: 'You are a helpful AI.',
    parameters: { temperature: 0.5, model: 'gemini-1.5-pro' },
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // 1. Fitness Function: Deterministic Ranking
    // Agent-A (100) > Agent-B (80) > Agent-C (20)
    mockFitnessFn.mockImplementation(async (gene) => {
      if (gene.id === 'Agent-A') return 100;
      if (gene.id === 'Agent-B') return 80;
      if (gene.id === 'Agent-C') return 20;
      return 0;
    });

    // 2. Crossover Function: The "Genetic Merge"
    // Combines traits from two parents
    mockCrossoverFn.mockImplementation(async (p1, p2) => ({
      ...p1,
      id: 'child-draft',
      name: `Hybrid of ${p1.name} & ${p2.name}`,
      systemPrompt: `${p1.systemPrompt} + ${p2.systemPrompt}`,
      parameters: {
        temperature: (p1.parameters.temperature + p2.parameters.temperature) / 2,
        model: p1.parameters.model
      },
      generation: Math.max(p1.generation, p2.generation), // Engine will overwrite, but good to mock
      lineage: [p1.id, p2.id]
    }));

    // 3. Mutation Function: Gemini 3 Pro (Mocked)
    // Simulates the AI rewriting the prompt and tweaking parameters
    mockMutationFn.mockImplementation(async (gene) => ({
      ...gene,
      systemPrompt: `${gene.systemPrompt} [GEMINI-3-PRO-EVOLVED]`,
      parameters: {
        ...gene.parameters,
        temperature: 0.99 // "Hotter" creativity
      }
    }));

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);
  });

  it('Micro-Universe: Verifies the full evolutionary cycle (Select -> Breed -> Mutate)', async () => {
    // 1. Setup Population (3 Agents)
    const population: AgentGene[] = [
      { ...baseGene, id: 'Agent-A', name: 'Alpha', fitness: 100 },
      { ...baseGene, id: 'Agent-B', name: 'Beta', fitness: 80 },
      { ...baseGene, id: 'Agent-C', name: 'Gamma', fitness: 20 }
    ];

    // 2. Execute ONE Evolution Step
    const nextGen = await engine.evolve(population);

    // 3. Assert: Population Stability
    expect(nextGen).toHaveLength(3);

    // 4. Assert: Selection (Elitism)
    // The top 2 agents must survive strictly based on fitness
    const elite1 = nextGen[0];
    const elite2 = nextGen[1];

    expect(elite1.id).toBe('Agent-A');
    expect(elite1.fitness).toBe(100);
    expect(elite1.generation).toBe(0);

    expect(elite2.id).toBe('Agent-B');
    expect(elite2.fitness).toBe(80);
    expect(elite2.generation).toBe(0);

    // 5. Assert: The Offspring (Breeding)
    const offspring = nextGen[2];

    // A. Identity Check: Must be a new entity
    expect(offspring.id).not.toBe('Agent-A');
    expect(offspring.id).not.toBe('Agent-B');
    expect(offspring.id).not.toBe('Agent-C');

    // B. Lineage Check: Must have distinct parents (Sexual Selection)
    // In a pool of 3 with 2 elites, Agent-A and Agent-B are the likely parents.
    // Agent-C is unlikely to be picked (Tournament Selection).
    // Crucially, we check that we didn't self-crossover (p1 !== p2).
    expect(offspring.lineage).toHaveLength(2);
    expect(offspring.lineage[0]).not.toBe(offspring.lineage[1]);

    // C. Crossover Check: System Prompt combination
    expect(offspring.systemPrompt).toContain('You are a helpful AI.');
    expect(offspring.systemPrompt).toContain('+');

    // D. Mutation Check: Gemini 3 Pro Signature
    expect(offspring.systemPrompt).toContain('[GEMINI-3-PRO-EVOLVED]');
    expect(offspring.parameters.temperature).toBe(0.99);

    // E. Fitness Reset: Offspring must not inherit fitness ("Zombie Check")
    expect(offspring.fitness).toBeUndefined();

    // F. Generation Clock: Time must move forward
    expect(offspring.generation).toBe(1);
  });

  it('Gene Integrity: Rejects invalid mutation outputs ("The Brainless Check")', async () => {
    // Scenario: Gemini 3 Pro hallucinates and returns a gene without parameters.
    // The engine must reject this and retry until a valid gene is produced.

    // Mock first attempt to fail (Missing Parameters)
    mockMutationFn.mockResolvedValueOnce({
        ...baseGene,
        id: 'defective',
        parameters: undefined as any // Force defect
    });

    // Mock second attempt to succeed
    mockMutationFn.mockResolvedValueOnce({
        ...baseGene,
        id: 'valid-child',
        systemPrompt: 'Valid [GEMINI-3-PRO-EVOLVED]',
        parameters: { temperature: 0.7 }
    });

    const population: AgentGene[] = [
      { ...baseGene, id: 'Agent-A', fitness: 100 },
      { ...baseGene, id: 'Agent-B', fitness: 80 },
      { ...baseGene, id: 'Agent-C', fitness: 20 }
    ];

    const nextGen = await engine.evolve(population);

    expect(nextGen).toHaveLength(3);
    const offspring = nextGen[2];

    // Assert we got the valid one
    // Note: Engine overwrites ID with a new UUID, so we check content
    expect(offspring.systemPrompt).toBe('Valid [GEMINI-3-PRO-EVOLVED]');
    expect(offspring.parameters.temperature).toBe(0.7);
    expect(offspring.parameters).toBeDefined();

    // Assert Mutation was called twice (Retry happened)
    expect(mockMutationFn).toHaveBeenCalledTimes(2);
  });
});
