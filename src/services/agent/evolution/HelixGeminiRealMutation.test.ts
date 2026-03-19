import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EvolutionEngine } from './EvolutionEngine';
import { AgentGene, EvolutionConfig } from './types';
import { GenAI as AI } from '@/services/ai/GenAI';

// Mock GenAI
vi.mock('@/services/ai/GenAI', () => ({
  GenAI: {
    generateText: vi.fn(),
    generateContent: vi.fn()
  }
}));

// Real-like Gemini Mutation Function
// This function constructs a prompt and calls AI.generateText, mimicking the real application logic.
const geminiMutationFn = async (gene: AgentGene): Promise<AgentGene> => {
  // 1. Construct Mutation Prompt
  const mutationPrompt = `
      You are an Evolutionary Mutation Engine powered by Gemini 3 Pro.
      Your task is to mutate the following agent's system prompt and parameters to improve its fitness.

      Original System Prompt: "${gene.systemPrompt}"
      Original Parameters: ${JSON.stringify(gene.parameters)}

      Output ONLY a JSON object with 'systemPrompt' (string) and 'parameters' (object).
      Do not add markdown formatting.
    `;

  // 2. Call Gemini (Mocked)
  // We use a high temperature to encourage diversity, as per Helix philosophy.
  const responseText = await AI.generateText(mutationPrompt, 0.9);

  // 3. Parse and Apply
  try {
    const mutation = JSON.parse(responseText);
    return {
      ...gene,
      systemPrompt: mutation.systemPrompt,
      parameters: { ...gene.parameters, ...mutation.parameters }
    };
  } catch (e) {
    // Fallback or re-throw (EvolutionEngine handles retries)
    throw new Error("Gemini produced invalid JSON");
  }
};

describe('🧬 Helix: Gemini 3 Pro Real Mutation Loop', () => {
  let engine: EvolutionEngine;

  const config: EvolutionConfig = {
    populationSize: 3,
    mutationRate: 1.0, // Force mutation
    eliteCount: 2,
    maxGenerations: 2
  };

  const mockGene: AgentGene = {
    id: 'genesis',
    name: 'Genesis',
    systemPrompt: 'Original Prompt',
    parameters: { temperature: 0.5 },
    generation: 0,
    lineage: []
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Verifies the evolutionary loop using a mocked Gemini 3 Pro call', async () => {
    // 1. Setup Mock Response from Gemini 3 Pro
    // This is the "Predictable 'Mutated String'" requested.
    const mockedMutationResponse = JSON.stringify({
      systemPrompt: "Original Prompt [MUTATED BY GEMINI 3 PRO]",
      parameters: { temperature: 0.99, thinkingBudget: 4000 }
    });

    vi.mocked(AI.generateText).mockResolvedValue(mockedMutationResponse);

    // 2. Setup Deterministic Randomness for Selection
    vi.spyOn(Math, 'random').mockReturnValue(0.0);

    // 3. Setup Population
    const population: AgentGene[] = [
      { ...mockGene, id: 'elite-1', fitness: 100 },
      { ...mockGene, id: 'elite-2', fitness: 90 },
      { ...mockGene, id: 'weak-1', fitness: 10 }
    ];

    // 4. Initialize Engine with the "Real" Mutation Function
    const mockFitnessFn = vi.fn().mockImplementation(async (g) => g.fitness || 0);
    const mockCrossoverFn = vi.fn().mockImplementation(async (p1, p2) => ({
      ...p1,
      id: 'child',
      systemPrompt: p1.systemPrompt,
      parameters: p1.parameters
    }));

    engine = new EvolutionEngine(config, mockFitnessFn, geminiMutationFn, mockCrossoverFn);

    // 5. Evolve
    const nextGen = await engine.evolve(population);

    // 6. Verify Loop Integrity
    expect(nextGen).toHaveLength(3);

    // 7. Verify Offspring (Index 2)
    const offspring = nextGen[2];

    // Assert that the mutation function actually called the AI Service
    expect(AI.generateText).toHaveBeenCalledTimes(1);

    // Assert the prompt passed to Gemini contained the original prompt
    expect(AI.generateText).toHaveBeenCalledWith(
      expect.stringContaining('Original Prompt'),
      0.9 // Temperature check
    );

    // Assert the offspring has the mutated phenotype from the mocked response
    expect(offspring!.systemPrompt).toBe("Original Prompt [MUTATED BY GEMINI 3 PRO]");
    expect(offspring!.parameters.temperature).toBe(0.99);
    expect(offspring!.parameters.thinkingBudget).toBe(4000);
  });
});
