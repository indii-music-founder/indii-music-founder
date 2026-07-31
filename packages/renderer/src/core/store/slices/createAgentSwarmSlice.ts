import { StateCreator } from 'zustand';

export interface AgentActionLog {
  id: string;
  agentName: string; 
  actionType: 'launched_ad' | 'paused_ad' | 'generated_creative' | 'vision_qc_failed';
  message: string;
  timestamp: string;
  status: 'success' | 'pending' | 'failed';
}

export interface CampaignMetrics {
  date: string;
  total_spend: number;
  total_revenue: number;
  total_conversions: number;
}

export interface AgentSwarmSlice {
  agentLogs: AgentActionLog[];
  campaignMetrics: CampaignMetrics[];
  isSwarmActive: boolean;
  fetchAgentLogs: () => Promise<void>;
  fetchCampaignMetrics: () => Promise<void>;
  toggleSwarmStatus: (status: boolean) => void;
}

export const createAgentSwarmSlice: StateCreator<AgentSwarmSlice, [], [], AgentSwarmSlice> = (set) => ({
  agentLogs: [],
  campaignMetrics: [],
  isSwarmActive: true,
  
  fetchAgentLogs: async () => {
    set({
      agentLogs: [
        { id: '1', agentName: 'Media Buyer', actionType: 'paused_ad', message: 'Paused TikTok Ad due to high CPA.', timestamp: new Date().toISOString(), status: 'success' },
      ]
    });
  },

  fetchCampaignMetrics: async () => {
    set({
      campaignMetrics: [
        { date: '2026-07-28', total_spend: 50.00, total_revenue: 120.00, total_conversions: 4 },
      ]
    });
  },

  toggleSwarmStatus: (status) => set({ isSwarmActive: status }),
});
