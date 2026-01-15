import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockMutationFn = vi.fn();
const mockCrossoverFn = vi.fn();

describe('🧬 Helix: Gene Loss Prevention', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 4,
    mutationRate: 1.0, // Force mutation
    eliteCount: 1,
    maxGenerations: 5
  };

  const healthyGene: AgentGene = {
    id: 'healthy',
    name: 'Healthy Agent',
    systemPrompt: 'Valid Prompt',
    parameters: { temp: 0.7, topP: 0.9 },
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockFitnessFn.mockResolvedValue(1.0);
    // Crossover produces valid child
    mockCrossoverFn.mockResolvedValue({ ...healthyGene, id: 'child' });
    // Default mutation is valid
    mockMutationFn.mockImplementation(async (g) => ({ ...g, systemPrompt: 'Mutated' }));
  });

  it('Schema Compliance: Rejects offspring with missing parameters (The "Brainless" Mutation)', async () => {
    // Scenario: A mutation accidentally drops the 'parameters' object.
    // This often happens when LLMs generate partial JSON.
    // If accepted, this "Brainless" agent will crash the runtime when `gene.parameters.temp` is accessed.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    // 1. Setup Mutation failure sequence:
    // Call 1: Returns gene with NO parameters (undefined) -> Should be rejected
    // Call 2: Returns gene with NULL parameters -> Should be rejected
    // Call 3+: Returns VALID gene -> Should be accepted
    mockMutationFn
      .mockResolvedValueOnce({ ...healthyGene, parameters: undefined as any }) // Defect 1
      .mockResolvedValueOnce({ ...healthyGene, parameters: null as any })      // Defect 2
      .mockResolvedValue({ ...healthyGene, parameters: { temp: 0.8 } });       // Valid

    const population: AgentGene[] = [
      { ...healthyGene, id: 'p1' },
      { ...healthyGene, id: 'p2' }
    ];

    // 2. Evolve
    const nextGen = await engine.evolve(population);

    // 3. Assertions
    expect(nextGen).toHaveLength(4);

    // Verify offspring (non-elites) have valid parameters
    const offspring = nextGen.slice(1);
    offspring.forEach(child => {
      expect(child.parameters).toBeTruthy();
      expect(child.parameters).not.toBeNull();
      // Ensure we eventually got the valid one
      expect(child.parameters.temp).toBe(0.8);
    });

    // Verify rejection count
    // We expect mutation to be called:
    // 1 (Undefined) + 1 (Null) + 3 (Success needed for 3 spots) = 5 calls
    expect(mockMutationFn).toHaveBeenCalledTimes(5);
  });

  it('Elitism Integrity: Ensures mutation of offspring does not corrupt the elite parent (Mutation by Reference)', async () => {
    // Scenario: The "Fly" Defect.
    // 1. Crossover lazily returns a reference to Parent 1 (no cloning).
    // 2. Mutation modifies that reference IN PLACE.
    // 3. Since Parent 1 is an Elite, the Elite in the next generation accidentally gets mutated too.
    // Helix must prevent this gene corruption.

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);

    const eliteGene: AgentGene = {
      ...healthyGene,
      id: 'elite',
      systemPrompt: 'ORIGINAL_PURE_PROMPT',
      fitness: 1.0
    };

    const population: AgentGene[] = [
      eliteGene,
      { ...healthyGene, id: 'weak', fitness: 0.1 }
    ];

    // 1. Mock "Lazy" Crossover (Returns Parent Reference)
    mockCrossoverFn.mockImplementation(async (p1, p2) => {
      return p1; // DANGER: Returning reference!
    });

    // 2. Mock "Destructive" Mutation (Modifies In-Place)
    mockMutationFn.mockImplementation(async (g) => {
      g.systemPrompt = 'CORRUPTED_MUTATION'; // DANGER: Modifying reference!
      return g;
    });

    // 3. Evolve
    const nextGen = await engine.evolve(population);

    // 4. Assertions
    expect(nextGen).toHaveLength(4);

    // The Elite (Index 0) MUST remain pure
    const eliteSurvivor = nextGen[0];
    expect(eliteSurvivor.id).toBe('elite');
    expect(eliteSurvivor.systemPrompt).toBe('ORIGINAL_PURE_PROMPT');
    expect(eliteSurvivor.systemPrompt).not.toBe('CORRUPTED_MUTATION');
  });
});
