import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { db } from '@/services/firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';

type HealthStatus = 'checking' | 'healthy' | 'degraded' | 'down';

interface ServiceHealth {
    name: string;
    status: HealthStatus;
    latencyMs?: number;
    error?: string;
}

const STATUS_CONFIG: Record<HealthStatus, {
    icon: React.FC<{ size?: string | number; className?: string }>;
    color: string;
    label: string;
}> = {
    checking: { icon: Loader2, color: 'text-slate-400', label: 'Checking…' },
    healthy: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Healthy' },
    degraded: { icon: AlertCircle, color: 'text-yellow-400', label: 'Degraded' },
    down: { icon: XCircle, color: 'text-red-400', label: 'Down' },
};

async function checkFirestore(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
        const q = query(collection(db, '_health_check'), limit(1));
        await getDocs(q);
        return { name: 'Firestore', status: 'healthy', latencyMs: Date.now() - start };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { name: 'Firestore', status: 'down', error: msg };
    }
}

const AGENT_ZERO_URL = (import.meta.env.VITE_AGENT_ZERO_URL as string | undefined) ?? 'http://localhost:50080';

async function checkAgentZero(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch(`${AGENT_ZERO_URL}/ping`, { signal: ctrl.signal });
        clearTimeout(timeout);
        return {
            name: 'Agent Zero Sidecar',
            status: res.ok ? 'healthy' : 'degraded',
            latencyMs: Date.now() - start,
        };
    } catch {
        return {
            name: 'Agent Zero Sidecar',
            status: 'down',
            error: 'Not reachable — sidecar may not be running',
        };
    }
}

async function checkGeminiAPI(): Promise<ServiceHealth> {
    // Check if the API key env var is configured — we don't make a real call to avoid costs
    const hasKey = !!(import.meta.env.VITE_API_KEY || import.meta.env.VITE_GEMINI_API_KEY);
    return {
        name: 'Gemini API',
        status: hasKey ? 'healthy' : 'degraded',
        error: hasKey ? undefined : 'VITE_API_KEY not configured',
    };
}

export const HealthPanel: React.FC = () => {
    const [services, setServices] = useState<ServiceHealth[]>([
        { name: 'Firestore', status: 'checking' },
        { name: 'Agent Zero Sidecar', status: 'checking' },
        { name: 'Gemini API', status: 'checking' },
    ]);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);

    const runChecks = useCallback(async () => {
        setServices(prev => prev.map(s => ({ ...s, status: 'checking' as HealthStatus })));

        const [firestore, agentZero, gemini] = await Promise.all([
            checkFirestore(),
            checkAgentZero(),
            checkGeminiAPI(),
        ]);

        setServices([firestore, agentZero, gemini]);
        setLastChecked(new Date());
    }, []);

    // Initial check + auto-refresh every 30s
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [firestore, agentZero, gemini] = await Promise.all([
                checkFirestore(),
                checkAgentZero(),
                checkGeminiAPI(),
            ]);
            if (!cancelled) {
                setServices([firestore, agentZero, gemini]);
                setLastChecked(new Date());
            }
        })();
        const interval = setInterval(runChecks, 30_000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [runChecks]);

    const overallStatus: HealthStatus = services.some(s => s.status === 'down')
        ? 'down'
        : services.some(s => s.status === 'degraded' || s.status === 'checking')
            ? 'degraded'
            : 'healthy';

    const OverallIcon = STATUS_CONFIG[overallStatus].icon;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar px-6 py-5 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-white">System Health</h2>
                    <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${overallStatus === 'healthy'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : overallStatus === 'degraded'
                            ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                        <OverallIcon size={11} className={services.some(s => s.status === 'checking') ? 'animate-spin' : ''} />
                        {overallStatus === 'healthy' ? 'All Systems Operational' : overallStatus === 'degraded' ? 'Partial Degradation' : 'System Issue'}
                    </span>
                </div>
                <button
                    onClick={runChecks}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
                >
                    <RefreshCw size={13} />
                    Refresh
                </button>
            </div>

            {/* Service cards */}
            <div className="space-y-3">
                {services.map(service => {
                    const config = STATUS_CONFIG[service.status];
                    const StatusIcon = config.icon;

                    return (
                        <div
                            key={service.name}
                            className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3"
                        >
                            <div className="flex items-center gap-3">
                                <StatusIcon
                                    size={18}
                                    className={`${config.color} ${service.status === 'checking' ? 'animate-spin' : ''}`}
                                />
                                <div>
                                    <p className="text-sm font-medium text-white">{service.name}</p>
                                    {service.error && (
                                        <p className="text-xs text-slate-500 mt-0.5">{service.error}</p>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <p className={`text-sm font-medium ${config.color}`}>{config.label}</p>
                                {service.latencyMs !== undefined && (
                                    <p className="text-xs text-slate-600 mt-0.5">{service.latencyMs}ms</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {lastChecked && (
                <p className="text-xs text-slate-600 text-right">
                    Last checked: {lastChecked.toLocaleTimeString()} · Auto-refreshes every 30s
                </p>
            )}
        </div>
    );
};
