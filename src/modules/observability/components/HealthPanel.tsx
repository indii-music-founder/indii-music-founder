import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { db } from '@/services/firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { wcpInstance } from '@/services/agent/WebSocketControlPlane';

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

function checkWCP(): ServiceHealth {
    const state = wcpInstance.connectionState;
    if (state === 'connected') return { name: 'Control Plane (WCP)', status: 'healthy' };
    if (state === 'connecting') return { name: 'Control Plane (WCP)', status: 'degraded', error: 'Connecting…' };
    return {
        name: 'Control Plane (WCP)',
        status: 'down',
        error: 'Disconnected — mobile remote and real-time session sync unavailable',
    };
}

async function checkGeminiAPI(): Promise<ServiceHealth> {
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
        { name: 'Control Plane (WCP)', status: 'checking' },
        { name: 'Gemini API', status: 'checking' },
    ]);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);

    const runChecks = useCallback(async () => {
        setServices(prev => prev.map(s => ({ ...s, status: 'checking' as HealthStatus })));

        const [firestore, gemini] = await Promise.all([
            checkFirestore(),
            checkGeminiAPI(),
        ]);
        const wcp = checkWCP();

        setServices([firestore, wcp, gemini]);
        setLastChecked(new Date());
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [firestore, gemini] = await Promise.all([
                checkFirestore(),
                checkGeminiAPI(),
            ]);
            const wcp = checkWCP();
            if (!cancelled) {
                setServices([firestore, wcp, gemini]);
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
        <div className="space-y-4">
            {/* Overall Status */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                overallStatus === 'healthy' ? 'border-emerald-800/50 bg-emerald-950/30' :
                overallStatus === 'degraded' ? 'border-yellow-800/50 bg-yellow-950/30' :
                'border-red-800/50 bg-red-950/30'
            }`}>
                <OverallIcon size={16} className={STATUS_CONFIG[overallStatus].color} />
                <span className={`text-sm font-medium ${STATUS_CONFIG[overallStatus].color}`}>
                    System {STATUS_CONFIG[overallStatus].label}
                </span>
            </div>

            {/* Per-service rows */}
            {services.map(svc => {
                const Cfg = STATUS_CONFIG[svc.status];
                const Icon = Cfg.icon;
                return (
                    <div key={svc.name} className="flex items-start justify-between gap-3 py-1">
                        <div className="flex items-center gap-2 min-w-0">
                            <Icon size={14} className={`${Cfg.color} shrink-0 ${svc.status === 'checking' ? 'animate-spin' : ''}`} />
                            <span className="text-sm text-white truncate">{svc.name}</span>
                        </div>
                        <div className="flex flex-col items-end text-right shrink-0">
                            <span className={`text-xs font-medium ${Cfg.color}`}>{Cfg.label}</span>
                            {svc.latencyMs !== undefined && (
                                <span className="text-xs text-slate-500">{svc.latencyMs}ms</span>
                            )}
                            {svc.error && (
                                <span className="text-xs text-slate-500 max-w-[160px] text-right">{svc.error}</span>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* Refresh */}
            <button
                onClick={runChecks}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mt-2"
            >
                <RefreshCw size={12} />
                {lastChecked ? `Last checked ${lastChecked.toLocaleTimeString()}` : 'Refresh'}
            </button>
        </div>
    );
};
