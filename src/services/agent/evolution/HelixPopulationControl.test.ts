import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Population Control (Anti-Explosion)', () => {
  let engine: EvolutionEngine;

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
    mockFitnessFn.mockResolvedValue(1.0);
    mockCrossoverFn.mockResolvedValue({ ...baseGene, id: 'child' });
    mockMutationFn.mockImplementation(async (g) => g);
  });

  it('Configuration Safety: Enforces Population Limit even if Elite Count is misconfigured', async () => {
    // Scenario: User or Config accidentally sets eliteCount > populationSize.
    // e.g., Population Limit: 5, but Keep 10 Elites.
    // Logic: The engine must cap Elites at Population Limit to prevent growth.

    const config: EvolutionConfig = {
      populationSize: 5,
      mutationRate: 0.1,
      eliteCount: 10, // MISCONFIGURED: More elites than slots!
      maxGenerations: 5
    };

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // Input population of 10 agents (perhaps from a previous larger run)
    const population: AgentGene[] = Array.from({ length: 10 }, (_, i) => ({
      ...baseGene,
      id: `gene-${i}`,
      fitness: 100 - i // 100, 99, 98...
    }));

    const nextGen = await engine.evolve(population);

    // ASSERTION 1: Population Size matches limit, not eliteCount
    expect(nextGen).toHaveLength(5);

    // ASSERTION 2: Only the top 5 survived
    expect(nextGen[0].id).toBe('gene-0');
    expect(nextGen[4].id).toBe('gene-4');
  });

  it('Memory Safety: Trims large input populations down to the configured limit', async () => {
    // Scenario: Input population is huge (e.g. 100), but config says 5.
    // This can happen if the user changes settings between runs.
    // The engine must cull the excess agents.

    const config: EvolutionConfig = {
      populationSize: 5,
      mutationRate: 0.1,
      eliteCount: 2, // Standard setting
      maxGenerations: 5
    };

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // Huge input population
    const population: AgentGene[] = Array.from({ length: 100 }, (_, i) => ({
      ...baseGene,
      id: `gene-${i}`,
      fitness: 1000 - i
    }));

    const nextGen = await engine.evolve(population);

    // ASSERTION: Strict adherence to populationSize
    expect(nextGen).toHaveLength(5);
  });
});
