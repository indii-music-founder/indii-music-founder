import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * HELIX TEST SUITE: Gemini 3 Pro Integration
 * Verifies the evolutionary loop with a realistic AI mutation mock.
 */

// Mock dependencies
const mockFitnessFn = vi.fn();
const mockCrossoverFn = vi.fn();

// The "Gemini" Mutation Mock
// Simulates the behavior of calling Vertex AI/Gemini with a prompt and parsing the JSON response.
const mockGeminiMutation = vi.fn();

describe('🧬 Helix: Gemini 3 Pro Evolution Scenario', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 3,
    mutationRate: 1.0, // Force mutation for this test
    eliteCount: 1,
    maxGenerations: 5
  };

  const baseGene: AgentGene = {
    id: 'genesis',
    name: 'Genesis Agent',
    systemPrompt: 'You are a helper.',
    parameters: { temperature: 0.5 },
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Default Fitness: Higher ID number = Higher Fitness (for determinism)
    // e.g. "agent-10" > "agent-5"
    mockFitnessFn.mockImplementation(async (gene: AgentGene) => {
      const val = parseInt(gene.id.split('-')[1] || '0');
      return isNaN(val) ? 0 : val;
    });

    // Default Crossover: Merge names
    mockCrossoverFn.mockImplementation(async (p1: AgentGene, p2: AgentGene) => ({
      ...p1,
      id: 'temp-child', // Engine will overwrite
      name: `Child of ${p1.name} & ${p2.name}`,
      systemPrompt: p1.systemPrompt,
      generation: 0, // Engine will overwrite
      lineage: [] // Engine will overwrite
    }));

    // Default Gemini Behavior: Valid JSON Response
    mockGeminiMutation.mockImplementation(async (gene: AgentGene) => {
      // Simulate network delay
      // await new Promise(r => setTimeout(r, 10));

      // Simulate Gemini "Thinking" and returning a new prompt
      const newPrompt = `${gene.systemPrompt} [Improved by Gemini]`;

      return {
        ...gene,
        systemPrompt: newPrompt,
        parameters: {
          ...gene.parameters,
          temperature: Math.random() // Mutation changes params
        }
      };
    });

    engine = new EvolutionEngine(config, mockFitnessFn, mockGeminiMutation, mockCrossoverFn);
  });

  it('Micro-Universe: Should successfully evolve using Gemini-like mutation', async () => {
    // 1. Setup Micro-Universe
    const population: AgentGene[] = [
      { ...baseGene, id: 'agent-10', fitness: 10 }, // Elite
      { ...baseGene, id: 'agent-5', fitness: 5 },
      { ...baseGene, id: 'agent-1', fitness: 1 }
    ];

    // 2. Run ONE step of evolution
    const nextGen = await engine.evolve(population);

    // 3. Assert: Population Size
    expect(nextGen).toHaveLength(3);

    // 4. Assert: Elitism (Agent 10 should survive as index 0)
    expect(nextGen[0].id).toBe('agent-10');
    expect(nextGen[0].fitness).toBe(10);

    // 5. Assert: Offspring (Index 1 & 2 should be new)
    const offspring = nextGen[1];
    expect(offspring.id).not.toBe('agent-10');
    expect(offspring.generation).toBe(1);

    // 6. Assert: Mutation Applied
    expect(offspring.systemPrompt).toContain('[Improved by Gemini]');
    expect(mockGeminiMutation).toHaveBeenCalled();
  });

  it('Gene Loss: Should preserve the best Gemini prompts (Elitism)', async () => {
    const population: AgentGene[] = [
      { ...baseGene, id: 'agent-100', name: 'Best', fitness: 100 },
      { ...baseGene, id: 'agent-1', name: 'Worst', fitness: 1 }
    ];

    // Resize config for this test
    const testConfig = { ...config, populationSize: 2 };
    engine = new EvolutionEngine(testConfig, mockFitnessFn, mockGeminiMutation, mockCrossoverFn);

    const nextGen = await engine.evolve(population);

    expect(nextGen[0].id).toBe('agent-100');
  });

  it('Death to the Buggy: Should reject invalid JSON (Schema Failures) and retry', async () => {
    // 1. Setup: Mutation always happens
    const population: AgentGene[] = [
      { ...baseGene, id: 'agent-10', fitness: 10 },
      { ...baseGene, id: 'agent-5', fitness: 5 }
    ];

    // Config: 2 Agents, 1 Elite, 1 Offspring needed
    const testConfig = { ...config, populationSize: 2 };
    engine = new EvolutionEngine(testConfig, mockFitnessFn, mockGeminiMutation, mockCrossoverFn);

    // 2. Mock: Gemini hallucinates bad JSON twice, then succeeds
    mockGeminiMutation
      .mockRejectedValueOnce(new Error("SyntaxError: Unexpected token in JSON"))
      .mockRejectedValueOnce(new Error("SchemaValidationError: Missing 'systemPrompt'"))
      .mockResolvedValueOnce({
         ...baseGene,
         id: 'agent-valid',
         systemPrompt: 'Finally Valid JSON',
         generation: 1
      });

    // 3. Run Evolution
    const nextGen = await engine.evolve(population);

    // 4. Assert
    expect(nextGen).toHaveLength(2);
    // The engine should have retried until it got the valid one
    const offspring = nextGen.find(g => g.id !== 'agent-10');
    expect(offspring).toBeDefined();
    expect(offspring?.systemPrompt).toBe('Finally Valid JSON');

    // Verify it took 3 attempts (2 fails + 1 success) to get the offspring
    // Note: It calls crossover/mutation in a loop.
    // If crossover succeeds but mutation fails, the engine `continue`s loop.
    // So mutationFn should be called 3 times.
    expect(mockGeminiMutation).toHaveBeenCalledTimes(3);
  });
});
