import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

/**
 * HELIX TEST SUITE: IMMUNITY & INTEGRITY
 * Verifies that the Evolutionary Engine correctly:
 * 1. Purges defective agents ("Immune Response")
 * 2. Preserves elite genetic code byte-for-byte ("Gene Integrity")
 */

const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Immune System & Gene Integrity', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 4,
    mutationRate: 0.5,
    eliteCount: 1,
    maxGenerations: 5
  };

  const baseGene: AgentGene = {
    id: 'base',
    name: 'Base Agent',
    systemPrompt: 'Original Prompt',
    parameters: { temp: 0.5, model: 'gemini-1' },
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Default favorable mocks
    mockMutationFn.mockImplementation(async (g) => ({
      ...g,
      systemPrompt: g.systemPrompt + ' [MUT]',
      id: g.id + '-mut'
    }));

    mockCrossoverFn.mockImplementation(async (p1, p2) => ({
      ...p1,
      id: 'child',
      lineage: [p1.id, p2.id]
    }));
  });

  it('Immune Response: Agents triggering Fitness Function errors are purged', async () => {
    // 1. Setup: Mixed population with one "Defective" agent
    // Defective agent has NO fitness assigned yet (undefined)
    const population: AgentGene[] = [
      { ...baseGene, id: 'healthy1' },
      { ...baseGene, id: 'healthy2' },
      { ...baseGene, id: 'defective-agent' } // This one will crash fitnessFn
    ];

    // 2. Mock Fitness: Healthy -> 1.0, Defective -> Throws Error
    mockFitnessFn.mockImplementation(async (gene: AgentGene) => {
      if (gene.id === 'defective-agent') {
        throw new Error("Critical System Failure: Safety Filter Triggered");
      }
      return 1.0;
    });

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // 3. Evolve
    const nextGen = await engine.evolve(population);

    // 4. Assert: Defective agent is NOT in the next generation
    // It should have been assigned fitness 0.0 and excluded from mating pool
    const defectiveSurvivor = nextGen.find(g => g.id === 'defective-agent');
    expect(defectiveSurvivor).toBeUndefined();

    // Assert: No offspring have defective lineage
    // Since defective agent had fitness 0, it shouldn't have been selected as a parent
    nextGen.forEach(child => {
      // Lineage might be empty for elites, or array for offspring
      if (child.lineage && child.lineage.length > 0) {
        expect(child.lineage).not.toContain('defective-agent');
      }
    });

    // Verification: Ensure fitness function was actually called for defective agent
    expect(mockFitnessFn).toHaveBeenCalledWith(expect.objectContaining({ id: 'defective-agent' }));
  });

  it('Gene Integrity: Elite agents are preserved byte-for-byte', async () => {
    // 1. Setup: Elite agent with complex structure
    const complexGene: AgentGene = {
      ...baseGene,
      id: 'elite-1',
      systemPrompt: 'Complex System Prompt with \n Special Characters & JSON: {"key": "val"}',
      parameters: { temp: 0.7, topK: 40, stopSequences: ['User:', 'Model:'] },
      fitness: 100.0 // Pre-calculated high fitness
    };

    const weakGene: AgentGene = {
      ...baseGene,
      id: 'weak-1',
      fitness: 0.1
    };

    const population = [complexGene, weakGene];

    // Config: 1 Elite
    const integrityConfig = { ...config, populationSize: 2, eliteCount: 1 };
    engine = new EvolutionEngine(integrityConfig, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // 2. Evolve
    const nextGen = await engine.evolve(population);

    // 3. Assert: The survivor is strictly identical to the original elite
    const survivor = nextGen[0];

    expect(survivor.id).toBe(complexGene.id);
    expect(survivor.systemPrompt).toBe(complexGene.systemPrompt);
    expect(survivor.parameters).toEqual(complexGene.parameters);

    // Ensure mutation did NOT touch the elite
    expect(survivor.systemPrompt).not.toContain('[MUT]');
  });
});
