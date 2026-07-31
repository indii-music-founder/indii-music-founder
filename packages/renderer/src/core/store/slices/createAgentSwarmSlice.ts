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
  addAgentLog: (log: Omit<AgentActionLog, 'id' | 'timestamp'>) => void;
  setCampaignMetrics: (metrics: CampaignMetrics[]) => void;
  clearAgentLogs: () => void;
}

export const createAgentSwarmSlice: StateCreator<AgentSwarmSlice, [], [], AgentSwarmSlice> = (set) => ({
  agentLogs: [],
  campaignMetrics: [],
  isSwarmActive: true,
  
  fetchAgentLogs: async () => {
    set((state) => ({
      agentLogs: state.agentLogs.length > 0 ? state.agentLogs : [
        { id: '1', agentName: 'Media Buyer', actionType: 'paused_ad', message: 'Paused TikTok Ad due to high CPA.', timestamp: new Date().toISOString(), status: 'success' },
      ]
    }));
  },

  fetchCampaignMetrics: async () => {
    set((state) => ({
      campaignMetrics: state.campaignMetrics.length > 0 ? state.campaignMetrics : [
        { date: '2026-07-28', total_spend: 50.00, total_revenue: 120.00, total_conversions: 4 },
        { date: '2026-07-29', total_spend: 75.00, total_revenue: 210.00, total_conversions: 7 },
        { date: '2026-07-30', total_spend: 110.00, total_revenue: 340.00, total_conversions: 12 },
      ]
    }));
  },

  toggleSwarmStatus: (status) => set({ isSwarmActive: status }),

  addAgentLog: (log) => set((state) => ({
    agentLogs: [
      {
        ...log,
        id: String(Date.now()),
        timestamp: new Date().toISOString(),
      },
      ...state.agentLogs,
    ]
  })),

  setCampaignMetrics: (metrics) => set({ campaignMetrics: metrics }),

  clearAgentLogs: () => set({ agentLogs: [] }),
});
