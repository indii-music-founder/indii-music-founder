import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Diversity & Gene Preservation (Evolutionary Loop)', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 5,
    mutationRate: 0.8, // High mutation for diversity test
    eliteCount: 1,
    maxGenerations: 5
  };

  const mockGene: AgentGene = {
    id: 'gene-template',
    name: 'Agent Template',
    systemPrompt: 'Base Prompt',
    parameters: { temperature: 0.7 },
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Default Fitness: Deterministic based on ID or random if not matched
    mockFitnessFn.mockImplementation(async (gene) => {
      if (gene.id === 'elite') return 1.0;
      if (gene.id.startsWith('weak')) return 0.0;
      return 0.5;
    });

    // Default Crossover: Merge prompts
    mockCrossoverFn.mockImplementation(async (p1, p2) => ({
      ...p1,
      id: 'offspring-temp',
      name: `Child of ${p1.name} & ${p2.name}`,
      systemPrompt: p1.systemPrompt + ' + ' + p2.systemPrompt,
      parameters: {
          temperature: (p1.parameters.temperature + p2.parameters.temperature) / 2
      },
      generation: Math.max(p1.generation, p2.generation),
      lineage: [p1.id, p2.id]
    }));

    // Default Mutation: Append tag
    mockMutationFn.mockImplementation(async (g) => ({
      ...g,
      systemPrompt: g.systemPrompt + ' [MUTATED]',
      parameters: {
          ...g.parameters,
          temperature: Math.min(1.0, g.parameters.temperature + 0.1)
      }
    }));
  });

  it('Diversity Injection: Ensures population escapes "Clonal Stagnation" via mutation', async () => {
    // 1. Setup: Population of Clones
    const clones = Array(5).fill(null).map((_, i) => ({
        ...mockGene,
        id: `clone-${i}`,
        systemPrompt: 'I am a clone',
        fitness: 0.5
    }));

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // Mock Mutation to produce random variations
    mockMutationFn.mockImplementation(async (g) => ({
        ...g,
        systemPrompt: g.systemPrompt + ` [MUTATED-${Math.random().toString(36).substring(7)}]`
    }));

    // 2. Evolve
    const nextGen = await engine.evolve(clones);

    // 3. Measure Diversity
    const prompts = nextGen.map(g => g.systemPrompt);
    const uniquePrompts = new Set(prompts);
    const diversityScore = uniquePrompts.size / nextGen.length;

    // We expect at least 80% diversity (4/5 unique) given high mutation rate
    expect(diversityScore).toBeGreaterThanOrEqual(0.8);
  });

  it('The "Last Man Standing": Rebuilds population from a single survivor', async () => {
    // Scenario: Mass Extinction. 1 Elite survives. 3 others are fitness 0 (Dead).
    // The system must be able to repopulate using the single survivor (Self-Crossover).

    const population: AgentGene[] = [
      { ...mockGene, id: 'elite', fitness: 1.0, systemPrompt: 'SURVIVOR' },
      { ...mockGene, id: 'weak1', fitness: 0.0 }, // Should be culled
      { ...mockGene, id: 'weak2', fitness: 0.0 }, // Should be culled
      { ...mockGene, id: 'weak3', fitness: 0.0 }  // Should be culled
    ];

    // FIX: Set mutationRate to 1.0 to ensure deterministic mutation check
    const testConfig = { ...config, populationSize: 4, eliteCount: 1, mutationRate: 1.0 };
    engine = new EvolutionEngine(testConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const nextGen = await engine.evolve(population);

    expect(nextGen).toHaveLength(4);

    // 1. Elite Verification
    expect(nextGen[0].id).toBe('elite');
    expect(nextGen[0].fitness).toBe(1.0);

    // 2. Offspring Verification
    // All other 3 agents must be offspring of 'elite' and 'elite'
    const offspring = nextGen.slice(1);
    offspring.forEach(child => {
        expect(child.lineage).toEqual(['elite', 'elite']);
        expect(child.systemPrompt).toContain('SURVIVOR');
        // Because of mutation (rate 1.0), they MUST contain the tag
        expect(child.systemPrompt).toContain('[MUTATED]');
    });
  });
});
