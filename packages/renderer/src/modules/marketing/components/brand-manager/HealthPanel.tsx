import React, { useState, useEffect } from 'react';
import {
    Activity, Zap, Loader2, AlertTriangle,
    CheckCircle, Sparkles, TrendingUp, History
} from 'lucide-react';
import { motion } from 'motion/react';
import { Schema } from 'firebase/ai';
import { useToast } from '@/core/context/ToastContext';
import { GenAI as AI } from '@/services/ai/GenAI';
import { TourMap } from '@/modules/touring/components/TourMap';
import type { BrandManagerTabProps, AnalysisResult, HealthHistoryEntry } from './types';

interface HealthPanelProps extends BrandManagerTabProps {}

const HealthPanel: React.FC<HealthPanelProps> = ({
    userProfile,
    brandKit,
    updateBrandKit,
    saveBrandKit,
    release,
}) => {
    const toast = useToast();

    // Health Check States
    const [contentToCheck, setContentToCheck] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [contentType, setContentType] = useState<'messaging' | 'social' | 'bio' | 'visuals'>('messaging');

    // Track History locally for UI, but it syncs from brandKit
    const [analysisHistory, setAnalysisHistory] = useState<HealthHistoryEntry[]>(brandKit.healthHistory || []);

    // Sync history when brandKit changes (e.g. on load)
    useEffect(() => {
        if (brandKit.healthHistory) setAnalysisHistory(brandKit.healthHistory);
    }, [brandKit.healthHistory]);

    const handleAnalyze = async () => {
        if (!contentToCheck) {
            toast.warning("Please verify you have content to check.");
            return;
        }

        const brandContext = `
            Bio: ${userProfile?.bio || ''}
            Description: ${brandKit.brandDescription || ''}
            Mood: ${release.mood || ''}
            Themes: ${release.themes || ''}
            Genre: ${release.genre || ''}
        `;

        setIsAnalyzing(true);
        setAnalysisResult(null);

        try {
            const schema: Schema = {
                type: 'object',
                properties: {
                    score: { type: 'number' },
                    isConsistent: { type: 'boolean' },
                    issues: { type: 'array', items: { type: 'string' } },
                    suggestions: { type: 'array', items: { type: 'string' } }
                },
                required: ['score', 'isConsistent', 'issues', 'suggestions'],
                nullable: false
            };

            const result = await AI.generateStructuredData<AnalysisResult>(
                `Analyze the following content against the Brand Guidelines.
                BRAND GUIDELINES:
                ${brandContext}

                CONTENT TO ANALYZE:
                ${contentToCheck}`,
                schema,
                undefined,
                `You are a strict Brand Manager. Analyze adherence to tone, mood, and themes.`
            );

            setAnalysisResult(result);
            const newHistoryItem: HealthHistoryEntry = {
                id: Date.now().toString(),
                date: new Date().toISOString().split('T')[0]!,
                type: contentType,
                score: result.score,
                content: contentToCheck.substring(0, 30) + (contentToCheck.length > 30 ? '...' : ''),
                issues: result.issues,
                suggestions: result.suggestions
            };

            const updatedHistory: HealthHistoryEntry[] = [newHistoryItem, ...(brandKit.healthHistory || []).map(({ date, type, ...rest }) => ({ ...rest, date: date ?? '', type: type as string }))].slice(0, 10);
            updateBrandKit({ healthHistory: updatedHistory });
            saveBrandKit({ healthHistory: updatedHistory });

            toast.success("Analysis complete");
        } catch (_error: unknown) {
            toast.error("Analysis failed");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <motion.div
            key="health"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-5 gap-8 h-full min-h-[600px]"
        >
            <div className="lg:col-span-2 flex flex-col gap-6 h-full">
                <div className="glass-panel p-1 rounded-3xl flex-1 flex flex-col overflow-hidden bg-white/5 border border-white/5 backdrop-blur-xl">
                    <div className="p-6 border-b border-white/5 bg-black/20 flex justify-between items-center">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                            <TrendingUp size={12} className="text-dept-marketing" />
                            System Audit
                        </h3>
                        <select
                            value={contentType}
                            onChange={(e) => setContentType(e.target.value as 'messaging' | 'social' | 'bio' | 'visuals')}
                            className="bg-transparent border-none text-[10px] uppercase font-black text-gray-500 focus:text-dept-marketing hover:text-white transition-colors outline-none cursor-pointer"
                        >
                            <option value="messaging" className="bg-[#111]">Messaging</option>
                            <option value="social" className="bg-[#111]">Social Post</option>
                            <option value="bio" className="bg-[#111]">Bio Check</option>
                            <option value="visuals" className="bg-[#111]">Visual DNA</option>
                        </select>
                    </div>
                    <textarea
                        value={contentToCheck}
                        onChange={(e) => setContentToCheck(e.target.value)}
                        placeholder={`Paste your ${contentType} here for high-fidelity brand alignment check...`}
                        className="flex-1 w-full bg-transparent p-4 text-sm text-gray-300 resize-none focus:outline-none placeholder:text-gray-700 leading-relaxed font-medium custom-scrollbar"
                    />
                    <div className="p-4 border-t border-gray-800 bg-[#0a0a0a]">
                        <button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing || !contentToCheck}
                            className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
                        >
                            {isAnalyzing ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>Analyzing...</span>
                                </>
                            ) : (
                                <>
                                    <Zap size={20} />
                                    <span>Audit Brand Health</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Analysis History */}
                <div className="glass-panel p-6 rounded-3xl bg-[#111] border border-white/5 h-64 overflow-hidden flex flex-col">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <History size={12} /> Recent Scans
                    </h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                        {analysisHistory.map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-[#0a0a0a] border border-gray-800 hover:border-gray-700 transition-all cursor-pointer group">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold text-white truncate">{entry.content}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[8px] text-gray-500 uppercase font-black">{entry.date}</span>
                                        <span className="text-[8px] text-dept-marketing/80 font-black uppercase tracking-tighter">{entry.type}</span>
                                    </div>
                                </div>
                                <div className={`text-sm font-black ${entry.score > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                    {entry.score}%
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="lg:col-span-3 h-full">
                {analysisResult ? (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="glass-panel p-8 rounded-3xl h-full overflow-y-auto space-y-8 bg-white/5 border border-white/5 backdrop-blur-xl custom-scrollbar"
                    >
                        <div className="flex items-center justify-between border-b border-white/5 pb-8">
                            <div>
                                <h2 className="text-3xl font-black text-white mb-2 tracking-tight flex items-center gap-3">
                                    Consistency Report
                                    {analysisResult.isConsistent && <CheckCircle size={24} className="text-emerald-500" />}
                                </h2>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Based on Active Mission Profile</p>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Brand Score</div>
                                <div className={`text-5xl font-black ${analysisResult.score > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                    {analysisResult.score}%
                                </div>
                            </div>
                        </div>

                        {/* Mini Impact Map in Report */}
                        <div className="h-48 w-full rounded-2xl overflow-hidden border border-white/5 relative">
                            <div className="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[8px] font-bold text-dept-marketing uppercase tracking-widest border border-white/10">
                                Predicted Impact Zones
                            </div>
                            <TourMap
                                markers={[
                                    { position: { lat: 34.0522, lng: -118.2437 }, title: "Los Angeles Hub", type: 'venue' },
                                    { position: { lat: 40.7128, lng: -74.0060 }, title: "NYC Outreach", type: 'venue' },
                                    { position: { lat: 51.5074, lng: -0.1278 }, title: "London Cluster", type: 'venue' }
                                ]}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6">
                                <h4 className="text-red-400 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <AlertTriangle size={16} />
                                    Divergence Detected
                                </h4>
                                <ul className="space-y-3">
                                    {analysisResult.issues.map((issue, i) => (
                                        <li key={i} className="text-sm text-slate-300 font-medium flex gap-3">
                                            <span className="text-red-500/50 pt-1">0{i + 1}</span> {issue}
                                        </li>
                                    ))}
                                    {analysisResult.issues.length === 0 && <li className="text-sm text-slate-500 italic">Zero divergence detected. Perfect alignment.</li>}
                                </ul>
                            </div>
                            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-6">
                                <h4 className="text-emerald-400 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Sparkles size={16} />
                                    Strategic Tuning
                                </h4>
                                <ul className="space-y-3">
                                    {analysisResult.suggestions.map((sug, i) => (
                                        <li key={i} className="text-sm text-slate-300 font-medium flex gap-3">
                                            <span className="text-emerald-500/50 pt-1">0{i + 1}</span> {sug}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <div className="glass-panel rounded-3xl h-full flex flex-col items-center justify-between text-slate-600 border border-white/5 p-0 overflow-hidden bg-white/[0.01] backdrop-blur-xl">
                        {/* Global Resonance Map */}
                        <div className="w-full flex-1 relative min-h-[300px]">
                            <TourMap
                                markers={[
                                    { position: { lat: 30.2672, lng: -97.7431 }, title: "Austin HQ", type: 'current' },
                                    { position: { lat: 34.0522, lng: -118.2437 }, title: "LA Node", type: 'venue' },
                                    { position: { lat: 52.5200, lng: 13.4050 }, title: "Berlin Cluster", type: 'venue' }
                                ]}
                            />
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#111] pointer-events-none" />
                            <div className="absolute top-6 left-6 z-10 flex flex-col gap-2">
                                <div className="bg-dept-marketing/20 backdrop-blur-md border border-dept-marketing/30 px-3 py-1.5 rounded-full flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-dept-marketing animate-pulse" />
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Global Resonance Active</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-12 text-center relative z-10">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10 mx-auto">
                                <Activity size={24} className="text-dept-marketing" />
                            </div>
                            <h3 className="text-xl font-black text-white mb-3 tracking-tight">DNA Scanner Standby</h3>
                            <p className="max-w-xs mx-auto text-[11px] leading-relaxed font-bold uppercase tracking-wider opacity-40">
                                Analyzing cross-market sentiment against established visual guidelines.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default HealthPanel;
