import React, { useState, useEffect, useRef } from 'react';
import { Play, Terminal, ExternalLink, AlertCircle, CheckCircle2, Loader2, Image as ImageIcon } from 'lucide-react';
import { browserAgentDriver } from '../../../services/agent/BrowserAgentDriver';
import { useAgentStore } from '../store/AgentStore';
import { AgentActionType } from '../types';

const BrowserAgentTester: React.FC = () => {
    const [url, setUrl] = useState('https://www.google.com');
    const [goal, setGoal] = useState('Find the capacity of "Saint Andrew\'s Hall" in Detroit');
    const [isRunning, setIsRunning] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { logAction } = useAgentStore();
    const logEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const runAgent = async () => {
        setIsRunning(true);
        setLogs([]);
        setScreenshot(null);
        setError(null);

        try {
            // Update logs in real-time if the driver supported callbacks, 
            // but for now we'll just wait for the result or poll if we enhanced it.
            // Let's assume the driver returns the full logs at the end for this prototype.
            const result = await browserAgentDriver.drive(url, goal);

            setLogs(result.logs);

            if (result.success) {
                logAction({
                    type: AgentActionType.BROWSER_DRIVE,
                    description: `Successfully achieved goal: ${goal}`,
                    status: 'completed',
                    metadata: { url, goal, steps: result.logs.length }
                });
            } else {
                setError('Agent failed to complete the goal.');
                logAction({
                    type: AgentActionType.BROWSER_DRIVE,
                    description: `Failed goal: ${goal}`,
                    status: 'failed',
                    metadata: { url, goal, error: 'Incomplete' }
                });
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred');
            setLogs(prev => [...prev, `[ERROR] ${err.message}`]);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Terminal className="text-emerald-400" size={20} /> Autonomous Agent Lab
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="agent-url" className="block text-sm font-medium text-slate-400 mb-1">Target URL</label>
                            <div className="relative">
                                <ExternalLink className="absolute left-3 top-2.5 text-slate-600" size={16} />
                                <input
                                    id="agent-url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                    placeholder="https://..."
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="agent-goal" className="block text-sm font-medium text-slate-400 mb-1">Instruction / Goal</label>
                            <textarea
                                id="agent-goal"
                                value={goal}
                                onChange={(e) => setGoal(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white h-32 resize-none focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                placeholder="What should the agent do?"
                            />
                        </div>

                        <button
                            onClick={runAgent}
                            disabled={isRunning}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all transform active:scale-[0.98]"
                        >
                            {isRunning ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Agent Driving...
                                </>
                            ) : (
                                <>
                                    <Play size={20} />
                                    Launch Agent
                                </>
                            )}
                        </button>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-center gap-3">
                                <AlertCircle size={20} />
                                <span className="text-sm">{error}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col h-[400px]">
                        <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center gap-2">
                            <Terminal size={14} /> Execution Logs
                        </label>
                        <div className="flex-1 bg-black rounded-lg p-4 font-mono text-xs overflow-y-auto border border-slate-800 space-y-1 custom-scrollbar">
                            {logs.length === 0 && !isRunning && (
                                <div className="text-slate-700 italic">Logs will appear here once the agent starts...</div>
                            )}
                            {logs.map((log, i) => (
                                <div key={i} className={
                                    log.includes('[ERROR]') ? 'text-red-400' :
                                        log.includes('[Driver] AI Thought') ? 'text-blue-400' :
                                            log.includes('[Driver] AI Action') ? 'text-emerald-400 font-bold' :
                                                'text-slate-300'
                                }>
                                    {log}
                                </div>
                            ))}
                            {isRunning && (
                                <div className="text-emerald-400 animate-pulse flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                                    Wait for AI reasoning...
                                </div>
                            )}
                            <div ref={logEndRef} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Tips */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/50 border border-slate-800/50 p-4 rounded-xl flex items-start gap-3">
                    <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400">
                        <ImageIcon size={18} />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm text-white">Visual Reasoning</h4>
                        <p className="text-xs text-slate-500 mt-1">Uses Gemini 2.5 Pro UI to "see" the page and make decisions like a human.</p>
                    </div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800/50 p-4 rounded-xl flex items-start gap-3">
                    <div className="bg-blue-500/10 p-2 rounded-lg text-blue-400">
                        <Terminal size={18} />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm text-white">Atomic Actions</h4>
                        <p className="text-xs text-slate-500 mt-1">Can click elements, type into forms, and extract results autonomously.</p>
                    </div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800/50 p-4 rounded-xl flex items-start gap-3">
                    <div className="bg-purple-500/10 p-2 rounded-lg text-purple-400">
                        <CheckCircle2 size={18} />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm text-white">Goal Oriented</h4>
                        <p className="text-xs text-slate-500 mt-1">Runs in a loop until the goal is achieved or max steps reached.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BrowserAgentTester;
