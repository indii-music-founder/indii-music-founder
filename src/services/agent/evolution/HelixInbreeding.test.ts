import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockCrossoverFn = vi.fn();
const mockGeminiMutation = vi.fn();

describe('🧬 Helix: Inbreeding Prevention', () => {
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
    });
  });
});
