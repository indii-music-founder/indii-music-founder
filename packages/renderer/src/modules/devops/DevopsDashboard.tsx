import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ThreePanelDashboard } from '@/components/layout/ThreePanelDashboard';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import {
    Activity, Play, RotateCw, Terminal, CheckCircle2, AlertCircle, Clock, Shield,
    Cpu, HardDrive, Database, Server, RefreshCw, Key, ShieldAlert, AlertTriangle,
    Sliders, FileText, Send, Sparkles, Code, Check, ListRestart, ExternalLink
} from 'lucide-react';

// Define structures for mock DevOps data
interface PipelineJob {
    id: string;
    name: string;
    status: 'idle' | 'running' | 'success' | 'failed';
    progress: number;
    duration?: string;
}

interface LogLine {
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'success';
    message: string;
}

export default function DevopsDashboard() {
    const [activeTab, setActiveTab] = useState<'cicd' | 'observability' | 'credentials' | 'testing'>('cicd');
    
    // States for interactive DevOps workflows
    const [pipelineJobs, setPipelineJobs] = useState<PipelineJob[]>([
        { id: '1', name: 'Lint & Typecheck', status: 'idle', progress: 0 },
        { id: '2', name: 'Unit Tests (Vitest)', status: 'idle', progress: 0 },
        { id: '3', name: 'E2E Tests (Playwright)', status: 'idle', progress: 0 },
        { id: '4', name: 'Build Production Bundle', status: 'idle', progress: 0 },
        { id: '5', name: 'Sign & Notarize (macOS/Win)', status: 'idle', progress: 0 },
        { id: '6', name: 'Deploy to Firebase Hosting', status: 'idle', progress: 0 }
    ]);
    const [pipelineActive, setPipelineActive] = useState(false);
    const [currentJobIndex, setCurrentJobIndex] = useState(-1);
    const [pipelineLog, setPipelineLog] = useState<LogLine[]>([
        { timestamp: '18:56:50', level: 'info', message: 'CI/CD pipeline system initialized.' },
        { timestamp: '18:56:52', level: 'success', message: 'Connected to Firebase deployment target (indii-music-founder).' }
    ]);
    
    // Stats and resource monitor states
    const [cpuUsage, setCpuUsage] = useState(38);
    const [memUsage, setMemUsage] = useState(54);
    const [dbLatency, setDbLatency] = useState(45);
    const [isRefreshingStats, setIsRefreshingStats] = useState(false);

    // E2E Tests states
    const [e2eSuiteRunning, setE2eSuiteRunning] = useState(false);
    const [e2eProgress, setE2eProgress] = useState(0);
    const [e2ePassCount, setE2ePassCount] = useState(0);
    const [e2eFailCount, setE2eFailCount] = useState(0);
    const [selectedTestFile, setSelectedTestFile] = useState('auth-flow.spec.ts');

    // Auto-scroll logs
    const logEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [pipelineLog]);

    // Background resource fluctuation simulation
    useEffect(() => {
        const interval = setInterval(() => {
            if (!isRefreshingStats) {
                setCpuUsage(prev => Math.min(100, Math.max(10, prev + Math.floor(Math.random() * 11) - 5)));
                setMemUsage(prev => Math.min(100, Math.max(10, prev + Math.floor(Math.random() * 5) - 2)));
                setDbLatency(prev => Math.min(200, Math.max(15, prev + Math.floor(Math.random() * 9) - 4)));
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [isRefreshingStats]);

    // Run custom stat refresh
    const triggerStatsRefresh = () => {
        setIsRefreshingStats(true);
        setCpuUsage(12);
        setMemUsage(42);
        setDbLatency(10);
        setTimeout(() => {
            setCpuUsage(41);
            setMemUsage(52);
            setDbLatency(38);
            setIsRefreshingStats(false);
            addLog('info', 'System metrics re-profiled. Latency stabilized.');
        }, 800);
    };

    // Helper to append log lines
    const addLog = (level: LogLine['level'], message: string) => {
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];
        setPipelineLog(prev => [...prev, { timestamp: timeStr, level, message }]);
    };

    // Interactive build runner logic
    useEffect(() => {
        if (!pipelineActive || currentJobIndex < 0 || currentJobIndex >= pipelineJobs.length) {
            if (currentJobIndex >= pipelineJobs.length && pipelineActive) {
                setTimeout(() => {
                    setPipelineActive(false);
                }, 0);
                addLog('success', 'DEPLOYMENT SUCCESSFUL. Live version: v1.55.3');
            }
            return;
        }

        const currentJob = pipelineJobs[currentJobIndex];
        addLog('info', `Starting step: ${currentJob.name}...`);
        
        let progressVal = 0;
        const progressInterval = setInterval(() => {
            progressVal += 10;
            setPipelineJobs(prev => prev.map((job, idx) => {
                if (idx === currentJobIndex) {
                    return { ...job, status: 'running', progress: progressVal };
                }
                return job;
            }));

            if (progressVal >= 100) {
                clearInterval(progressInterval);
                setPipelineJobs(prev => prev.map((job, idx) => {
                    if (idx === currentJobIndex) {
                        return { ...job, status: 'success', progress: 100, duration: '1.2s' };
                    }
                    return job;
                }));
                addLog('success', `Completed step: ${currentJob.name} in 1.2s`);
                setCurrentJobIndex(prev => prev + 1);
            }
        }, 300);

        return () => clearInterval(progressInterval);
    }, [pipelineActive, currentJobIndex]);

    const startPipeline = () => {
        setPipelineActive(true);
        setCurrentJobIndex(0);
        setPipelineJobs(prev => prev.map(job => ({ ...job, status: 'idle', progress: 0, duration: undefined })));
        addLog('info', 'Preparing container and pulling production codebase...');
    };

    // Simulated E2E Runner logic
    const runE2ETests = () => {
        setE2eSuiteRunning(true);
        setE2eProgress(0);
        setE2ePassCount(0);
        setE2eFailCount(0);
        addLog('info', `Running Playwright Suite for ${selectedTestFile}...`);

        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            setE2eProgress(progress);
            
            // Randomly pass or fail assertions
            if (Math.random() > 0.85) {
                setE2eFailCount(f => f + 1);
                addLog('error', `Assertion failed: Selector button[data-testid="onboarding-submit"] was not clickable after 5000ms`);
            } else {
                setE2ePassCount(p => p + 1);
            }

            if (progress >= 100) {
                clearInterval(interval);
                setE2eSuiteRunning(false);
                addLog('success', `Playwright run completed. Passed: ${e2ePassCount + 6}, Failed: ${e2eFailCount}`);
            }
        }, 400);
    };

    return (
        <ThreePanelDashboard
            moduleName="DevOps"
            headerIcon={<Activity size={18} className="text-white" />}
            title="DevOps Command Center"
            subtitle="Release pipelines, platform observability, credentials & automated E2E suites"
            bgBlobClass="bg-emerald-500/10"
            iconBgClass="bg-linear-to-br from-emerald-500 to-emerald-400"
            iconShadowClass="shadow-emerald-500/20"
            leftPanel={
                <div className="flex flex-col gap-4">
                    {/* Resource Monitor Panel */}
                    <div className="p-4 rounded-xl border border-white/5 bg-white/2 backdrop-blur-md">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 font-mono">Resource Monitor</span>
                            <button 
                                onClick={triggerStatsRefresh} 
                                disabled={isRefreshingStats} 
                                className="p-1 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white"
                            >
                                <RefreshCw size={12} className={isRefreshingStats ? 'animate-spin' : ''} />
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-[11px] text-gray-400 mb-1 font-mono">
                                    <span className="flex items-center gap-1.5"><Cpu size={12} /> CPU Core</span>
                                    <span>{cpuUsage}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    <motion.div 
                                        className="h-full bg-emerald-500" 
                                        animate={{ width: `${cpuUsage}%` }} 
                                        transition={{ duration: 0.5 }}
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[11px] text-gray-400 mb-1 font-mono">
                                    <span className="flex items-center gap-1.5"><HardDrive size={12} /> Memory VM</span>
                                    <span>{memUsage}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    <motion.div 
                                        className="h-full bg-cyan-500" 
                                        animate={{ width: `${memUsage}%` }}
                                        transition={{ duration: 0.5 }}
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[11px] text-gray-400 mb-1 font-mono">
                                    <span className="flex items-center gap-1.5"><Database size={12} /> Db Latency</span>
                                    <span>{dbLatency} ms</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    <motion.div 
                                        className={`h-full ${dbLatency > 100 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                                        animate={{ width: `${Math.min(100, (dbLatency / 200) * 100)}%` }}
                                        transition={{ duration: 0.5 }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Tools Panel */}
                    <div className="p-4 rounded-xl border border-white/5 bg-white/2 backdrop-blur-md">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 font-mono block mb-3">Quick Actions</span>
                        <div className="space-y-2">
                            <button 
                                onClick={startPipeline}
                                disabled={pipelineActive}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold bg-emerald-500 text-black hover:bg-emerald-400 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                <span className="flex items-center gap-1.5"><Play size={12} /> Deploy Production</span>
                                <span className="text-[9px] font-mono border border-black/20 px-1 rounded bg-black/10">v1.55.3</span>
                            </button>
                            
                            <button 
                                onClick={() => {
                                    addLog('warn', 'Purging local build workspace and clean-installing node_modules...');
                                    setTimeout(() => addLog('success', 'Pruned 1,230 cached files successfully.'), 1200);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-gray-300 hover:text-white border border-white/5 hover:border-white/10 rounded-lg transition-colors text-left"
                            >
                                <ListRestart size={12} /> Prune & Clear Cache
                            </button>
                        </div>
                    </div>

                    {/* Environment Targets */}
                    <div className="p-4 rounded-xl border border-white/5 bg-white/2 backdrop-blur-md">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 font-mono block mb-2">Environments</span>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs py-1">
                                <span className="text-gray-400 font-medium">Production (Host)</span>
                                <span className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-900/40">
                                    <Server size={10} /> Active
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-xs py-1">
                                <span className="text-gray-400 font-medium">Staging (Vite Web)</span>
                                <span className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-900/40">
                                    <Server size={10} /> Active
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-xs py-1">
                                <span className="text-gray-400 font-medium">Local dev (Studio)</span>
                                <span className="flex items-center gap-1.5 font-mono text-[10px] text-cyan-400 bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-900/40">
                                    <Clock size={10} /> Port 4242
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            }
            rightPanel={
                <div className="flex flex-col gap-4 h-full">
                    {/* Live Stream Logs */}
                    <div className="flex-1 flex flex-col p-4 rounded-xl border border-white/5 bg-white/2 backdrop-blur-md overflow-hidden">
                        <div className="flex items-center justify-between mb-3 flex-shrink-0">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 font-mono flex items-center gap-1.5">
                                <Terminal size={12} /> Log Stream
                            </span>
                            <button 
                                onClick={() => setPipelineLog([])}
                                className="text-[9px] font-mono text-gray-500 hover:text-white"
                            >
                                Clear
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-2 custom-scrollbar pr-1">
                            {pipelineLog.map((log, idx) => (
                                <div key={idx} className="leading-relaxed border-b border-white/[0.01] pb-1.5">
                                    <span className="text-gray-600 mr-2">[{log.timestamp}]</span>
                                    <span className={`font-bold mr-1.5 ${
                                        log.level === 'error' ? 'text-red-400' :
                                        log.level === 'warn' ? 'text-amber-400' :
                                        log.level === 'success' ? 'text-emerald-400' :
                                        'text-cyan-400'
                                    }`}>{log.level.toUpperCase()}:</span>
                                    <span className="text-gray-300">{log.message}</span>
                                </div>
                            ))}
                            <div ref={logEndRef} />
                        </div>
                    </div>
                </div>
            }
        >
            {/* Main Tabs Navigation */}
            <div className="border-b border-white/5 px-6 flex-shrink-0">
                <div className="flex gap-6 h-12">
                    {([
                        { id: 'cicd', label: 'CI/CD Pipelines', icon: RotateCw },
                        { id: 'observability', label: 'Observability & Metrics', icon: Sliders },
                        { id: 'credentials', label: 'Access Tokens & Keys', icon: Shield },
                        { id: 'testing', label: 'E2E Testing (Playwright)', icon: Code }
                    ] as const).map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`flex items-center gap-2 text-xs font-bold border-b-2 px-1 transition-all ${
                                activeTab === id 
                                ? 'border-emerald-500 text-white font-black' 
                                : 'border-transparent text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            <Icon size={14} className={activeTab === id ? 'text-emerald-400' : ''} />
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Dashboard Content Panes */}
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
                            <div className="p-5 rounded-xl border border-white/5 bg-white/1 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                        pipelineActive ? 'bg-amber-500/10 text-amber-400 animate-pulse border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    }`}>
                                        <Activity size={10} />
                                        {pipelineActive ? 'Pipeline Running' : 'Standby ready'}
                                    </span>
                                </div>
                                <h3 className="text-base font-black uppercase text-white mb-1">Production Release Runner</h3>
                                <p className="text-xs text-gray-400 mb-6 max-w-xl">Triggers full build checklist: compilation, automated Vitest runs, signing/notarization for desktop bundles, and live hosting deploy.</p>
                                
                                <div className="space-y-4 max-w-3xl">
                                    {pipelineJobs.map((job, idx) => (
                                        <div key={job.id} className="p-3.5 rounded-lg border border-white/5 bg-black/40 flex items-center justify-between">
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className="w-5 h-5 flex items-center justify-center rounded bg-white/5 text-gray-400">
                                                    {job.status === 'success' && <CheckCircle2 size={16} className="text-emerald-500" />}
                                                    {job.status === 'failed' && <AlertCircle size={16} className="text-red-500" />}
                                                    {job.status === 'running' && <RefreshCw size={14} className="text-emerald-400 animate-spin" />}
                                                    {job.status === 'idle' && <span className="text-[10px] font-bold font-mono">{idx + 1}</span>}
                                                </div>
                                                <div className="flex-1">
                                                    <span className="text-xs font-bold text-gray-200 block">{job.name}</span>
                                                    {job.status === 'running' && (
                                                        <div className="h-1 w-full max-w-md bg-white/5 rounded-full mt-2 overflow-hidden">
                                                            <motion.div 
                                                                className="h-full bg-emerald-500" 
                                                                animate={{ width: `${job.progress}%` }} 
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-xs font-mono">
                                                {job.status === 'success' && <span className="text-emerald-400 font-bold">COMPLETED ({job.duration})</span>}
                                                {job.status === 'running' && <span className="text-emerald-400 font-medium">RUNNING {job.progress}%</span>}
                                                {job.status === 'failed' && <span className="text-red-400 font-bold">FAILED</span>}
                                                {job.status === 'idle' && <span className="text-gray-600">PENDING</span>}
                                            </div>
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
                                <div className="p-4 rounded-xl border border-white/5 bg-white/1">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 font-mono block mb-1">API Call Volume (24h)</span>
                                    <div className="text-2xl font-black font-mono text-white">41,202</div>
                                    <span className="text-[10px] text-emerald-500 font-bold font-mono flex items-center gap-1 mt-1">▲ +12% from yesterday</span>
                                </div>
                                <div className="p-4 rounded-xl border border-white/5 bg-white/1">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 font-mono block mb-1">System Error Rate</span>
                                    <div className="text-2xl font-black font-mono text-white">0.03%</div>
                                    <span className="text-[10px] text-emerald-500 font-bold font-mono flex items-center gap-1 mt-1">✔ Target is &lt; 0.5%</span>
                                </div>
                                <div className="p-4 rounded-xl border border-white/5 bg-white/1">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 font-mono block mb-1">Average Response</span>
                                    <div className="text-2xl font-black font-mono text-white">124 ms</div>
                                    <span className="text-[10px] text-gray-500 font-mono mt-1 block">CDN edge latency optimized</span>
                                </div>
                            </div>

                            {/* Simulated chart component using simple SVG */}
                            <div className="p-5 rounded-xl border border-white/5 bg-white/1">
                                <h4 className="text-xs font-black uppercase tracking-wider text-white mb-4">Request Volume & Error Anomalies (Realtime)</h4>
                                <div className="h-48 w-full border-b border-l border-white/5 relative flex items-end">
                                    {/* Mock chart bars */}
                                    <div className="absolute inset-0 flex items-end justify-between px-4">
                                        {[40, 48, 35, 60, 52, 45, 80, 95, 70, 55, 62, 50, 42, 60, 75, 80, 68, 55, 78, 92].map((val, idx) => (
                                            <div key={idx} className="w-6 flex flex-col items-center gap-1">
                                                <motion.div 
                                                    initial={{ height: 0 }}
                                                    animate={{ height: `${val}%` }}
                                                    className="w-full bg-linear-to-t from-emerald-500/20 to-emerald-400 rounded-t-sm"
                                                    transition={{ delay: idx * 0.02, duration: 0.6 }}
                                                />
                                                <span className="text-[8px] font-mono text-gray-600 mt-1">{10 + idx}h</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="absolute top-2 left-2 text-[9px] font-mono text-gray-500">req/sec</div>
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
                                    <Key size={16} className="text-emerald-400" /> Active API Keys & Credentials Verification
                                </h3>
                                
                                <div className="space-y-3">
                                    {[
                                        { name: 'Gemini 3 Integration Key', status: 'valid', desc: 'Unified Google Gen AI SDK integration - global pricing target verified' },
                                        { name: 'Firebase Public Identifiers', status: 'valid', desc: 'Client identification endpoint for Firestore and App Storage client' },
                                        { name: 'Stripe Payment Gateway Hook', status: 'valid', desc: 'Sub-merchant onboarding hook verified against Stripe API' },
                                        { name: 'Mac Notarization profile certificate', status: 'valid', desc: 'Developer ID Application certificate loaded (valid until Nov 2027)' },
                                        { name: 'Windows Code Signing SHA-256', status: 'valid', desc: 'Authenticode software certificate validated' }
                                    ].map((cred, idx) => (
                                        <div key={idx} className="p-3 rounded-lg border border-white/5 bg-black/30 flex items-center justify-between">
                                            <div>
                                                <span className="text-xs font-bold text-gray-200 block">{cred.name}</span>
                                                <span className="text-[10px] text-gray-400">{cred.desc}</span>
                                            </div>
                                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/40">
                                                <Check size={10} /> Validated
                                            </span>
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
                                <h3 className="text-sm font-black uppercase text-white mb-2">Automated E2E Test Suite Dashboard</h3>
                                <p className="text-xs text-gray-400 mb-6">Execute Playwright E2E browser scripts inside the sandbox, asserting flow controls, UI visuals, and performance integrity.</p>
                                
                                <div className="flex gap-4 items-center mb-6">
                                    <select 
                                        value={selectedTestFile} 
                                        onChange={(e) => setSelectedTestFile(e.target.value)}
                                        className="bg-black border border-white/10 text-xs font-mono text-gray-300 rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                                    >
                                        <option value="auth-flow.spec.ts">auth-flow.spec.ts (Authentication)</option>
                                        <option value="studio-persistence.spec.ts">studio-persistence.spec.ts (Persistence)</option>
                                        <option value="maestro-workflows.spec.ts">maestro-workflows.spec.ts (Workflows)</option>
                                        <option value="chaos-resilience.spec.ts">chaos-resilience.spec.ts (Stress / Chaos)</option>
                                    </select>
                                    <button 
                                        onClick={runE2ETests}
                                        disabled={e2eSuiteRunning}
                                        className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded transition-all disabled:opacity-50 flex items-center gap-1.5 uppercase"
                                    >
                                        {e2eSuiteRunning ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />} Run Tests
                                    </button>
                                </div>

                                {e2eSuiteRunning && (
                                    <div className="space-y-2 mb-6">
                                        <div className="flex justify-between text-xs text-gray-400">
                                            <span>Running Playwright Runner (Headless)</span>
                                            <span>{e2eProgress}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500" style={{ width: `${e2eProgress}%` }} />
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 rounded bg-black/40 border border-white/5 text-center">
                                        <span className="text-[10px] uppercase font-bold text-emerald-400 font-mono block">Pass assertions</span>
                                        <span className="text-3xl font-black font-mono text-emerald-400">{e2eSuiteRunning ? e2ePassCount : 24}</span>
                                    </div>
                                    <div className="p-4 rounded bg-black/40 border border-white/5 text-center">
                                        <span className="text-[10px] uppercase font-bold text-red-400 font-mono block">Failed assertions</span>
                                        <span className="text-3xl font-black font-mono text-red-400">{e2eSuiteRunning ? e2eFailCount : 0}</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </ThreePanelDashboard>
    );
}
