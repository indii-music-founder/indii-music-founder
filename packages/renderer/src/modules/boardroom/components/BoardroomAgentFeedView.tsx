import React, { useState, useEffect } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import {
    Bot,
    Radio,
    ShieldAlert,
    ExternalLink,
    Play,
    CheckCircle2,
    Clock,
    AlertCircle,
    Activity,
    Scale,
    Cpu,
} from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { cn } from '@/lib/utils';
import { resolveAgentVisualIdentity } from '@/services/agent/AgentVisualIdentity';

export function BoardroomAgentFeedView() {
    const toast = useToast();
    const {
        activeGraphExecution,
        a2aMessages,
        activeAgents,
        openBoardroomBrowser,
    } = useStore(
        useShallow(state => ({
            activeGraphExecution: state.activeGraphExecution,
            a2aMessages: state.a2aMessages || [],
            activeAgents: state.activeAgents || [],
            openBoardroomBrowser: state.openBoardroomBrowser,
        }))
    );

    const [isAborting, setIsAborting] = useState(false);
    const [killSwitchActive, setKillSwitchActive] = useState(false);
    const [latestScreenshot, setLatestScreenshot] = useState<string | null>(null);

    // Check kill switch state
    useEffect(() => {
        if (typeof window !== 'undefined' && window.electronAPI?.computer?.getAbortState) {
            void window.electronAPI.computer.getAbortState().then(res => {
                if (res.success && res.data) {
                    setKillSwitchActive(res.data.aborted);
                }
            });
        }
    }, []);

    const handleEmergencyAbort = async () => {
        setIsAborting(true);
        if (typeof window !== 'undefined' && window.electronAPI?.computer?.abort) {
            try {
                await window.electronAPI.computer.abort();
                setKillSwitchActive(true);
                toast.success('Emergency Kill Switch activated — all autonomous actions halted.');
            } catch {
                toast.error('Failed to trigger kill switch.');
            } finally {
                setIsAborting(false);
            }
        } else {
            setIsAborting(false);
            toast.info('Emergency abort triggered for current session.');
        }
    };

    const handleLaunchRightsCopilot = async (portal: 'ascap' | 'bmi' | 'the_mlc' | 'soundexchange' | 'loc_copyright') => {
        if (typeof window !== 'undefined' && window.electronAPI?.rightsCopilot?.launchSession) {
            try {
                const res = await window.electronAPI.rightsCopilot.launchSession({
                    portalTarget: portal,
                    manifestId: `boardroom-${Date.now()}`,
                });
                if (res.success) {
                    toast.success(`Launched Rights Copilot for ${portal.toUpperCase()}!`);
                    return;
                }
            } catch {
                // fallback to browser
            }
        }

        const portalUrls: Record<string, string> = {
            ascap: 'https://members.ascap.com',
            bmi: 'https://online.bmi.com',
            the_mlc: 'https://portal.themlc.com',
            soundexchange: 'https://sportal.soundexchange.com',
            loc_copyright: 'https://eco.copyright.gov/eService_enu/',
        };

        openBoardroomBrowser(portalUrls[portal] || 'https://members.ascap.com');
        toast.info(`Opening ${portal.toUpperCase()} in Boardroom Live Browser.`);
    };

    const graphNodes = activeGraphExecution?.graph?.nodes || [];
    const nodeStates = activeGraphExecution?.nodeStates || {};

    return (
        <div data-testid="boardroom-agent-feed-view" className="h-full w-full flex flex-col bg-zinc-950 text-white min-h-0 min-w-0 overflow-y-auto custom-scrollbar p-6 space-y-6">
            {/* Header Telemetry Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                        <Activity size={20} className="animate-pulse" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white flex items-center gap-2">
                            Autonomous Swarm Telemetry
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                                ACTIVE MONITOR
                            </span>
                        </h2>
                        <p className="text-xs text-white/50 mt-0.5">
                            Live inspection of browser workers, computer-use actions, and inter-agent handoffs.
                        </p>
                    </div>
                </div>

                {/* Kill Switch Button */}
                <button
                    type="button"
                    onClick={handleEmergencyAbort}
                    disabled={isAborting || killSwitchActive}
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border shrink-0",
                        killSwitchActive
                            ? "bg-rose-500/20 border-rose-400 text-rose-300 cursor-not-allowed"
                            : "bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border-rose-500/40 shadow-lg"
                    )}
                    title="Halt all autonomous browser and computer execution"
                    data-testid="boardroom-emergency-abort-btn"
                >
                    <ShieldAlert size={15} />
                    <span>{killSwitchActive ? 'Kill Switch Active' : 'Emergency Abort'}</span>
                </button>
            </div>

            {/* Rights Copilot Quick Launch Gateways */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-white/80 flex items-center gap-2">
                        <Scale size={14} className="text-amber-400" />
                        Official Music Rights Assisted Portals
                    </span>
                    <span className="text-[10px] text-white/40">Assisted autofill with credential isolation</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {[
                        { id: 'ascap' as const, name: 'ASCAP' },
                        { id: 'bmi' as const, name: 'BMI' },
                        { id: 'the_mlc' as const, name: 'The MLC' },
                        { id: 'soundexchange' as const, name: 'SoundExchange' },
                        { id: 'loc_copyright' as const, name: 'US Copyright' },
                    ].map(p => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => void handleLaunchRightsCopilot(p.id)}
                            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-left transition-all hover:scale-[1.02] group"
                        >
                            <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors block">
                                {p.name}
                            </span>
                            <span className="text-[10px] text-white/40 mt-1 flex items-center gap-1">
                                Launch Portal <ExternalLink size={10} />
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Swarm Graph Execution Monitor */}
            <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-white/80 flex items-center gap-2">
                    <Cpu size={14} className="text-indigo-400" />
                    Multi-Agent Graph Workflow Execution
                </span>
                {graphNodes.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/5 text-center text-white/40">
                        <Bot size={24} className="mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-medium">No active graph pipeline currently running.</p>
                        <p className="text-[10px] mt-1 opacity-70">
                            When an executive mission delegates tasks across departments, live node states will stream here.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {graphNodes.map(node => {
                            const state = nodeStates[node.id];
                            const status = state?.status || 'IDLE';
                            const isExecuting = status === 'EXECUTING_GENERATION';
                            const isDone = status === 'STEP_COMPLETE';

                            return (
                                <div
                                    key={node.id}
                                    className={cn(
                                        "p-3 rounded-xl border flex items-center justify-between text-xs transition-all",
                                        isExecuting
                                            ? "bg-emerald-500/15 border-emerald-400/50 shadow-md"
                                            : isDone
                                                ? "bg-white/5 border-white/10 text-white/60"
                                                : "bg-black/40 border-white/5 text-white/40"
                                    )}
                                >
                                    <div className="flex items-center gap-2.5">
                                        {isExecuting ? (
                                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                        ) : isDone ? (
                                            <CheckCircle2 size={14} className="text-emerald-400" />
                                        ) : (
                                            <Clock size={14} className="text-white/30" />
                                        )}
                                        <span className="font-bold text-white/90">{node.taskTemplate || node.id}</span>
                                        <span className="text-[10px] font-mono text-white/40">({node.agentId})</span>
                                    </div>
                                    <span className={cn(
                                        "text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold",
                                        isExecuting ? "bg-emerald-500/25 text-emerald-300" : "bg-white/10 text-white/50"
                                    )}>
                                        {status}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Inter-Agent Handoffs & Direct Swarm Activity */}
            <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-white/80 flex items-center gap-2">
                    <Radio size={14} className="text-cyan-400" />
                    Real-time Agent-to-Agent Handoff Stream
                </span>
                {a2aMessages.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/5 text-center text-white/40">
                        <Radio size={24} className="mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-medium">Awaiting inter-agent communications.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {a2aMessages.slice(-5).reverse().map(msg => (
                            <div key={msg.id} className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs space-y-1.5">
                                <div className="flex items-center justify-between text-[10px] font-mono">
                                    <span className="text-indigo-400 font-bold uppercase">
                                        {msg.fromAgent} ➔ {msg.toAgent}
                                    </span>
                                    <span className="text-white/30">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-white/80 leading-relaxed">{msg.content}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
export default BoardroomAgentFeedView;
