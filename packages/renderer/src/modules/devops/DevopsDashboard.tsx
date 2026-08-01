import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ThreePanelDashboard } from '@/components/layout/ThreePanelDashboard';
import {
    Activity,
    Code,
    Cpu,
    Database,
    FileText,
    HardDrive,
    Key,
    Shield,
    ShieldAlert,
    Sliders,
    Terminal,
} from 'lucide-react';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import { getColorForModule } from '@/core/theme/moduleColors';

type Tab = 'cicd' | 'observability' | 'credentials' | 'testing';

const LIVE_STATUS_MESSAGE = 'Live DevOps integrations are not configured in this build. This dashboard is read-only until real CI, telemetry, and test runners are wired up.';

const PIPELINE_STEPS = [
    'Lint & Typecheck',
    'Unit Tests (Vitest)',
    'E2E Tests (Playwright)',
    'Build Production Bundle',
    'Sign & Notarize (macOS / Windows)',
    'Deploy to Firebase Hosting',
];

const METRICS = [
    { label: 'API Call Volume (24h)', value: '--', sub: 'No live telemetry connected' },
    { label: 'System Error Rate', value: '--', sub: 'Connect observability to populate' },
    { label: 'Average Response', value: '--', sub: 'Waiting on Cloud Trace / metrics stream' },
];

const CREDENTIALS = [
    { name: 'CI Provider Token', status: 'Unavailable', desc: 'No deployment backend is configured.' },
    { name: 'Telemetry Export Key', status: 'Unavailable', desc: 'No metrics sink is configured.' },
    { name: 'E2E Runner Access', status: 'Unavailable', desc: 'Use the CLI or CI pipeline for test execution.' },
];

const TEST_COMMANDS = [
    'npm run typecheck',
    'npm test -- --run',
    'npm run test:e2e',
    'npm run build:ci',
];

const STATIC_LOGS = [
    { timestamp: '18:56:50', level: 'info' as const, message: 'DevOps dashboard loaded in read-only mode.' },
    { timestamp: '18:56:51', level: 'warn' as const, message: 'No live CI/CD provider connected.' },
    { timestamp: '18:56:52', level: 'warn' as const, message: 'No telemetry export configured.' },
];

function StatusBadge({ label, tone }: { label: string; tone: 'neutral' | 'warn' | 'ok' }) {
    const classes = tone === 'ok'
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        : tone === 'warn'
            ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
            : 'bg-slate-700/50 text-slate-400 border-white/10';

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-black uppercase tracking-wider ${classes}`}>
            {label}
        </span>
    );
}

export default function DevopsDashboard() {
    const [activeTab, setActiveTab] = useState<Tab>('cicd');
    const moduleColor = getColorForModule('devops');

    return (
        <ThreePanelDashboard
            moduleName="DevOps"
            headerIcon={<Activity size={18} className="text-white" />}
            title="DevOps Command Center"
            subtitle="Read-only status surface until live integrations are connected"
            bgBlobClass={moduleColor.bg}
            iconBgClass={`bg-linear-to-br from-green-500 to-green-400`}
            iconShadowClass="shadow-green-500/20"
            leftPanel={
                <div className="flex flex-col gap-4">
                    <div className="p-4 rounded-xl border border-white/5 bg-white/2 backdrop-blur-md">
                        <div className="flex items-center justify-between mb-3">
                            <span className={`text-[10px] font-black uppercase tracking-wider ${moduleColor.text} font-mono`}>Resource Monitor</span>
                            <StatusBadge label="Offline" tone="warn" />
                        </div>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-[11px] text-gray-400 mb-1 font-mono">
                                    <span className="flex items-center gap-1.5"><Cpu size={12} /> CPU Core</span>
                                    <span>--</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[11px] text-gray-400 mb-1 font-mono">
                                    <span className="flex items-center gap-1.5"><HardDrive size={12} /> Memory VM</span>
                                    <span>--</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[11px] text-gray-400 mb-1 font-mono">
                                    <span className="flex items-center gap-1.5"><Database size={12} /> Db Latency</span>
                                    <span>--</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden" />
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl border border-white/5 bg-white/2 backdrop-blur-md">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${moduleColor.text} font-mono block mb-3`}>Live Actions</span>
                        <div className="space-y-2 text-xs text-slate-400">
                            <div className="p-3 rounded-lg border border-white/5 bg-black/30">
                                {LIVE_STATUS_MESSAGE}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl border border-white/5 bg-white/2 backdrop-blur-md">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${moduleColor.text} font-mono block mb-2`}>Environments</span>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs py-1">
                                <span className="text-gray-400 font-medium">Production (Host)</span>
                                <StatusBadge label="Not connected" tone="neutral" />
                            </div>
                            <div className="flex items-center justify-between text-xs py-1">
                                <span className="text-gray-400 font-medium">Staging (Vite Web)</span>
                                <StatusBadge label="Not connected" tone="neutral" />
                            </div>
                            <div className="flex items-center justify-between text-xs py-1">
                                <span className="text-gray-400 font-medium">Local dev (Studio)</span>
                                <StatusBadge label="Port 4243" tone="ok" />
                            </div>
                        </div>
                    </div>
                </div>
            }
            rightPanel={
                <div className="flex flex-col gap-4 h-full">
                    <div className="flex-1 flex flex-col p-4 rounded-xl border border-white/5 bg-white/2 backdrop-blur-md overflow-hidden">
                        <div className="flex items-center justify-between mb-3 flex-shrink-0">
                            <span className={`text-[10px] font-black uppercase tracking-wider ${moduleColor.text} font-mono flex items-center gap-1.5`}>
                                <Terminal size={12} /> Log Stream
                            </span>
                            <StatusBadge label="Read only" tone="neutral" />
                        </div>

                        <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-2 custom-scrollbar pr-1">
                            {STATIC_LOGS.map((log, idx) => (
                                <div key={idx} className="leading-relaxed border-b border-white/[0.01] pb-1.5">
                                    <span className="text-gray-600 mr-2">[{log.timestamp}]</span>
                                    <span className={`font-bold mr-1.5 ${
                                        log.level === 'warn'
                                            ? 'text-amber-400'
                                            : getColorForModule('devops').text
                                    }`}>{log.level.toUpperCase()}:</span>
                                    <span className="text-gray-300">{log.message}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            }
        >
            <div className="border-b border-white/5 px-6 flex-shrink-0">
                <div className="flex gap-6 h-12">
                    {([
                        { id: 'cicd', label: 'CI/CD Pipelines', icon: Sliders },
                        { id: 'observability', label: 'Observability & Metrics', icon: Activity },
                        { id: 'credentials', label: 'Access Tokens & Keys', icon: Shield },
                        { id: 'testing', label: 'E2E Testing', icon: Code },
                    ] as const).map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`flex items-center gap-2 text-xs font-bold border-b-2 px-1 transition-all ${
                                activeTab === id
                                    ? `${moduleColor.border} text-white font-black`
                                    : 'border-transparent text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            <Icon size={14} className={activeTab === id ? moduleColor.text : ''} />
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <AnimatePresence mode="wait">
                    {activeTab === 'cicd' && (
                        <motion.div
                            key="cicd"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            <div className="p-5 rounded-xl border border-white/5 bg-white/1">
                                <div className="flex items-center justify-between gap-4 mb-4">
                                    <div>
                                        <h3 className="text-base font-black uppercase text-white mb-1">Production Release Runner</h3>
                                        <p className="text-xs text-gray-400 max-w-xl">{LIVE_STATUS_MESSAGE}</p>
                                    </div>
                                    <StatusBadge label="Unavailable" tone="warn" />
                                </div>
                                <div className="space-y-3 max-w-3xl">
                                    {PIPELINE_STEPS.map((step, idx) => (
                                        <div key={step} className="p-3.5 rounded-lg border border-white/5 bg-black/40 flex items-center justify-between">
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className="w-5 h-5 flex items-center justify-center rounded bg-white/5 text-gray-400">
                                                    <span className="text-[10px] font-bold font-mono">{idx + 1}</span>
                                                </div>
                                                <div className="flex-1">
                                                    <span className="text-xs font-bold text-gray-200 block">{step}</span>
                                                </div>
                                            </div>
                                            <StatusBadge label="Unavailable" tone="warn" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'observability' && (
                        <motion.div
                            key="observability"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {METRICS.map(metric => (
                                    <div key={metric.label} className="p-4 rounded-xl border border-white/5 bg-white/1">
                                        <span className={`text-[10px] font-black uppercase tracking-wider ${moduleColor.text} font-mono block mb-1`}>{metric.label}</span>
                                        <div className="text-2xl font-black font-mono text-white">{metric.value}</div>
                                        <span className="text-[10px] text-gray-500 font-mono mt-1 block">{metric.sub}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="p-5 rounded-xl border border-white/5 bg-white/1">
                                <h4 className="text-xs font-black uppercase tracking-wider text-white mb-4">Request Volume & Error Anomalies</h4>
                                <div className="h-48 w-full border border-dashed border-white/10 rounded-lg flex items-center justify-center text-sm text-slate-500">
                                    No live telemetry configured.
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'credentials' && (
                        <motion.div
                            key="credentials"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4"
                        >
                            <div className="p-5 rounded-xl border border-white/5 bg-white/1">
                                <h3 className="text-sm font-black uppercase text-white mb-4 flex items-center gap-2">
                                    <Key size={16} className={moduleColor.text} /> Credential Verification
                                </h3>
                                <div className="space-y-3">
                                    {CREDENTIALS.map((cred) => (
                                        <div key={cred.name} className="p-3 rounded-lg border border-white/5 bg-black/30 flex items-center justify-between gap-4">
                                            <div>
                                                <span className="text-xs font-bold text-gray-200 block">{cred.name}</span>
                                                <span className="text-[10px] text-gray-400">{cred.desc}</span>
                                            </div>
                                            <StatusBadge label={cred.status} tone="neutral" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'testing' && (
                        <motion.div
                            key="testing"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            <div className="p-5 rounded-xl border border-white/5 bg-white/1">
                                <h3 className="text-sm font-black uppercase text-white mb-2">E2E Testing</h3>
                                <p className="text-xs text-gray-400 mb-6">{LIVE_STATUS_MESSAGE}</p>

                                <div className="space-y-2">
                                    {TEST_COMMANDS.map(command => (
                                        <div key={command} className="flex items-center gap-2 text-xs font-mono text-gray-300 border border-white/5 bg-black/30 rounded-lg px-3 py-2">
                                            <FileText size={12} className={`${moduleColor.text} shrink-0`} />
                                            {command}
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 flex items-center gap-2 text-xs text-amber-300">
                                    <ShieldAlert size={14} />
                                    Run these from CI or the terminal. This screen does not fabricate execution.
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </ThreePanelDashboard>
    );
}
