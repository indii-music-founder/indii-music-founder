import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Chronos (Time Integrity)', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 4,
    mutationRate: 0.5,
    eliteCount: 0,
    maxGenerations: 5
  };

  const baseGene: AgentGene = {
    id: 'base',
    name: 'Agent',
    systemPrompt: 'Prompt',
    parameters: {},
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockFitnessFn.mockResolvedValue(1.0);
    mockMutationFn.mockImplementation(async (g) => g);
    // Crossover returns a new object to avoid reference issues, but with mock generation if needed
    mockCrossoverFn.mockImplementation(async (p1) => ({ ...p1, id: 'child', generation: 0 }));
    // Note: The engine overwrites the generation, so the mock's return value for generation doesn't matter much
    // UNLESS the engine uses it. But engine uses parents' generation.
  });

  it('The Time Traveler: Handles malformed generation data (undefined/NaN) by defaulting to 0', async () => {
    // Scenario: Agents enter the pool with corrupted metadata (generation missing).
    // If not handled, Math.max returns NaN, creating "Timeless" agents (NaN generation).
    // These agents effectively bypass the Doomsday Switch because (NaN >= maxGen) is false.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // 1. Setup: Population with undefined generation (simulating data corruption)
    const population: AgentGene[] = [
      { ...baseGene, id: 'a1', generation: undefined as any },
      { ...baseGene, id: 'a2', generation: null as any }
    ];

    // 2. Evolve
    const nextGen = await engine.evolve(population);

    // 3. Assertions
    // Offspring must have a valid Number generation (1)
    // Because undefined/null should be treated as 0 -> offspring is 0+1 = 1.
    nextGen.forEach(child => {
        expect(child.generation).toBe(1);
        expect(Number.isNaN(child.generation)).toBe(false);
    });
  });
});
