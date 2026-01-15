import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockCrossoverFn = vi.fn();
const mockGeminiMutation = vi.fn();

describe('🧬 Helix: Inbreeding Prevention', () => {
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Inbreeding & Parent Selection', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 4,
    mutationRate: 0.5,
    eliteCount: 0, // Disable elitism to focus on breeding
    maxGenerations: 5
  };

  const baseGene: AgentGene = {
    id: 'base',
    name: 'Base Agent',
    systemPrompt: 'Prompt',
    parameters: {},
    mutationRate: 0.1,
    eliteCount: 0, // Zero elites to force 4 breeding events
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
    mockFitnessFn.mockResolvedValue(1.0); // All fit
    mockGeminiMutation.mockImplementation(async (g) => g);
    mockCrossoverFn.mockImplementation(async (p1, p2) => ({
       ...p1,
       id: 'child',
       lineage: [p1.id, p2.id]
    }));
  });

  it('Sexual Selection: Enforces distinct parents when compatible partners exist', async () => {
    engine = new EvolutionEngine(config, mockFitnessFn, mockGeminiMutation, mockCrossoverFn);

    // Population of 3 distinct agents
    const population: AgentGene[] = [
      { ...baseGene, id: 'agent-A', fitness: 1.0 },
      { ...baseGene, id: 'agent-B', fitness: 1.0 },
      { ...baseGene, id: 'agent-C', fitness: 1.0 }
    ];

    await engine.evolve(population);

    // Verify Crossover calls
    expect(mockCrossoverFn).toHaveBeenCalled();

    mockCrossoverFn.mock.calls.forEach(call => {
      const [p1, p2] = call as [AgentGene, AgentGene];
      expect(p1.id).not.toBe(p2.id);
    });
  });

   it('Emergency Breeding: Allows self-crossover only when no other partners exist (Last Man Standing)', async () => {
    engine = new EvolutionEngine(config, mockFitnessFn, mockGeminiMutation, mockCrossoverFn);

    // Population of 1 survivor (others dead/unfit)
    const population: AgentGene[] = [
      { ...baseGene, id: 'survivor', fitness: 1.0 },
      { ...baseGene, id: 'dead', fitness: 0.0 }
    ];

    await engine.evolve(population);

    // Verify Crossover calls
    expect(mockCrossoverFn).toHaveBeenCalled();

    mockCrossoverFn.mock.calls.forEach(call => {
      const [p1, p2] = call as [AgentGene, AgentGene];
      expect(p1.id).toBe('survivor');
      expect(p2.id).toBe('survivor');
      expect(p1.id).toBe(p2.id);

    // Default Fitness: All Fit
    mockFitnessFn.mockResolvedValue(1.0);

    // Default Crossover: Merge prompts
    mockCrossoverFn.mockImplementation(async (p1, p2) => ({
      ...p1,
      id: `child-of-${p1.id}-${p2.id}`,
      name: `Child of ${p1.name} & ${p2.name}`,
      systemPrompt: p1.systemPrompt + ' + ' + p2.systemPrompt,
      parameters: { ...p1.parameters },
      generation: Math.max(p1.generation, p2.generation),
      lineage: [p1.id, p2.id]
    }));

    // Default Mutation: No-op
    mockMutationFn.mockImplementation(async (g) => ({ ...g }));
  });

  it('Inbreeding Prevention: Ensures distinct parents are selected for crossover when possible', async () => {
    // 1. Setup: Population of 4 distinct, fit agents
    const population: AgentGene[] = [
      { ...mockGene, id: 'A', fitness: 1.0 },
      { ...mockGene, id: 'B', fitness: 1.0 },
      { ...mockGene, id: 'C', fitness: 1.0 },
      { ...mockGene, id: 'D', fitness: 1.0 }
    ];

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // 2. Evolve
    await engine.evolve(population);

    // 3. Verify Crossover Calls
    // We expect 4 breeding events (populationSize 4, eliteCount 0)
    expect(mockCrossoverFn).toHaveBeenCalledTimes(4);

    mockCrossoverFn.mock.calls.forEach(([parent1, parent2]) => {
      // Helix Constraint: Parent 1 MUST NOT be Parent 2
      expect(parent1.id).not.toBe(parent2.id);
    });
  });

  it('Lineage Tracking: Offspring record correct parent IDs', async () => {
    // 1. Setup
    const population: AgentGene[] = [
      { ...mockGene, id: 'X', fitness: 1.0 },
      { ...mockGene, id: 'Y', fitness: 1.0 },
      { ...mockGene, id: 'Z', fitness: 1.0 }
    ];

    // config with population 3
    const testConfig = { ...config, populationSize: 3 };
    engine = new EvolutionEngine(testConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // 2. Evolve
    const nextGen = await engine.evolve(population);

    // 3. Verify Lineage
    expect(nextGen).toHaveLength(3);

    nextGen.forEach(child => {
        expect(child.lineage).toHaveLength(2);
        // The lineage must match the parents used (which we can't easily track per child without inspecting internal logic,
        // but we can verify the lineage logic itself was applied by the engine or our mock).
        // Since our mock sets lineage, we are verifying the engine PASSED the parents correctly and accepted the return.

        // Let's verify that the lineage contains valid IDs from the original population
        const validIds = ['X', 'Y', 'Z'];
        expect(validIds).toContain(child.lineage[0]);
        expect(validIds).toContain(child.lineage[1]);

        // Also verify distinct parents in lineage (since we test Inbreeding Prevention)
        expect(child.lineage[0]).not.toBe(child.lineage[1]);
    });
  });
});
