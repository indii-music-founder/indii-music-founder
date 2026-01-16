import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Micro-Universe (Minimal Evolution Scenario)', () => {
  let engine: EvolutionEngine;

  // Scenario: A minimal "Micro-Universe" with 3 agents.
  // We want to keep 2 Elites and breed 1 Offspring.
  const config: EvolutionConfig = {
    populationSize: 3,
    mutationRate: 1.0, // Force mutation
    eliteCount: 2,
    maxGenerations: 5
  };

  const mockGene: AgentGene = {
    id: 'gene-template',
    name: 'Agent Template',
    systemPrompt: 'Base Prompt',
    parameters: { temp: 0.7 },
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Default favorable mocks
    mockFitnessFn.mockImplementation(async (gene) => gene.fitness || 0);

    // Mock Crossover: Combine names and prompts
    mockCrossoverFn.mockImplementation(async (p1, p2) => ({
      ...p1,
      id: 'offspring-temp',
      name: `Child of ${p1.name} & ${p2.name}`,
      systemPrompt: p1.systemPrompt + ' + ' + p2.systemPrompt,
      generation: Math.max(p1.generation, p2.generation), // Engine increments this
      lineage: [p1.id, p2.id]
    }));

    // Mock Gemini 3 Pro Mutation: Return predictable mutated string
    mockMutationFn.mockImplementation(async (g) => ({
      ...g,
      systemPrompt: g.systemPrompt + ' [GEMINI_MUTATION]'
    }));

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);
  });

  it('Runs ONE step of evolution (Select 2, Breed 1) and produces valid offspring', async () => {
    // 1. Setup Micro-Universe (3 Mock Agents)
    const population: AgentGene[] = [
      { ...mockGene, id: 'agent-1', name: 'Alpha', fitness: 1.0, systemPrompt: 'PROMPT_A' },
      { ...mockGene, id: 'agent-2', name: 'Beta', fitness: 0.8, systemPrompt: 'PROMPT_B' },
      { ...mockGene, id: 'agent-3', name: 'Gamma', fitness: 0.5, systemPrompt: 'PROMPT_C' }
    ];

    // 2. Run ONE step
    const nextGen = await engine.evolve(population);

    // 3. Assertions

    // Check Population Size
    expect(nextGen).toHaveLength(3);

    // Check Elitism (Top 2 should survive)
    const survivor1 = nextGen[0];
    const survivor2 = nextGen[1];

    expect(survivor1.id).toBe('agent-1'); // Alpha
    expect(survivor1.fitness).toBe(1.0);
    expect(survivor2.id).toBe('agent-2'); // Beta
    expect(survivor2.fitness).toBe(0.8);

    // Check Offspring (Index 2)
    const offspring = nextGen[2];

    // Offspring must exist and be distinct
    expect(offspring).toBeDefined();
    expect(offspring.id).not.toBe('agent-1');
    expect(offspring.id).not.toBe('agent-2');
    expect(offspring.id).not.toBe('agent-3');

    // Valid Lineage (Should be from top pool)
    expect(offspring.lineage.length).toBe(2);
    // With tournament size 3, Alpha is extremely likely to be picked,
    // but randomness exists. We mostly check structure here.

    // Valid Mutation (Mocked Gemini Call)
    expect(offspring.systemPrompt).toContain('[GEMINI_MUTATION]');

    // Verify Crossover Logic happened (Prompt Combination)
    // The prompt should contain parts of parents.
    // Since we forced mutation on top of crossover, it should be complex.
    // e.g. "PROMPT_A + PROMPT_B [GEMINI_MUTATION]"
    expect(offspring.systemPrompt).toContain('+');
  });
});
