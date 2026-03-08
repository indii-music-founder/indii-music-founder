import React, { useState } from 'react';
import { Activity, BarChart2, Heart, Shield } from 'lucide-react';
import { TraceViewer } from '@/components/studio/observability/TraceViewer';
import { MetricsDashboard } from './components/MetricsDashboard';
import { HealthPanel } from './components/HealthPanel';
import { CircuitBreakerPanel } from './components/CircuitBreakerPanel';

type ObsTab = 'traces' | 'metrics' | 'health' | 'breaker';

const TABS: Array<{ id: ObsTab; label: string; icon: React.FC<{ size?: number; className?: string }> }> = [
    { id: 'traces', label: 'Traces', icon: Activity },
    { id: 'metrics', label: 'Metrics', icon: BarChart2 },
    { id: 'health', label: 'Health', icon: Heart },
    { id: 'breaker', label: 'Circuit Breaker', icon: Shield },
];

export default function ObservabilityDashboard() {
    const [activeTab, setActiveTab] = useState<ObsTab>('traces');

    return (
        <div className="flex flex-col h-full w-full bg-background text-white overflow-hidden">
            {/* Tab bar */}
            <div className="flex items-center gap-1 px-4 pt-4 pb-0 border-b border-slate-800 shrink-0">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                            activeTab === id
                                ? 'border-emerald-500 text-emerald-400'
                                : 'border-transparent text-slate-500 hover:text-white hover:border-slate-600'
                        }`}
                    >
                        <Icon size={15} />
                        {label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'traces' && <TraceViewer />}
                {activeTab === 'metrics' && <MetricsDashboard />}
                {activeTab === 'health' && <HealthPanel />}
                {activeTab === 'breaker' && <CircuitBreakerPanel />}
            </div>
        </div>
    );
}
