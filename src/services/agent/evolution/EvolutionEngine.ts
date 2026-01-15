import { v4 as uuidv4 } from 'uuid';
import { AgentGene, EvolutionConfig, FitnessFunction, MutationFunction, CrossoverFunction } from './types';

export class EvolutionEngine {
  private config: EvolutionConfig;
  private fitnessFn: FitnessFunction;
  private mutationFn: MutationFunction;
  private crossoverFn: CrossoverFunction;

  constructor(
    config: EvolutionConfig,
    fitnessFn: FitnessFunction,
    mutationFn: MutationFunction,
    crossoverFn: CrossoverFunction
  ) {
    this.config = config;
    this.fitnessFn = fitnessFn;
    this.mutationFn = mutationFn;
    this.crossoverFn = crossoverFn;
  }

  async evolve(population: AgentGene[]): Promise<AgentGene[]> {
    // 1. Evaluate Fitness
    const scoredPopulation = await Promise.all(
      population.map(async (gene) => {
        if (gene.fitness === undefined) {
          try {
            const fitness = await this.fitnessFn(gene);
            return { ...gene, fitness };
          } catch (error) {
            // Helix: If fitness check crashes, the gene is defective.
            // Assign 0.0 fitness (Death to the buggy).
            return { ...gene, fitness: 0.0 };
          }
        }
        return gene;
      })
    );

    // Sort by fitness (descending)
    scoredPopulation.sort((a, b) => (b.fitness || 0) - (a.fitness || 0));

    // Helix: "Doomsday Switch"
    // If the population has reached the maximum generation, we halt evolution to prevent infinite loops.
    const currentMaxGeneration = Math.max(...scoredPopulation.map(g => g.generation || 0));
    if (this.config.maxGenerations && currentMaxGeneration >= this.config.maxGenerations) {
      return scoredPopulation.slice(0, this.config.populationSize);
    }

    // 2. Selection (Elitism)
    const nextGeneration: AgentGene[] = [];
    const elites = scoredPopulation.slice(0, this.config.eliteCount);
    nextGeneration.push(...elites);

    // Filter out zero-fitness agents for reproduction
    // Helix: "Fitness Validator" - a score of 0.0 kills the agent (prevents reproduction)
    const matingPool = scoredPopulation.filter(gene => (gene.fitness || 0) > 0);

    // If the mating pool is empty (mass extinction), we can't breed.
    // We return whatever elites survived (or empty if no elites).
    if (matingPool.length === 0) {
      return nextGeneration;
    }

    // 3. Crossover & Mutation
    let attempts = 0;
    const MAX_ATTEMPTS = this.config.populationSize * 5; // Safety break to prevent infinite loops

    while (nextGeneration.length < this.config.populationSize && attempts < MAX_ATTEMPTS) {
      attempts++;
      try {
        // Simple Tournament Selection or Top K for parents
        // We select strictly from the mating pool (fitness > 0)
        const parent1 = this.selectParent(matingPool);

        // Helix: Prevent asexual reproduction (Self-Crossover)
        // We exclude the first parent from the pool for the second selection.
        const remainingPool = matingPool.filter(p => p.id !== parent1.id);

        // If only one parent exists in the entire pool, we are forced to self-crossover.
        // Otherwise, we strictly select a different partner.
        let parent2: AgentGene;
        if (remainingPool.length > 0) {
          parent2 = this.selectParent(remainingPool);
        } else {
          parent2 = parent1;
        }

        let offspring = await this.crossoverFn(parent1, parent2);

        // Helix Guardrail: Prevent "Mutation by Reference" (The Fly Defect)
        // We deep clone the offspring to ensure that if crossover returned a parent reference,
        // we don't accidentally mutate the parent (which might be an Elite survivor).
        try {
          offspring = structuredClone(offspring);
        } catch (e) {
          // Fallback for environments without structuredClone or non-clonable objects
          // Helix: Reference Integrity Check
          if (offspring === parent1 || offspring === parent2) {
            offspring = JSON.parse(JSON.stringify(offspring));
          }
        }

        // Mutation
        if (Math.random() < this.config.mutationRate) {
          offspring = await this.mutationFn(offspring);
        }

        // Helix: Validation Guardrail
        // Prevent "Empty Soul" (Empty Prompt) or malformed agents from entering the gene pool.
        if (!offspring || !offspring.systemPrompt || typeof offspring.systemPrompt !== 'string' || offspring.systemPrompt.trim() === '') {
          throw new Error("Helix Guardrail: Mutation produced invalid offspring (Empty Gene)");
        }

        // Helix: "The Bloat Check"
        // Prevent runaway mutations from exploding the context window.
        // Cap is set to 100,000 characters (approx 25k tokens), which is a safe limit for system prompts.
        const MAX_PROMPT_LENGTH = 100000;
        if (offspring.systemPrompt.length > MAX_PROMPT_LENGTH) {
          throw new Error(`Helix Guardrail: Mutation produced invalid offspring (Prompt Bloat: ${offspring.systemPrompt.length} chars)`);
        }
        // Helix: "Brainless" Check
        // Ensure parameters exist and are not null (prevents runtime crashes).
        if (!offspring.parameters || typeof offspring.parameters !== 'object') {
          throw new Error("Helix Guardrail: Mutation produced invalid offspring (Missing Parameters)");
        }

        // Ensure ID is new and lineage is tracked
        offspring.id = uuidv4();
        offspring.generation = Math.max(parent1.generation, parent2.generation) + 1;
        offspring.lineage = [parent1.id, parent2.id];
        offspring.fitness = undefined; // Reset fitness for new gene

        nextGeneration.push(offspring);
      } catch (error) {
        // Helix: Survival of the fittest, but death to the buggy.
        // If mutation/crossover fails (e.g., invalid JSON), we discard this offspring
        // and loop again to try a new combination.
        continue;
      }
    }

    return nextGeneration;
  }

  private selectParent(population: AgentGene[]): AgentGene {
    // Simple implementation: Tournament selection of size 3
    const tournamentSize = 3;
    let best = population[Math.floor(Math.random() * population.length)];

    for (let i = 0; i < tournamentSize - 1; i++) {
      const contender = population[Math.floor(Math.random() * population.length)];
      if ((contender.fitness || 0) > (best.fitness || 0)) {
        best = contender;
      }
    }
    return best;
  }
}
