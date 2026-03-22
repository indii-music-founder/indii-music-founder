/**
 * StatusDashboard — At-a-glance system status for the phone control interface.
 * Shows current module, connection state, active agent, running processes, and quick stats.
 */

import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import { Wifi, WifiOff, Cpu, Activity, Layers, Clock, Zap } from 'lucide-react';

interface StatusDashboardProps {
    connectionStatus: 'idle' | 'pairing' | 'connected' | 'error';
    isPaired: boolean;
}

function StatusCard({ icon: Icon, label, value, accent = false }: {
    icon: React.ElementType;
    label: string;
    value: string;
    accent?: boolean;
}) {
    return (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#161b22]/60 border border-[#30363d]/40">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent ? 'bg-blue-600/20 text-blue-400' : 'bg-[#21262d] text-[#8b949e]'
                }`}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-[#6e7681] font-medium">{label}</p>
                <p className={`text-sm font-semibold truncate ${accent ? 'text-blue-400' : 'text-white'}`}>{value}</p>
            </div>
        </div>
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
        <div className="space-y-2">
            {/* Connection Banner */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${isPaired
                    ? 'bg-green-900/20 text-green-400 border border-green-700/30'
                    : connectionStatus === 'error'
                        ? 'bg-red-900/20 text-red-400 border border-red-700/30'
                        : 'bg-[#161b22] text-[#6e7681] border border-[#30363d]/40'
                }`}>
                {isPaired ? (
                    <><Wifi className="w-3.5 h-3.5" /> Paired — Real-time sync active</>
                ) : isOffline ? (
                    <><WifiOff className="w-3.5 h-3.5" /> Offline — No connection</>
                ) : (
                    <><Activity className="w-3.5 h-3.5" /> Ready to pair</>
                )}
            </div>

            {/* Status Grid */}
            <div className="grid grid-cols-2 gap-2">
                <StatusCard
                    icon={Layers}
                    label="Active Module"
                    value={formatModuleName(currentModule ?? 'dashboard')}
                    accent
                />
                <StatusCard
                    icon={Cpu}
                    label="Agent Session"
                    value={activeSessionId ? activeSessionId.slice(0, 8) + '…' : 'None'}
                />
                <StatusCard
                    icon={Zap}
                    label="Messages"
                    value={String(agentHistory?.length ?? 0)}
                />
                <StatusCard
                    icon={Clock}
                    label="Status"
                    value={isPaired ? 'Connected' : 'Standby'}
                />
            </div>
        </div>
    );
}
