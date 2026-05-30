import { logger } from '@/utils/logger';

export interface AgentCapability {
  description: string;
  trigger_labels: string[];
}

export interface SwarmAgentData {
  path: string;
  skills: Record<string, AgentCapability>;
  instructions_preview: string;
}

export interface CapabilityRegistry {
  last_updated: string;
  root: string;
  agents: Record<string, SwarmAgentData>;
}

class AgentCapabilityService {
  private registry: CapabilityRegistry | null = null;

  async getRegistry(): Promise<CapabilityRegistry | null> {
    if (this.registry) return this.registry;

    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI || !electronAPI.agent) {
        logger.warn('[AgentCapabilityService] electronAPI.agent not found. Possibly running outside Electron.');
        return null;
      }

      const response = await electronAPI.agent.getCapabilityRegistry();
      if (response && response.success) {
        this.registry = response.data;
        return this.registry;
      } else {
        logger.error('[AgentCapabilityService] Failed to fetch registry:', response?.error || 'Unknown error');
        return null;
      }
    } catch (error) {
      logger.error('[AgentCapabilityService] Error fetching registry:', error);
      return null;
    }
  }

  async getAgentTools(agentId: string): Promise<Record<string, AgentCapability> | null> {
    const registry = await this.getRegistry();
    if (!registry) return null;

    const agentData = registry.agents[agentId];
    return agentData ? agentData.skills : null;
  }
}

export const agentCapabilityService = new AgentCapabilityService();
