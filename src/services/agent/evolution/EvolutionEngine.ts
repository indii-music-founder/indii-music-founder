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

    // 2. Selection (Elitism)
    const nextGeneration: AgentGene[] = [];
    const elites = scoredPopulation.slice(0, this.config.eliteCount);
    nextGeneration.push(...elites);

    // 3. Crossover & Mutation
    let attempts = 0;
    const MAX_ATTEMPTS = this.config.populationSize * 5; // Safety break to prevent infinite loops

    while (nextGeneration.length < this.config.populationSize && attempts < MAX_ATTEMPTS) {
      attempts++;
      try {
        // Simple Tournament Selection or Top K for parents
        const parent1 = this.selectParent(scoredPopulation);
        const parent2 = this.selectParent(scoredPopulation);

        let offspring = await this.crossoverFn(parent1, parent2);

        // Mutation
        if (Math.random() < this.config.mutationRate) {
          offspring = await this.mutationFn(offspring);
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
        // We log implicitly by silence (or could log to console if needed),
        // but we ensure the population count is eventually reached.
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
