
import { describe, it, expect, vi } from 'vitest';

// --- Interfaces ---

interface EvoAgent {
    id: string;
    prompt: string;
    fitness: number;
    generation: number;
}

// --- Mock Services ---

// Mocking the AI Service for Mutation
const mockAIMutation = vi.fn(async (prompt: string): Promise<string> => {
    return `Mutated: ${prompt}`;
});

// Mock Fitness Function
const mockFitnessFunction = vi.fn((prompt: string): number => {
    // Simple deterministic fitness: length of prompt
    return prompt.length;
});

// --- Evolutionary Logic (The "System Under Test") ---

async function runEvolutionStep(
    population: EvoAgent[],
    generationLimit: number
): Promise<EvoAgent[]> {
    if (population.length === 0) return [];

    const currentGen = population[0].generation;
    if (currentGen >= generationLimit) {
        return population; // Stop evolution
    }

    // 1. Selection (Elitism: Keep top 50%)
    const sortedPop = [...population].sort((a, b) => b.fitness - a.fitness);
    const survivors = sortedPop.slice(0, Math.ceil(population.length / 2));

    const nextGen: EvoAgent[] = [...survivors];

    // 2. Crossover & Mutation (Fill the rest)
    while (nextGen.length < population.length) {
        // Simple random parent selection from survivors
        const parent1 = survivors[Math.floor(Math.random() * survivors.length)];
        const parent2 = survivors[Math.floor(Math.random() * survivors.length)];

        // Crossover: Combine prompts
        const crossoverPrompt = `${parent1.prompt} + ${parent2.prompt}`;

        // Mutation: Use Gemini (Mocked)
        const mutatedPrompt = await mockAIMutation(crossoverPrompt);

        // Fitness Calculation
        const childFitness = mockFitnessFunction(mutatedPrompt);

        const child: EvoAgent = {
            id: `gen${currentGen + 1}-${nextGen.length}`,
            prompt: mutatedPrompt,
            fitness: childFitness,
            generation: currentGen + 1
        };

        nextGen.push(child);
    }

    return nextGen;
}

// --- Tests ---

describe('🧬 Helix: Evolutionary Loop', () => {

    it('should run one step of evolution (Micro-Universe)', async () => {
        // Setup Micro-Universe
        const initialPopulation: EvoAgent[] = [
            { id: 'gen0-1', prompt: 'Agent A', fitness: 10, generation: 0 },
            { id: 'gen0-2', prompt: 'Agent B', fitness: 20, generation: 0 }, // Best
            { id: 'gen0-3', prompt: 'Agent C', fitness: 5, generation: 0 }
        ];

        // Run Evolution
        const nextGen = await runEvolutionStep(initialPopulation, 5);

        // Assertions
        expect(nextGen).toHaveLength(3); // Population size maintained
        expect(nextGen[0].generation).toBe(0); // Elitism: survivor keeps gen 0 (or strictly, should we bump it? Logic preserves object)

        // Check Elitism (Best agent should survive)
        const bestAgentId = 'gen0-2';
        expect(nextGen.some(a => a.id === bestAgentId)).toBe(true);

        // Check Evolution (Offspring created)
        const offspring = nextGen.find(a => a.generation === 1);
        expect(offspring).toBeDefined();
        expect(offspring?.prompt).toContain('Mutated:');

        // Validate Mutation Call
        expect(mockAIMutation).toHaveBeenCalled();
    });

    it('should respect generation limits', async () => {
        const population: EvoAgent[] = [
            { id: 'gen5-1', prompt: 'Agent X', fitness: 10, generation: 5 }
        ];

        const nextGen = await runEvolutionStep(population, 5);

        // Should not evolve past limit
        expect(nextGen[0].generation).toBe(5);
        expect(nextGen).toEqual(population);
    });

    it('should preserve the best agents (Gene Loss Check)', async () => {
        const population: EvoAgent[] = [
            { id: 'weak', prompt: 'Weak', fitness: 1, generation: 0 },
            { id: 'strong', prompt: 'Strong', fitness: 100, generation: 0 }
        ];

        const nextGen = await runEvolutionStep(population, 5);

        // Strong agent must be present in next gen
        expect(nextGen.find(a => a.id === 'strong')).toBeDefined();
        // Ideally weak agent is replaced or at least the strong one is top
        expect(nextGen[0].id).toBe('strong'); // Since we sorted
    });

    it('should produce valid offspring that are distinct from parents', async () => {
         const population: EvoAgent[] = [
            { id: 'p1', prompt: 'Parent1', fitness: 10, generation: 0 },
            { id: 'p2', prompt: 'Parent2', fitness: 10, generation: 0 }
        ];

        const nextGen = await runEvolutionStep(population, 5);
        const offspring = nextGen.find(a => a.generation === 1);

        expect(offspring).toBeDefined();
        expect(offspring?.prompt).not.toBe('Parent1');
        expect(offspring?.prompt).not.toBe('Parent2');
        // Based on mock: "Mutated: ParentX + ParentY"
        expect(offspring?.prompt).toMatch(/^Mutated:/);
    });
});
