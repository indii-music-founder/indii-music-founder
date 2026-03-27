import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Activity, Clock, CheckCircle2, XCircle, Pause,
    RefreshCw, Zap, Radio,
} from 'lucide-react';
import { SchedulerClientService } from '@/services/scheduler/SchedulerClientService';
import type { ScheduledTask, SchedulerStatus, SchedulerTickEvent } from '@/services/scheduler/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

/* =========================================================
 *  SchedulerStatusPanel
 *
 *  Displays the indiiOS built-in task scheduler status in
 *  real-time inside the Observability Dashboard.
 *
 *  - Lists all registered tasks with next-run countdown
 *  - Shows live Neural Sync pulse (every 30s)
 *  - Displays recent tick history (last 10 fires)
 *  - Connects via SchedulerClientService (graceful no-op in web)
 * ======================================================== */

interface TickHistoryEntry extends SchedulerTickEvent {
    receivedAt: string;
}

const MAX_HISTORY = 10;

function formatCountdown(nextRunAt?: string): string {
    if (!nextRunAt) return '—';
    const ms = new Date(nextRunAt).getTime() - Date.now();
    if (ms <= 0) return 'due now';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${s % 60}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Sub-components ──────────────────────────────────────────────────────────

function NeuralSyncPulse({ lastPulse }: { lastPulse: string | null }) {
    // We drive the animation purely via a remounting key derived from lastPulse.
    // AnimatePresence replays the `initial → animate` motion whenever the key changes.
    const pulseKey = lastPulse ?? 'none';

    return (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <div className="relative flex items-center justify-center w-8 h-8">
                <Radio size={16} className="text-emerald-400 relative z-10" />
                <AnimatePresence mode="wait">
                    {lastPulse && (
                        <motion.div
                            key={pulseKey}
                            className="absolute inset-0 rounded-full bg-emerald-500/30"
                            initial={{ scale: 0.8, opacity: 0.8 }}
                            animate={{ scale: 2.4, opacity: 0 }}
                            transition={{ duration: 1.1, ease: 'easeOut' }}
                        />
                    )}
                </AnimatePresence>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-emerald-300 uppercase tracking-widest">
                    Neural Sync
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                    {lastPulse ? `Last pulse: ${formatTime(lastPulse)}` : 'Waiting for first pulse…'}
                </p>
            </div>
            <div
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${lastPulse ? 'bg-emerald-400' : 'bg-emerald-600/40'
                    }`}
            />
        </div>
    );
}

function TaskRow({ task }: { task: ScheduledTask }) {
    const [countdown, setCountdown] = useState(() => formatCountdown(task.nextRunAt));

    useEffect(() => {
        const interval = setInterval(() => {
            setCountdown(formatCountdown(task.nextRunAt));
        }, 1000);
        return () => clearInterval(interval);
    }, [task.nextRunAt]);

    return (
        <div className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-white/3 transition-colors group">
            <div className="flex-shrink-0">
                {task.enabled ? (
                    <CheckCircle2 size={13} className="text-emerald-400" />
                ) : (
                    <Pause size={13} className="text-slate-500" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-foreground truncate">{task.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{task.action}</p>
            </div>
            <div className="flex-shrink-0 text-right space-y-0.5">
                <div className="flex items-center gap-1 justify-end">
                    <Clock size={9} className="text-muted-foreground" />
                    <span className="text-[10px] font-mono text-muted-foreground">{countdown}</span>
                </div>
                <p className="text-[9px] text-slate-600">{task.runCount}× fired</p>
            </div>
        </div>
    );
}

function TickHistoryRow({ entry }: { entry: TickHistoryEntry }) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-2 py-1.5 px-2 rounded text-[11px]"
        >
            {entry.result === 'success' ? (
                <CheckCircle2 size={11} className="text-emerald-400 flex-shrink-0" />
            ) : (
                <XCircle size={11} className="text-red-400 flex-shrink-0" />
            )}
            <span className="flex-1 min-w-0 text-muted-foreground truncate">{entry.taskName}</span>
            <span className="font-mono text-slate-500 flex-shrink-0">{formatTime(entry.firedAt)}</span>
        </motion.div>
    );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function SchedulerStatusPanel() {
    const [status, setStatus] = useState<SchedulerStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastNeuralSync, setLastNeuralSync] = useState<string | null>(null);
    const [tickHistory, setTickHistory] = useState<TickHistoryEntry[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const available = SchedulerClientService.isAvailable;

    const loadStatus = useCallback(async () => {
        if (!available) {
            setLoading(false);
            return;
        }
        try {
            const s = await SchedulerClientService.status();
            setStatus(s);
        } catch {
            // Gracefully degrade
        } finally {
            setLoading(false);
        }
    }, [available]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadStatus();
        setTimeout(() => setRefreshing(false), 500);
    }, [loadStatus]);

    // Initial load + 30s auto-refresh
    useEffect(() => {
        void loadStatus();
        refreshTimerRef.current = setInterval(() => void loadStatus(), 30_000);
        return () => {
            if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
        };
    }, [loadStatus]);

    // Subscribe to Neural Sync pulses
    useEffect(() => {
        return SchedulerClientService.onNeuralSync(({ firedAt }) => {
            setLastNeuralSync(firedAt);
            // Also refresh task list so nextRunAt updates
            void loadStatus();
        });
    }, [loadStatus]);

    // Subscribe to all tick events — build tick history
    useEffect(() => {
        return SchedulerClientService.onTick((event) => {
            setTickHistory(prev => [
                { ...event, receivedAt: new Date().toISOString() },
                ...prev,
            ].slice(0, MAX_HISTORY));
        });
    }, []);

    // ── Render: not in Electron ─────────────────────────────────────────────

    if (!available) {
        return (
            <Card className="bg-gradient-to-br from-slate-500/10 to-slate-900/5 border-slate-500/20">
                <CardContent className="p-6 text-center text-muted-foreground text-sm">
                    <Activity size={24} className="mx-auto mb-2 opacity-40" />
                    Scheduler only available in Electron context
                </CardContent>
            </Card>
        );
    }

    // ── Render: loading ─────────────────────────────────────────────────────

    if (loading) {
        return (
            <Card className="bg-gradient-to-br from-purple-500/10 to-slate-900/5 border-purple-500/20">
                <CardContent className="p-6 flex items-center justify-center gap-2 text-muted-foreground text-sm">
                    <RefreshCw size={14} className="animate-spin" />
                    Loading scheduler…
                </CardContent>
            </Card>
        );
    }

    const tasks = status?.tasks ?? [];
    const activeTasks = tasks.filter(t => t.enabled);

    // ── Render: full panel ──────────────────────────────────────────────────

    return (
        <Card className="bg-gradient-to-br from-purple-500/10 to-slate-900/5 border-purple-500/20">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-purple-300">
                        <Zap size={14} />
                        Task Scheduler
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-300">
                            {activeTasks.length} / {tasks.length} active
                        </Badge>
                        <button
                            onClick={handleRefresh}
                            className="p-1 rounded hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground"
                            title="Refresh"
                        >
                            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-0">
                {/* Neural Sync Pulse */}
                <NeuralSyncPulse lastPulse={lastNeuralSync} />

                {/* Summary row */}
                <div className="grid grid-cols-3 gap-2">
                    {[
                        { label: 'Active', value: activeTasks.length.toString(), color: 'text-emerald-400' },
                        { label: 'Total', value: tasks.length.toString(), color: 'text-slate-300' },
                        { label: 'Fired', value: (status?.totalFireCount ?? 0).toString(), color: 'text-purple-400' },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="text-center p-2 rounded-md bg-white/3">
                            <p className={`text-lg font-bold ${color}`}>{value}</p>
                            <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
                        </div>
                    ))}
                </div>

                {/* Task list */}
                {tasks.length > 0 && (
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 px-1">
                            Registered Tasks
                        </p>
                        <ScrollArea className="h-[160px]">
                            <div className="space-y-0.5">
                                {tasks
                                    .slice()
                                    .sort((a, b) => (a.enabled === b.enabled ? 0 : a.enabled ? -1 : 1))
                                    .map(task => (
                                        <TaskRow key={task.id} task={task} />
                                    ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {/* Tick history */}
                {tickHistory.length > 0 && (
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 px-1">
                            Recent Firings
                        </p>
                        <div className="space-y-0 bg-black/15 rounded-md px-1 py-1">
                            <AnimatePresence>
                                {tickHistory.map(entry => (
                                    <TickHistoryRow key={`${entry.taskId}-${entry.firedAt}`} entry={entry} />
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                )}

                {tickHistory.length === 0 && !loading && (
                    <p className="text-[11px] text-center text-muted-foreground py-2">
                        No task firings yet — waiting for first tick…
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
