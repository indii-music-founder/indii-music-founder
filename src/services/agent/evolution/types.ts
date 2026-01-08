export interface AgentGene {
  id: string;
  name: string;
  systemPrompt: string;
  parameters: Record<string, any>; // e.g., temperature, topP
  fitness?: number;
  generation: number;
  lineage: string[]; // IDs of parents
}

export interface EvolutionConfig {
  populationSize: number;
  mutationRate: number;
  eliteCount: number;
  maxGenerations: number;
}

// Function types for dependency injection (mocking)
export type FitnessFunction = (gene: AgentGene) => Promise<number>;
export type MutationFunction = (gene: AgentGene) => Promise<AgentGene>;
export type CrossoverFunction = (parent1: AgentGene, parent2: AgentGene) => Promise<AgentGene>;
