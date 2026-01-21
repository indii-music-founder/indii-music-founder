import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Gemini 3 Pro Mutation Integration', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 3,
    mutationRate: 1.0, // Force mutation
    eliteCount: 1,     // Keep the best
    maxGenerations: 5
  };

  const baseGene: AgentGene = {
    id: 'agent-007',
    name: 'Bond',
    systemPrompt: 'You are a secret agent.',
    parameters: { temperature: 0.7 },
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Default: Fit agents
    mockFitnessFn.mockResolvedValue(0.8);

    // Default: Crossover combines names
    mockCrossoverFn.mockImplementation(async (p1, p2) => ({
      ...p1,
      id: 'temp-id',
      name: `${p1.name}-${p2.name}-Hybrid`,
      lineage: [p1.id, p2.id]
    }));

    // Default: Mutation simulates Gemini 3 Pro enhancing the prompt
    mockMutationFn.mockImplementation(async (gene) => ({
      ...gene,
      systemPrompt: `GEMINI-ENHANCED: ${gene.systemPrompt}`
    }));
  });

  it('Micro-Universe: Verifies Gemini 3 Pro mutation cycle on a small population', async () => {
    // 1. Setup Micro-Universe (3 Agents)
    const population: AgentGene[] = [
      { ...baseGene, id: 'agent-1', fitness: 1.0 }, // Elite
      { ...baseGene, id: 'agent-2', fitness: 0.5 },
      { ...baseGene, id: 'agent-3', fitness: 0.1 }
    ];

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // 2. Run ONE step of evolution (Select 2, Breed 1)
    // We have 3 slots. 1 Elite takes slot 0.
    // Slots 1 and 2 need to be filled by offspring.
    const nextGen = await engine.evolve(population);

    // 3. Assertions

    // A. Population Size Integrity
    expect(nextGen).toHaveLength(3);

    // B. Elitism Check (Agent 1 must survive as is)
    const elite = nextGen[0];
    expect(elite.id).toBe('agent-1');
    expect(elite.fitness).toBe(1.0);
    expect(elite.systemPrompt).not.toContain('GEMINI-ENHANCED'); // Elites are not mutated

    // C. Offspring Validation (Agent 2 or 3 parents)
    // Check the new agents
    const offspring = nextGen.slice(1);
    expect(offspring.length).toBe(2);

    for (const child of offspring) {
        // Must have new ID
        expect(child.id).not.toBe('agent-1');
        expect(child.id).not.toBe('agent-2');
        expect(child.id).not.toBe('agent-3');

        // Must be mutated by "Gemini"
        expect(child.systemPrompt).toContain('GEMINI-ENHANCED');
        expect(child.systemPrompt).toContain('You are a secret agent.');

        // Must be valid object
        expect(child.parameters).toBeDefined();

        // Generation must increment
        expect(child.generation).toBe(1);

        // Lineage must be tracked
        expect(child.lineage.length).toBe(2);
    }
  });

  it('Gene Loss: Verifies that mutation maintains JSON schema integrity', async () => {
    // Scenario: Gemini returns valid JSON structure, but we verify our engine accepts it.
    // And if Gemini returns invalid structure (simulated), engine rejects it (tested in Safety, but let's double check here for schema adherence).

    // Mock Mutation returning a gene with MISSING parameters (Gene Loss)
    mockMutationFn.mockResolvedValueOnce({
        id: 'bad-gene',
        name: 'Broken',
        systemPrompt: 'I lost my params',
        parameters: null as any, // Simulating schema break
        generation: 1,
        lineage: []
    } as AgentGene);

    // Then return valid one so loop finishes
    mockMutationFn.mockResolvedValue({
        ...baseGene,
        id: 'good-gene',
        systemPrompt: 'I am valid',
        parameters: { temperature: 0.9 }
    });

    const population: AgentGene[] = [
        { ...baseGene, id: 'p1', fitness: 1.0 },
        { ...baseGene, id: 'p2', fitness: 1.0 },
        { ...baseGene, id: 'p3', fitness: 1.0 }
    ];

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);
    const nextGen = await engine.evolve(population);

    // Assert that the 'bad-gene' did NOT make it into the population
    const badGenes = nextGen.filter(g => g.name === 'Broken');
    expect(badGenes).toHaveLength(0);

    // Assert we have a full population of good genes
    expect(nextGen).toHaveLength(3);
    expect(nextGen[1].parameters).not.toBeNull();
  });
});
