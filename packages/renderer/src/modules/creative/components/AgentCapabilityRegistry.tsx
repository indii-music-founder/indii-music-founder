import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cpu, CheckCircle2, ChevronRight, Terminal, Zap, ShieldCheck, Activity } from 'lucide-react';
import { agentCapabilityService, CapabilityRegistry } from '@/services/agent/AgentCapabilityService';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

interface AgentCapabilityRegistryProps {
  onClose: () => void;
}

export default function AgentCapabilityRegistry({ onClose }: AgentCapabilityRegistryProps) {
  const [registry, setRegistry] = useState<CapabilityRegistry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRegistry = async () => {
      const data = await agentCapabilityService.getRegistry();
      setRegistry(data);
      setLoading(false);
    };
    fetchRegistry();
  }, []);

  const [currentTime] = useState(() => Date.now());

  const lastUpdated = React.useMemo(() => 
    new Date(registry?.last_updated || currentTime).toLocaleTimeString(), 
    [registry?.last_updated, currentTime]
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed inset-y-0 right-0 w-[400px] bg-[#0c0c0e]/95 backdrop-blur-2xl border-l border-white/10 z-[100] shadow-2xl flex flex-col"
    >
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
            <Cpu size={18} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Swarm Capability Registry</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">A2A Autonomous Network</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Activity className="text-indigo-500 animate-pulse" size={32} />
            <p className="text-xs text-gray-500 font-mono">SCANNING SWarm NODES...</p>
          </div>
        ) : !registry ? (
          <div className="p-8 text-center border border-dashed border-white/10 rounded-xl bg-white/2">
            <ShieldCheck size={32} className="mx-auto text-red-400/50 mb-3" />
            <p className="text-sm text-gray-400">Registry not found or inaccessible.</p>
            <p className="text-xs text-gray-600 mt-1">Run `audit_skill` to generate registry.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-mono text-gray-500 uppercase">Active Nodes: {Object.keys(registry.agents).length}</span>
              <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-tighter flex items-center gap-1">
                <CheckCircle2 size={10} /> Verified
              </span>
            </div>

            {Object.entries(registry.agents).map(([id, data]) => (
              <Card key={id} className="bg-white/3 border-white/6 hover:bg-white/5 transition-all group overflow-hidden">
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-bold text-gray-200 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      {id.charAt(0).toUpperCase() + id.slice(1)} Agent
                    </CardTitle>
                    <Badge variant="outline" className="text-[8px] bg-white/2 border-white/10 text-gray-400 uppercase tracking-tighter">
                      Technical Specialist
                    </Badge>
                  </div>
                  <CardDescription className="text-[10px] text-gray-500 mt-1 line-clamp-2">
                    {data.instructions_preview.slice(0, 100)}...
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="mt-2 space-y-2">
                    {Object.entries(data.skills).map(([skillId, capability]) => (
                      <div key={skillId} className="bg-black/20 rounded-lg p-2 border border-white/4 group-hover:border-white/10 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Terminal size={10} className="text-indigo-400" />
                              <span className="text-[10px] font-mono text-gray-300 font-bold uppercase tracking-tight">{skillId}</span>
                            </div>
                            <p className="text-[10px] text-gray-400 leading-relaxed italic">
                              "{capability.description}"
                            </p>
                          </div>
                          <Zap size={12} className="text-amber-500 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {capability.trigger_labels.map(label => (
                            <span key={label} className="px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[8px] text-indigo-300 font-medium">
                              #{label}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t border-white/10 bg-black/40">
        <div className="flex items-center justify-between text-[9px] font-mono text-gray-500 uppercase">
          <span>Registry Latency: 12ms</span>
          <span>Last Updated: {lastUpdated}</span>
        </div>
      </div>
    </motion.div>
  );
}
