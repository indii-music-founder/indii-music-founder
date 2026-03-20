import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';

// Mock secureRandomInt to return deterministic values for testing
// selectParent uses secureRandomInt(0, pool.length) — returning 0 picks index 0 (highest fitness)
// mutation check uses secureRandomInt(0, 1000) / 1000 — returning 0 always mutates (0 < mutationRate)
const mockSecureRandomInt = vi.fn().mockReturnValue(0);
vi.mock('@/utils/crypto-random', () => ({
    secureRandomInt: (...args: unknown[]) => mockSecureRandomInt(...args),
    secureRandomHex: vi.fn().mockReturnValue('deadbeef'),
}));

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
    parameters: { temperature: 0.7, thinkingBudget: 1024 },
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Re-establish deterministic selection after resetAllMocks clears module-level defaults
    mockSecureRandomInt.mockReturnValue(0);

    // Default favorable mocks
    mockFitnessFn.mockImplementation(async (gene) => gene.fitness || 0);

    // Mock Crossover: Combine names, prompts, AND parameters (Blending Inheritance)
    mockCrossoverFn.mockImplementation(async (p1, p2) => ({
      ...p1,
      id: 'offspring-temp',
      name: `Child of ${p1.name} & ${p2.name}`,
      systemPrompt: p1.systemPrompt + ' + ' + p2.systemPrompt,
      parameters: {
        // Average temperature (Smart Crossover)
        temperature: (p1.parameters.temperature + p2.parameters.temperature) / 2,
        // Average thinking budget
        thinkingBudget: Math.floor(((p1.parameters.thinkingBudget || 0) + (p2.parameters.thinkingBudget || 0)) / 2)
      },
      generation: Math.max(p1.generation, p2.generation), // Engine increments this
      lineage: [p1.id, p2.id]
    }));

    // Mock Gemini 3 Pro Mutation: Return predictable mutated string AND shift parameters
    mockMutationFn.mockImplementation(async (g) => ({
      ...g,
      systemPrompt: g.systemPrompt + ' [GEMINI_MUTATION]',
      parameters: {
        ...g.parameters,
        // Drift: Add 0.1 to temperature
        temperature: g.parameters.temperature + 0.1,
        // Drift: Increase thinking budget (Evolution towards higher intelligence)
        thinkingBudget: (g.parameters.thinkingBudget || 0) + 512
      }
    }));

    engine = new EvolutionEngine(config, mockFitnessFn, mockMutationFn, mockCrossoverFn);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Runs ONE step of evolution (Select 2, Breed 1) and verifies Genotype/Phenotype evolution', async () => {
    // 0. Enforce Determinism (Helix Philosophy: Randomness is for Evolution, not for Testing)
    // secureRandomInt is mocked to always return 0.
    // Effect on Selection: Always picks index 0 (The Best Available Agent).
    // Effect on Mutation: secureRandomInt(0,1000) = 0, so 0/1000 < 1.0 (Always Mutates).
    mockSecureRandomInt.mockReturnValue(0);

    // 1. Setup Micro-Universe (3 Mock Agents)
    const population: AgentGene[] = [
      { ...mockGene, id: 'agent-1', name: 'Alpha', fitness: 1.0, systemPrompt: 'PROMPT_A', parameters: { temperature: 0.8, thinkingBudget: 2048 } },
      { ...mockGene, id: 'agent-2', name: 'Beta', fitness: 0.8, systemPrompt: 'PROMPT_B', parameters: { temperature: 0.6, thinkingBudget: 1024 } },
      { ...mockGene, id: 'agent-3', name: 'Gamma', fitness: 0.5, systemPrompt: 'PROMPT_C', parameters: { temperature: 0.1, thinkingBudget: 0 } }
    ];

    // 2. Run ONE step
    const nextGen = await engine.evolve(population);

    // 3. Assertions

    // Check Population Size
    expect(nextGen).toHaveLength(3);

    // Check Elitism (Top 2 should survive)
    const survivor1 = nextGen[0];
    const survivor2 = nextGen[1];

    expect(survivor1!.id).toBe('agent-1'); // Alpha
    expect(survivor1!.fitness).toBe(1.0);
    // Helix: Verify Gene Loss Prevention (Thinking Budget must be preserved in Elites)
    expect(survivor1!.parameters.thinkingBudget).toBe(2048);

    expect(survivor2!.id).toBe('agent-2'); // Beta
    expect(survivor2!.fitness).toBe(0.8);
    expect(survivor2!.parameters.thinkingBudget).toBe(1024);

    // Helix: Verify Elites were NOT mutated (Gene Preservation)
    // The mutation function should NOT have been called for these agents
    mockMutationFn.mock.calls.forEach(call => {
        const gene = call[0] as AgentGene;
        expect(gene.id).not.toBe('agent-1');
        expect(gene.id).not.toBe('agent-2');
    });

    // Check Offspring (Index 2)
    const offspring = nextGen[2];

    // Offspring must exist and be distinct
    expect(offspring).toBeDefined();
    expect(offspring!.id).not.toBe('agent-1');
    expect(offspring!.id).not.toBe('agent-2');
    expect(offspring!.id).not.toBe('agent-3');

    // Valid Lineage (Should be from top pool)
    expect(offspring!.lineage.length).toBe(2);

    // STRICT SELECTION CHECK:
    // Because we mocked random to 0, Selection MUST pick the top agents.
    // Parent 1: Alpha (Index 0 of Full Pool)
    // Parent 2: Beta (Index 0 of Remaining Pool)
    expect(offspring!.lineage).toEqual(['agent-1', 'agent-2']);

    // Valid Mutation (Mocked Gemini Call) - Phenotype Check
    expect(offspring!.systemPrompt).toContain('[GEMINI_MUTATION]');

    // Verify Crossover Logic happened (Prompt Combination) - Phenotype Check
    expect(offspring!.systemPrompt).toContain('PROMPT_A');
    expect(offspring!.systemPrompt).toContain('PROMPT_B');
    expect(offspring!.systemPrompt).toContain('+');

    // Verify Parameter Evolution (Genotype Check)
    // Parent 1 (Alpha) Temp: 0.8
    // Parent 2 (Beta) Temp: 0.6
    // Crossover Average: (0.8 + 0.6) / 2 = 0.7
    // Mutation Drift: 0.7 + 0.1 = 0.8
    expect(offspring!.parameters.temperature).toBeCloseTo(0.8);

    // Verify Thinking Budget Evolution
    // Parent 1 (Alpha) Budget: 2048
    // Parent 2 (Beta) Budget: 1024
    // Crossover Average: (2048 + 1024) / 2 = 1536
    // Mutation Drift: 1536 + 512 = 2048
    expect(offspring!.parameters.thinkingBudget).toBe(2048);
  });

  it('Mutation Safety: Rejects invalid JSON/Empty Mutations and Retries (Death to the buggy)', async () => {
    // 1. Setup Flaky Mutation Logic
    // Simulate that the LLM returns broken JSON or empty prompts for the first 2 attempts,
    // then finally succeeds.
    const error = new Error("Helix Guardrail: Invalid JSON Syntax");
    mockMutationFn
        .mockRejectedValueOnce(error) // Fail 1 (Invalid JSON)
        .mockResolvedValueOnce({ ...mockGene, systemPrompt: '' }) // Fail 2 (Empty Prompt - Logic should catch this)
        .mockResolvedValue({ ...mockGene, id: 'child-valid', systemPrompt: 'VALID_MUTATION', parameters: { temperature: 0.5, thinkingBudget: 1024 } }); // Success

    // 2. Setup Population (Need breeding)
    const population: AgentGene[] = [
      { ...mockGene, id: 'p1', fitness: 1.0 },
      { ...mockGene, id: 'p2', fitness: 0.9 },
      { ...mockGene, id: 'p3', fitness: 0.8 } // extra to ensure pool size
    ];

    // 3. Evolve
    const nextGen = await engine.evolve(population);

    // 4. Assertions

    // Check Population Integrity (Still need 3 agents)
    expect(nextGen).toHaveLength(3);

    // Check that we eventually got a valid offspring
    const offspring = nextGen[2];
    expect(offspring!.systemPrompt).toBe('VALID_MUTATION');

    // Verify Retries happened
    // Should be called EXACTLY 3 times (Fail, Fail, Success)
    expect(mockMutationFn).toHaveBeenCalledTimes(3);
  });
});
