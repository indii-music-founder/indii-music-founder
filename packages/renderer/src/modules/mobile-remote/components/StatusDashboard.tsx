/**
 * StatusDashboard — At-a-glance system status for the phone control interface.
 * Shows current module, connection state, active agent, running processes, and quick stats.
 */

import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import { Wifi, WifiOff, Cpu, Activity, Layers, Clock, Zap, type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StatusDashboardProps {
    connectionStatus: 'idle' | 'pairing' | 'connected' | 'error';
    isPaired: boolean;
}

function StatusCard({ icon: Icon, label, value, accent = false, delay = 0 }: {
    icon: LucideIcon;
    label: string;
    value: string;
    accent?: boolean;
    delay?: number;
}) {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.4 }}
            className="group relative overflow-hidden flex flex-col gap-3 p-4 rounded-[24px] bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-300"
        >
            {/* Background Accent Gradient */}
            <div className={cn(
                "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none",
                accent ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "bg-white"
            )} />

            <div className="flex items-center justify-between">
                <div className={cn(
                    "w-10 h-10 rounded-[14px] flex items-center justify-center transition-all duration-300",
                    accent 
                        ? "bg-blue-500/10 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)] group-hover:scale-110" 
                        : "bg-white/5 text-[#8e8e93] group-hover:text-white"
                )}>
                    <Icon className="w-5 h-5" />
                </div>
                
                {accent && (
                    <div className="flex gap-1">
                        <span className="w-1 h-1 rounded-full bg-blue-500/40 animate-pulse" />
                        <span className="w-1 h-1 rounded-full bg-blue-500/20 animate-pulse delay-75" />
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#8e8e93] font-bold mb-1">{label}</p>
                <p className={cn(
                    "text-base font-bold truncate tracking-tight",
                    accent ? "text-white" : "text-[#d1d1d6]"
                )}>{value}</p>
            </div>
        </motion.div>
    );
}

export default function StatusDashboard({ connectionStatus, isPaired }: StatusDashboardProps) {
    const { currentModule, activeSessionId, agentHistory, isOffline } = useStore(
        useShallow(state => ({
            currentModule: state.currentModule,
            activeSessionId: state.activeSessionId,
            agentHistory: state.agentHistory,
            isOffline: state.isOffline,
        }))
    );

    const formatModuleName = (id: string) => {
        return id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    return (
        <div className="space-y-4">
            {/* Connection Banner */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                    "flex items-center gap-3 px-4 py-3.5 rounded-[20px] text-xs font-bold uppercase tracking-widest",
                    isPaired
                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : connectionStatus === 'error'
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "bg-white/[0.03] text-[#8e8e93] border border-white/5"
                )}
            >
                {isPaired ? (
                    <>
                        <div className="relative">
                            <Wifi className="w-4 h-4" />
                            <motion.div 
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1.5, opacity: 0 }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="absolute inset-0 bg-green-400 rounded-full"
                            />
                        </div>
                        <span>System Sync Active</span>
                    </>
                ) : isOffline ? (
                    <><WifiOff className="w-4 h-4 opacity-50" /> No Studio Connection</>
                ) : (
                    <><Activity className="w-4 h-4 opacity-50" /> Awaiting Handshake</>
                )}
            </motion.div>

            {/* Status Grid */}
            <div className="grid grid-cols-2 gap-3">
                <StatusCard
                    icon={Layers}
                    label="Workspace"
                    value={formatModuleName(currentModule ?? 'dashboard')}
                    accent
                    delay={0.1}
                />
                <StatusCard
                    icon={Cpu}
                    label="Session ID"
                    value={activeSessionId ? activeSessionId.slice(0, 8).toUpperCase() : 'Inactive'}
                    delay={0.2}
                />
                <StatusCard
                    icon={Zap}
                    label="Queue"
                    value={`${agentHistory?.length ?? 0} Messages`}
                    delay={0.3}
                />
                <StatusCard
                    icon={Clock}
                    label="Relay Mode"
                    value={isPaired ? 'Real-time' : 'Polling'}
                    delay={0.4}
                />
            </div>

            {/* System Info Banner */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="px-4 py-4 rounded-[24px] bg-gradient-to-br from-white/[0.03] to-transparent border border-white/5"
            >
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#636366]">Telemetry</h4>
                    <div className="flex gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse delay-150" />
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: isPaired ? '100%' : '30%' }}
                            transition={{ duration: 1.5, ease: "circOut" }}
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                        />
                    </div>
                    <span className="text-[11px] font-mono font-bold text-white/40">
                        {isPaired ? '1.5ms' : '---'}
                    </span>
                </div>
            </motion.div>
        </div>
    );
}
