import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 🧬 HELIX: EVOLUTIONARY LOOP & GUARDRAILS
 *
 * This test suite fulfills the mission to verify the complete evolutionary loop
 * (Selection -> Crossover -> Mutation -> Fitness) with strict guardrails.
 *
 * Scenarios:
 * 1. Micro-Universe: Full cycle verification with Elitism and Gemini 3 Pro mutation.
 * 2. Fitness Validator: Strict culling of zero-fitness agents.
 * 3. Doomsday Switch: Hard stop at generation limits.
 * 4. Gene Loss Prevention: Rejection of "Brainless" mutations.
 */

// Mock Dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Evolutionary Loop & Guardrails', () => {
  let engine: EvolutionEngine;

  const baseConfig: EvolutionConfig = {
    populationSize: 3,
    mutationRate: 1.0, // Force mutation for testing
    eliteCount: 2,     // High stability
    maxGenerations: 5
  };

  const baseGene: AgentGene = {
    id: 'genesis',
    name: 'Genesis Agent',
    systemPrompt: 'You are a helpful AI.',
    parameters: { temperature: 0.5, model: 'gemini-3.1-pro-preview' },
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Default Fitness: Return fitness property or 0
    mockFitnessFn.mockImplementation(async (gene) => gene.fitness || 0);

    // Default Crossover: Merge prompts
    mockCrossoverFn.mockImplementation(async (p1, p2) => ({
      ...p1,
      id: `child-${uuidv4()}`,
      name: `Hybrid of ${p1.name} & ${p2.name}`,
      systemPrompt: `${p1.systemPrompt} + ${p2.systemPrompt}`,
      parameters: {
        temperature: (p1.parameters.temperature + p2.parameters.temperature) / 2,
        model: p1.parameters.model
      },
      generation: Math.max(p1.generation || 0, p2.generation || 0),
      lineage: [p1.id, p2.id]
    }));

    // Default Mutation: Gemini 3 Pro Signature
    mockMutationFn.mockImplementation(async (gene) => ({
      ...gene,
      systemPrompt: `${gene.systemPrompt} [GEMINI-3-PRO-EVOLVED]`,
      parameters: {
        ...gene.parameters,
        temperature: 0.99
      }
    }));
  });

  it('Micro-Universe: Verifies the full evolutionary cycle (Select -> Breed -> Mutate)', async () => {
    // 1. Setup Population (3 Agents)
    const population: AgentGene[] = [
      { ...baseGene, id: 'Agent-A', name: 'Alpha', fitness: 100 },
      { ...baseGene, id: 'Agent-B', name: 'Beta', fitness: 80 },
      { ...baseGene, id: 'Agent-C', name: 'Gamma', fitness: 20 }
    ];

    engine = new EvolutionEngine(baseConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // 2. Execute ONE Evolution Step
    const nextGen = await engine.evolve(population);

    // 3. Assert: Population Stability
    expect(nextGen).toHaveLength(3);

    // 4. Assert: Selection (Elitism)
    // The top 2 agents must survive strictly based on fitness
    expect(nextGen[0].id).toBe('Agent-A');
    expect(nextGen[0].fitness).toBe(100);
    expect(nextGen[1].id).toBe('Agent-B');
    expect(nextGen[1].fitness).toBe(80);

    // 5. Assert: The Offspring (Breeding)
    const offspring = nextGen[2];

    // Identity: Must be new
    expect(offspring.id).not.toBe('Agent-A');
    expect(offspring.id).not.toBe('Agent-B');
    expect(offspring.id).not.toBe('Agent-C');

    // Lineage: Must have distinct parents (Sexual Selection)
    expect(offspring.lineage).toHaveLength(2);
    expect(offspring.lineage[0]).not.toBe(offspring.lineage[1]);

    // Mutation: Gemini 3 Pro Signature
    expect(offspring.systemPrompt).toContain('[GEMINI-3-PRO-EVOLVED]');
    expect(offspring.parameters.temperature).toBe(0.99);

    // Time: Generation must advance
    expect(offspring.generation).toBe(1);
  });

  it('Fitness Validator: Zero-fitness agents are strictly excluded from mating', async () => {
    // Scenario: Population has healthy agents and "dead" agents (0 fitness).
    // Dead agents must never be parents.
    const population: AgentGene[] = [
      { ...baseGene, id: 'Healthy1', fitness: 10 },
      { ...baseGene, id: 'Healthy2', fitness: 10 },
      { ...baseGene, id: 'Zombie', fitness: 0 }
    ];

    // Elite Count 0 to force breeding of all slots
    const testConfig = { ...baseConfig, eliteCount: 0, populationSize: 3 };
    engine = new EvolutionEngine(testConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const nextGen = await engine.evolve(population);

    expect(nextGen).toHaveLength(3);
    nextGen.forEach(child => {
      expect(child.lineage).not.toContain('Zombie');
      expect(child.lineage).toContain('Healthy1'); // Or Healthy2
    });
  });

  it('Doomsday Switch: Evolution strictly halts when Max Generations is reached', async () => {
    // Scenario: Population reaches generation limit.
    const population: AgentGene[] = [
      { ...baseGene, id: 'Old-1', generation: 5, fitness: 100 },
      { ...baseGene, id: 'Old-2', generation: 5, fitness: 90 },
      { ...baseGene, id: 'Old-3', generation: 5, fitness: 80 }
    ];

    const testConfig = { ...baseConfig, maxGenerations: 5 };
    engine = new EvolutionEngine(testConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const nextGen = await engine.evolve(population);

    // Should return sorted population without breeding
    expect(nextGen).toHaveLength(3);
    expect(nextGen[0].id).toBe('Old-1');
    expect(mockCrossoverFn).not.toHaveBeenCalled();
    expect(mockMutationFn).not.toHaveBeenCalled();
  });

  it('Gene Loss Prevention: Rejects "Brainless" mutations (Missing Parameters)', async () => {
    // Scenario: Gemini 3 Pro hallucinates and returns a gene without parameters.
    engine = new EvolutionEngine(baseConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // Mock sequence: Fail -> Fail -> Success
    mockMutationFn
      .mockResolvedValueOnce({ ...baseGene, parameters: undefined as any }) // Defect
      .mockResolvedValueOnce({ ...baseGene, parameters: null as any })      // Defect
      .mockResolvedValue({
        ...baseGene,
        systemPrompt: 'Valid [GEMINI-3-PRO-EVOLVED]',
        parameters: { temperature: 0.7 }
      });

    const population: AgentGene[] = [
      { ...baseGene, id: 'P1', fitness: 100 },
      { ...baseGene, id: 'P2', fitness: 90 },
      { ...baseGene, id: 'P3', fitness: 80 }
    ];

    const nextGen = await engine.evolve(population);

    // We expect the 3rd slot (offspring) to be the valid one
    const offspring = nextGen[2];
    expect(offspring.parameters.temperature).toBe(0.7);
    expect(mockMutationFn).toHaveBeenCalledTimes(3); // 2 fails + 1 success
  });

  it('Token Budget: Rejects bloated prompts exceeding context limits', async () => {
    // Scenario: Mutation produces a prompt that is too long (Context Window Overflow).
    engine = new EvolutionEngine(baseConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const bloatedPrompt = 'A'.repeat(100001); // 100,001 chars > 100,000 limit

    // Mock sequence: Fail (Bloat) -> Success
    mockMutationFn
      .mockResolvedValueOnce({ ...baseGene, systemPrompt: bloatedPrompt }) // Defect
      .mockResolvedValue({
        ...baseGene,
        systemPrompt: 'Valid Compact Prompt',
        parameters: { temperature: 0.7 }
      });

    const population: AgentGene[] = [
      { ...baseGene, id: 'P1', fitness: 100 },
      { ...baseGene, id: 'P2', fitness: 90 },
      { ...baseGene, id: 'P3', fitness: 80 }
    ];

    const nextGen = await engine.evolve(population);

    // We expect the 3rd slot (offspring) to be the valid one
    const offspring = nextGen[2];
    expect(offspring.systemPrompt).toBe('Valid Compact Prompt');
    expect(mockMutationFn).toHaveBeenCalledTimes(2); // 1 fail + 1 success
  });

  it('Safety Filter Resilience: Retries mutation when Gemini raises a Safety Violation', async () => {
    // Scenario: The Mutation Function interacts with an LLM that has strict safety filters.
    // The engine must discard these attempts and try again.
    engine = new EvolutionEngine(baseConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const safetyError = new Error("Safety Violation: Dangerous Content");

    // Mock sequence: Fail (Safety) -> Success
    mockMutationFn
      .mockRejectedValueOnce(safetyError) // Fail
      .mockResolvedValue({
        ...baseGene,
        id: 'safe-child',
        systemPrompt: 'Safe Content'
      });

    const population: AgentGene[] = [
      { ...baseGene, id: 'P1', fitness: 100 },
      { ...baseGene, id: 'P2', fitness: 100 }
    ];

    const nextGen = await engine.evolve(population);

    expect(nextGen).toHaveLength(3); // 2 Elites + 1 Offspring
    expect(mockMutationFn).toHaveBeenCalledTimes(2); // 1 fail + 1 success
  });

  it('Diversity Assurance: Ensures offspring are distinct from parents (Inbreeding Check)', async () => {
    // Scenario: "Diversity is a metric; measure it."
    // Ensure that the offspring is not just a clone of the parent.
    engine = new EvolutionEngine(baseConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const population: AgentGene[] = [
      { ...baseGene, id: 'Parent-A', systemPrompt: 'Prompt A', fitness: 100 },
      { ...baseGene, id: 'Parent-B', systemPrompt: 'Prompt B', fitness: 100 }
    ];

    const nextGen = await engine.evolve(population);

    // Offspring is at index 2 (EliteCount=2)
    const offspring = nextGen[2];

    expect(offspring.id).not.toBe('Parent-A');
    expect(offspring.id).not.toBe('Parent-B');
    expect(offspring.systemPrompt).not.toBe('Prompt A');
    expect(offspring.systemPrompt).not.toBe('Prompt B');
    // Ensure mutation happened (based on our mock that adds [GEMINI-3-PRO-EVOLVED])
    expect(offspring.systemPrompt).toContain('[GEMINI-3-PRO-EVOLVED]');
  });
});
