import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

/**
 * 🧬 HELIX: GEMINI 3 PRO EVOLUTIONARY GUARDRAILS
 *
 * "Survival of the fittest, but death to the buggy."
 *
 * This test suite verifies the integrity of the evolutionary loop using a mocked Gemini 3 Pro engine.
 * It specifically enforces:
 * 1. The "Micro-Universe" protocol (Small, deterministic population).
 * 2. Schema Compliance (Mutation must produce executable agents).
 * 3. Defect Elimination (Agents that crash the Fitness Function must die).
 */

// Mock Dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Gemini 3 Pro Evolution & Defect Elimination', () => {
  let engine: EvolutionEngine;

  // Configuration:
  // Population 3 (Small Universe)
  // Elite Count 2 (Only 1 breeding slot available)
  // Mutation Rate 1.0 (Force Gemini intervention)
  // Max Generations 5 (Strict limit to prevent infinite loops)
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
    parameters: { temperature: 0.5, model: 'gemini-3-pro' },
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Default Fitness: Rank by ID for determinism
    mockFitnessFn.mockImplementation(async (gene) => {
      if (gene.id === 'Agent-A') return 100;
      if (gene.id === 'Agent-B') return 80;
      if (gene.id === 'Agent-C') return 20;
      return 10;
    });

    // Default Crossover: Merge prompts and average temperature
    mockCrossoverFn.mockImplementation(async (p1, p2) => ({
      ...p1,
      id: 'child-draft',
      name: `Hybrid of ${p1.name} & ${p2.name}`,
      systemPrompt: `${p1.systemPrompt} + ${p2.systemPrompt}`,
      parameters: {
        ...p1.parameters,
        temperature: (p1.parameters.temperature + p2.parameters.temperature) / 2
      },
      generation: Math.max(p1.generation, p2.generation),
      lineage: [p1.id, p2.id]
    }));

    // Default Mutation: Gemini 3 Pro Enhancement
    mockMutationFn.mockImplementation(async (gene) => ({
      ...gene,
      systemPrompt: `${gene.systemPrompt} [GEMINI-3-PRO-ENHANCED]`,
      parameters: {
        ...gene.parameters,
        temperature: 0.95 // High creativity
      }
    }));
  });

  it('Micro-Universe: Executes a full evolutionary cycle with Gemini 3 Pro', async () => {
    // 1. Setup Population (3 Agents)
    const population: AgentGene[] = [
      { ...baseGene, id: 'Agent-A', fitness: 100 },
      { ...baseGene, id: 'Agent-B', fitness: 80 },
      { ...baseGene, id: 'Agent-C', fitness: 20 }
    ];

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // 2. Execute ONE Evolution Step
    const nextGen = await engine.evolve(population);

    // 3. Assertions
    expect(nextGen).toHaveLength(3);

    // Elites (A & B) survive
    expect(nextGen[0]!.id).toBe('Agent-A');
    expect(nextGen[1]!.id).toBe('Agent-B');

    // Offspring (Index 2) is born
    const offspring = nextGen[2];
    expect(offspring!.id).not.toBe('Agent-A');
    expect(offspring!.id).not.toBe('Agent-B');
    expect(offspring!.id).not.toBe('Agent-C');

    // Lineage Verification
    expect(offspring!.lineage).toHaveLength(2);

    // Mutation Verification (Gemini 3 Pro Signature)
    expect(offspring!.systemPrompt).toContain('[GEMINI-3-PRO-ENHANCED]');
    expect(offspring!.parameters.temperature).toBe(0.95);
    expect(offspring!.parameters.model).toBe('gemini-3-pro');
  });

  it('Defect Elimination: "Death to the Buggy" - Kills agents that crash the Fitness Function', async () => {
    // Scenario: Gemini 3 Pro produces a "Toxic Mutation".
    // The mutated agent looks valid (structurally), but its code/prompt is semantically broken.
    // When the Fitness Function tries to evaluate it, it crashes (throws Error).
    // The Engine MUST catch this and assign 0.0 fitness, effectively killing the agent.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // 1. Setup Mutation to produce a "Toxic" Agent
    mockMutationFn.mockImplementation(async (g) => ({
      ...g,
      id: 'toxic-mutant',
      systemPrompt: 'INVALID_SYNTAX_CODE',
      parameters: { ...g.parameters, toxic: true }
    }));

    // 2. Setup Fitness to crash on "Toxic" Agent
    mockFitnessFn.mockImplementation(async (gene) => {
      if (gene.parameters?.toxic) {
        throw new Error("Runtime Error: Agent code is invalid!");
      }
      return 50; // Normal fitness
    });

    // 3. Setup Population (All need evaluation)
    const population: AgentGene[] = [
      { ...baseGene, id: 'p1', fitness: undefined }, // Will become toxic
      { ...baseGene, id: 'p2', fitness: 100 },       // Elite
      { ...baseGene, id: 'p3', fitness: 100 }        // Elite
    ];

    // 4. Evolve
    // The engine evaluates fitness FIRST.
    // p1 -> Mutation? No, p1 is input population. Wait.
    // The 'evolve' method evaluates fitness of the INPUT population first.
    // Then it breeds new ones.

    // Let's test the "Mutation -> Fitness" loop in the NEXT generation?
    // No, 'evolve' returns the next generation *without* evaluating their fitness (fitness is undefined).
    // The fitness is evaluated at the START of the *next* call to evolve.

    // So to test this, we need to pass the "Toxic Mutant" IN as part of the population to 'evolve',
    // simulating that it was born in the previous step.

    const toxicPopulation: AgentGene[] = [
       { ...baseGene, id: 'toxic-agent', fitness: undefined, parameters: { toxic: true } },
       { ...baseGene, id: 'healthy-1', fitness: undefined, parameters: { toxic: false } },
       { ...baseGene, id: 'healthy-2', fitness: undefined, parameters: { toxic: false } }
    ];

    const scoredGen = await engine.evolve(toxicPopulation);

    // 5. Assertions
    // 'toxic-agent' should have fitness 0.0 because it crashed the fitness function.
    // However, 'evolve' sorts by fitness.
    // healthy-1 & healthy-2 should have fitness 50.
    // toxic-agent should have fitness 0.

    // So the output order should be: Healthy, Healthy, Toxic (or Toxic filtered if elite count constraints?)
    // Pop size 3, Elite count 2.
    // The top 2 (Healthy) become Elites.
    // The Toxic one (Fitness 0) is excluded from the Mating Pool.

    const survivor1 = scoredGen[0]; // Elite 1
    const survivor2 = scoredGen[1]; // Elite 2

    expect(survivor1!.fitness).toBe(50);
    expect(survivor2!.fitness).toBe(50);

    // Verify that the Toxic Agent was indeed evaluated and assigned 0.0
    // We can't easily check the internal state, but we can check if it survived as an elite if it was the *only* one?
    // In this case, it was beaten by healthy ones.

    // Let's verify Mating Pool exclusion.
    // We mock Crossover to track who breeds.
    await engine.evolve(toxicPopulation);

    // The toxic agent (id: toxic-agent) should NOT be passed to crossover
    const crossoverCalls = mockCrossoverFn.mock.calls;
    for (const call of crossoverCalls) {
        const [p1, p2] = call;
        expect(p1.id).not.toBe('toxic-agent');
        expect(p2.id).not.toBe('toxic-agent');
    }

    // Verify Fitness Function was called for toxic agent
    expect(mockFitnessFn).toHaveBeenCalledWith(expect.objectContaining({ id: 'toxic-agent' }));
  });
});
