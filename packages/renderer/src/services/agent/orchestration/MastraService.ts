import { logger } from '@/utils/logger';
import { 
    AgentGraph, 
    GraphNode, 
    GraphEdge, 
    AgentContext,
    ValidAgentId
} from '../types';
import { agentGraphService } from './AgentGraphService';

/**
 * MastraService — High-Level Agent Graph Orchestrator
 * 
 * Inspired by the Mastra framework, this service provides a fluent API 
 * for building and executing deterministic multi-agent workflows.
 */
export class MastraService {
  /**
   * Builds a simple linear workflow (A -> B -> C).
   */
  async buildLinearWorkflow(
    name: string, 
    steps: { agentId: ValidAgentId; task: string }[]
  ): Promise<AgentGraph> {
    const nodes: GraphNode[] = steps.map((step, index) => ({
      id: `node_${index}`,
      agentId: step.agentId,
      taskTemplate: step.task,
      waitCondition: 'all'
    }));

    const edges: GraphEdge[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        sourceId: nodes[i]!.id,
        targetId: nodes[i + 1]!.id,
        inputMapping: { output: 'input' }
      });
    }

    if (nodes.length === 0) throw new Error('Workflow must have at least one step');

    return {
      id: `workflow_${Date.now()}`,
      name,
      description: `Linear workflow: ${name}`,
      nodes,
      edges,
      entryNodeId: nodes[0]!.id,
      metadata: {
        version: '1.0.0',
        author: 'MastraService',
        createdAt: Date.now()
      }
    };
  }

  /**
   * Executes a workflow with a specific input.
   */
  async run(graph: AgentGraph, input: string, context: AgentContext): Promise<string> {
    logger.info(`[Mastra] Running workflow: ${graph.name}`);
    return await agentGraphService.executeGraph(graph, context, input);
  }

  /**
   * Pre-defined "Industry Standard" Workflows
   */
  static Workflows = {
    /**
     * Release Pipeline: Analytics -> Legal -> Distribution
     */
    RELEASE_CHECKLIST: async () => {
      const mastra = new MastraService();
      return mastra.buildLinearWorkflow('Production Release Checklist', [
        { 
          agentId: 'analytics', 
          task: 'Analyze the viral potential for this track: {{input}}' 
        },
        { 
          agentId: 'legal', 
          task: 'Review the metadata for DSP compliance and IP rights: {{node_0.output}}' 
        },
        { 
          agentId: 'distribution', 
          task: 'Validate audio specs and prepare for upload: {{node_1.output}}' 
        }
      ]);
    }
  };
}

export const mastraService = new MastraService();
