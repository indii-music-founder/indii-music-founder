import React, { useEffect } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Power, AlertCircle, CheckCircle2 } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export const AgentSwarmDashboard: React.FC = () => {
  const { 
    agentLogs, 
    campaignMetrics, 
    isSwarmActive, 
    fetchAgentLogs, 
    fetchCampaignMetrics,
    toggleSwarmStatus
  } = useStore(
    useShallow((state) => ({
      agentLogs: state.agentLogs,
      campaignMetrics: state.campaignMetrics,
      isSwarmActive: state.isSwarmActive,
      fetchAgentLogs: state.fetchAgentLogs,
      fetchCampaignMetrics: state.fetchCampaignMetrics,
      toggleSwarmStatus: state.toggleSwarmStatus,
    }))
  );

  useEffect(() => {
    fetchAgentLogs();
    fetchCampaignMetrics();
  }, [fetchAgentLogs, fetchCampaignMetrics]);

  return (
    <div className="p-6 bg-zinc-950 text-white min-h-screen space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Swarm Command Center</h1>
          <p className="text-zinc-400">Autonomous Marketing Intelligence</p>
        </div>
        <button 
          onClick={() => toggleSwarmStatus(!isSwarmActive)}
          className={twMerge(
            "flex items-center gap-2 px-4 py-2 rounded-md font-semibold transition-colors cursor-pointer",
            isSwarmActive ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
          )}
        >
          <Power size={18} />
          {isSwarmActive ? 'Halt All Agents' : 'Activate Swarm'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Activity className="text-blue-400" />
              Campaign Performance (ROAS)
            </h2>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={campaignMetrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                  <XAxis dataKey="date" stroke="#a1a1aa" />
                  <YAxis yAxisId="left" stroke="#3b82f6" />
                  <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }} />
                  <Line yAxisId="left" type="monotone" dataKey="total_spend" stroke="#3b82f6" strokeWidth={2} name="Ad Spend ($)" />
                  <Line yAxisId="right" type="monotone" dataKey="total_revenue" stroke="#10b981" strokeWidth={2} name="Revenue ($)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-lg flex flex-col">
          <h2 className="text-xl font-semibold mb-4">Live Agent Logs</h2>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 max-h-[350px]">
            {agentLogs.map((log) => (
              <div key={log.id} className="p-4 rounded-lg bg-zinc-950 border border-zinc-800/50 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                    {log.agentName}
                  </span>
                  {log.status === 'success' ? (
                    <CheckCircle2 size={14} className="text-emerald-500" />
                  ) : (
                    <AlertCircle size={14} className="text-amber-500" />
                  )}
                </div>
                <p className="text-sm text-zinc-300">{log.message}</p>
                <span className="text-xs text-zinc-600">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
