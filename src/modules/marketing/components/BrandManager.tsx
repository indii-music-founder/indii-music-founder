import React, { useState, useEffect } from 'react';
import { useStore } from '@/core/store';
import {
    Shield, Palette, Disc, Activity, Edit2,
    Plus, X, Check, Trash2, User, Layout, Type,
    FileText, Zap, RefreshCw, Loader2, AlertTriangle,
    CheckCircle, Sparkles, Hash
} from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { AI } from '@/services/ai/AIService';
import { db } from '@/services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Schema } from 'firebase/ai';

interface AnalysisResult {
    isConsistent: boolean;
    score: number;
    issues: string[];
    suggestions: string[];
}

const BrandManager: React.FC = () => {
    const { userProfile, updateBrandKit, setUserProfile } = useStore();
    const toast = useToast();

    // Tab State
    const [activeTab, setActiveTab] = useState<'identity' | 'visuals' | 'release' | 'health'>('identity');

    // Edit States
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [bioDraft, setBioDraft] = useState('');

    // Health Check States
    const [contentToCheck, setContentToCheck] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

    // Helpers to access nested data safely
    const brandKit = userProfile?.brandKit || {
        colors: [], fonts: 'Inter', brandDescription: '', negativePrompt: '', socials: {},
        brandAssets: [], referenceImages: [], releaseDetails: { title: '', type: '', genre: '', mood: '', themes: '' }
    };
    const release = brandKit.releaseDetails || { title: '', type: '', genre: '', mood: '', themes: '' };

    // -- IDENTITY SECTION HANDLERS --
    const handleSaveBio = async () => {
        if (!userProfile?.id) return;
        try {
            const updatedProfile = { ...userProfile, bio: bioDraft };
            setUserProfile(updatedProfile);

            // Persist
            const userRef = doc(db, 'users', userProfile.id);
            await updateDoc(userRef, { bio: bioDraft });

            setIsEditingBio(false);
            toast.success("Bio updated");
        } catch (e) {
            toast.error("Failed to save bio");
        }
    };

    // -- VISUALS SECTION HANDLERS --
    const handleAddColor = () => {
        const newColors = [...(brandKit.colors || []), '#000000'];
        updateBrandKit({ colors: newColors });
        saveBrandKit({ colors: newColors });
    };

    const handleUpdateColor = (index: number, color: string) => {
        const newColors = [...(brandKit.colors || [])];
        newColors[index] = color;
        updateBrandKit({ colors: newColors });
    };

    const handleRemoveColor = (index: number) => {
        const newColors = [...(brandKit.colors || [])];
        newColors.splice(index, 1);
        updateBrandKit({ colors: newColors });
        saveBrandKit({ colors: newColors });
    };

    // -- RELEASE SECTION HANDLERS --
    const handleUpdateRelease = (field: string, value: string) => {
        const newRelease = { ...release, [field]: value };
        updateBrandKit({ releaseDetails: newRelease });
    };

    const handleSaveRelease = async () => {
        if (!userProfile?.id) return;
        try {
            await saveBrandKit({ releaseDetails: release });
            toast.success("Release details saved");
        } catch (e) {
            toast.error("Failed to save release details");
        }
    };

    // -- PERSISTENCE HELPER --
    const saveBrandKit = async (updates: any) => {
        if (!userProfile?.id) return;
        const userRef = doc(db, 'users', userProfile.id);
        const firestoreUpdates: any = {};
        Object.keys(updates).forEach(key => {
            firestoreUpdates[`brandKit.${key}`] = updates[key];
        });
        await updateDoc(userRef, firestoreUpdates);
    };

    // -- HEALTH CHECK HANDLER --
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
                } as any,
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
            toast.success("Analysis complete");
        } catch (error) {
            toast.error("Analysis failed");
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Navigation Tabs
    const tabs = [
        { id: 'identity', label: 'Identity Core', icon: User },
        { id: 'visuals', label: 'Visual DNA', icon: Palette },
        { id: 'release', label: 'Release Manifest', icon: Disc },
        { id: 'health', label: 'Brand Health', icon: Activity },
    ];

    return (
        <div className="flex h-screen w-full bg-[#0a0a0a] text-slate-200 font-sans overflow-hidden selection:bg-amber-500/30 relative">
            {/* Global Background Ambience */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-amber-900/10 blur-[150px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-purple-900/10 blur-[150px]" />
                <div className="absolute top-[40%] left-[40%] w-[40%] h-[40%] bg-indigo-500/5 blur-[120px] animate-pulse-slow" />
            </div>

            {/* Sidebar Navigation */}
            <aside className="w-64 lg:w-72 h-full z-20 flex flex-col border-r border-white/5 bg-black/40 backdrop-blur-xl relative">
                {/* Brand Header */}
                <div className="p-6 pb-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-white/10 shadow-[0_0_15px_rgba(251,191,36,0.15)]">
                            <Shield size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white leading-tight">Brand HQ<span className="text-amber-500">.</span></h1>
                            <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Identity & DNA</p>
                        </div>
                    </div>

                    {/* Quick Stats / Info */}
                    <div className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Career Stage</div>
                            <div className="text-sm font-bold text-white">{userProfile?.careerStage || 'Unspecified'}</div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Current Goal</div>
                            <div className="text-sm font-bold text-amber-400 flex items-center gap-2">
                                <Zap size={14} className="text-amber-500" />
                                {userProfile?.goals?.[0] || 'World Domination'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Menu */}
                <nav className="flex-1 px-4 space-y-2 overflow-y-auto no-scrollbar">
                    <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-2 mb-2">Manager Menu</div>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`
                                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative
                                ${activeTab === tab.id
                                    ? 'bg-amber-600/10 text-white shadow-[0_0_15px_rgba(251,191,36,0.15)] border border-amber-500/20'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }
                            `}
                        >
                            <tab.icon
                                size={18}
                                className={`transition-colors ${activeTab === tab.id ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-300'}`}
                            />
                            <span>{tab.label}</span>
                            {activeTab === tab.id && <motion.div layoutId="active-indicator" className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />}
                        </button>
                    ))}
                </nav>

                {/* Footer info */}
                <div className="p-4 border-t border-white/5 mt-auto">
                    <p className="text-[10px] text-slate-600 text-center italic">
                        Identity Protection Active
                    </p>
                </div>
            </aside>

            {/* Main Area */}
            <main className="flex-1 relative flex flex-col min-w-0 z-10 h-full overflow-hidden">
                {/* HUD Header */}
                <header className="h-20 shrink-0 px-8 flex items-center justify-between border-b border-white/5 bg-black/20 backdrop-blur-sm z-20">
                    <div className="flex items-center gap-4">
                        <h2 className="text-2xl font-bold text-white tracking-tight">
                            {tabs.find(t => t.id === activeTab)?.label}
                        </h2>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 scroll-smooth no-scrollbar">

                    <AnimatePresence mode="wait">

                        {/* IDENTITY TAB */}
                        {activeTab === 'identity' && (
                            <motion.div
                                key="identity"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                            >
                                {/* Bio Card */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="glass-panel p-8 rounded-2xl border-l-2 border-l-amber-500 bg-white/5 backdrop-blur-xl">
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                                    <FileText size={20} className="text-amber-500" />
                                                    Identity Bio
                                                </h3>
                                                <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">Public Perspective</p>
                                            </div>
                                            {!isEditingBio ? (
                                                <button onClick={() => { setBioDraft(userProfile?.bio || ''); setIsEditingBio(true); }} className="p-2.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all border border-white/5">
                                                    <Edit2 size={16} />
                                                </button>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <button onClick={() => setIsEditingBio(false)} className="p-2.5 hover:bg-red-500/10 rounded-xl text-red-500 transition-all border border-red-500/20"><X size={16} /></button>
                                                    <button onClick={handleSaveBio} className="p-2.5 hover:bg-emerald-500/10 rounded-xl text-emerald-500 transition-all border border-emerald-500/20"><Check size={16} /></button>
                                                </div>
                                            )}
                                        </div>

                                        {isEditingBio ? (
                                            <textarea
                                                value={bioDraft}
                                                onChange={(e) => setBioDraft(e.target.value)}
                                                className="w-full h-80 bg-black/40 border border-white/10 rounded-xl p-6 text-base text-slate-200 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none transition-all leading-relaxed no-scrollbar"
                                                placeholder="Tell your story..."
                                            />
                                        ) : (
                                            <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed whitespace-pre-wrap text-lg font-medium">
                                                {userProfile?.bio || <span className="text-slate-600 italic">No bio written yet. Start by editing this section.</span>}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Stats / Quick Info */}
                                <div className="space-y-6">
                                    <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-xl">
                                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Mission Stats</h3>
                                        <div className="space-y-6">
                                            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-2">Primary Aesthetic</label>
                                                <div className="text-lg font-black text-white">
                                                    {brandKit.brandDescription || 'Not Defined'}
                                                </div>
                                            </div>
                                            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-2">A&R Sentiment</label>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 flex-1 bg-white/10 rounded-full overflow-hidden">
                                                        <div className="h-full bg-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.5)]" style={{ width: '75%' }} />
                                                    </div>
                                                    <span className="text-xs font-bold text-amber-500">75%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}


                        {/* VISUALS TAB */}
                        {activeTab === 'visuals' && (
                            <motion.div
                                key="visuals"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-8"
                            >
                                {/* Color Palette */}
                                <div className="glass-panel p-8 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-xl">
                                    <div className="flex items-center justify-between mb-8">
                                        <div>
                                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                                <Palette size={22} className="text-amber-500" />
                                                Color Palette
                                            </h3>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Chromatic Identity</p>
                                        </div>
                                        <button
                                            onClick={handleAddColor}
                                            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-lg text-xs font-black hover:bg-amber-400 transition-all active:scale-95 shadow-[0_0_15px_rgba(251,191,36,0.2)]"
                                        >
                                            <Plus size={14} />
                                            <span>Add Color</span>
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap gap-6">
                                        {brandKit.colors?.map((color, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="group relative"
                                            >
                                                <div
                                                    className="w-32 h-32 rounded-2xl shadow-2xl cursor-pointer transition-all transform hover:scale-105 border border-white/10 overflow-hidden relative ring-offset-black ring-offset-4 hover:ring-2 hover:ring-amber-500/50"
                                                    style={{ backgroundColor: color }}
                                                >
                                                    <input
                                                        type="color"
                                                        value={color}
                                                        onChange={(e) => handleUpdateColor(idx, e.target.value)}
                                                        onBlur={() => saveBrandKit({ colors: brandKit.colors })}
                                                        className="opacity-0 w-full h-full cursor-pointer absolute inset-0"
                                                    />
                                                    <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm p-2 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <p className="text-[8px] text-white font-mono uppercase font-bold">{color}</p>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleRemoveColor(idx); }}
                                                            className="text-red-400 hover:text-red-300"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>

                                {/* Typography & Style */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="glass-panel p-8 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-xl">
                                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                            <Type size={18} className="text-amber-500" />
                                            Typography
                                        </h3>
                                        <div className="p-8 bg-black/40 rounded-2xl border border-white/5 relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-12 bg-amber-500/5 blur-[40px] rounded-full group-hover:bg-amber-500/10 transition-colors" />
                                            <p className="text-6xl font-black text-white mb-4 tracking-tighter" style={{ fontFamily: brandKit.fonts }}>AaBb</p>
                                            <p className="text-sm text-amber-500 font-mono font-bold tracking-widest">{brandKit.fonts || 'Inter'}</p>
                                        </div>
                                        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mt-6">
                                            Global Design System Sync: Active
                                        </p>
                                    </div>
                                    <div className="glass-panel p-8 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-xl">
                                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                            <Layout size={18} className="text-amber-500" />
                                            Digital Aura
                                        </h3>
                                        <div className="flex flex-wrap gap-3">
                                            {['High Fidelity', 'Glassmorphism', 'Cyberpunk', 'Luxury', 'Authentic'].map(tag => (
                                                <span key={tag} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold text-slate-300 uppercase tracking-widest hover:bg-white/10 transition-colors cursor-default">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}


                        {/* RELEASE TAB */}
                        {activeTab === 'release' && (
                            <motion.div
                                key="release"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{ duration: 0.2 }}
                                className="bg-black/60 rounded-3xl border border-white/10 overflow-hidden backdrop-blur-2xl shadow-2xl relative"
                            >
                                <div className="p-12 border-b border-white/5 bg-white/[0.02] relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-48 bg-amber-600/10 blur-[120px] rounded-full pointer-events-none" />
                                    <div className="relative z-10">
                                        <label className="text-[10px] text-amber-500 font-black uppercase tracking-[0.2em] mb-4 block">Mission Architect</label>
                                        <input
                                            type="text"
                                            value={release.title}
                                            onChange={(e) => handleUpdateRelease('title', e.target.value)}
                                            onBlur={handleSaveRelease}
                                            className="text-6xl md:text-8xl font-black text-white bg-transparent border-none focus:ring-0 p-0 w-full placeholder:text-white/5 tracking-tighter"
                                            placeholder="MISSION_UNTITLED"
                                        />
                                        <div className="flex flex-wrap items-center gap-6 mt-8">
                                            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-5 py-2.5">
                                                <Disc size={16} className="text-amber-500" />
                                                <select
                                                    value={release.type}
                                                    onChange={(e) => { handleUpdateRelease('type', e.target.value); handleSaveRelease(); }}
                                                    className="bg-transparent border-none text-xs font-bold text-slate-200 focus:ring-0 p-0 min-w-[80px]"
                                                >
                                                    <option value="Single" className="bg-slate-900">Single</option>
                                                    <option value="EP" className="bg-slate-900">EP</option>
                                                    <option value="Album" className="bg-slate-900">Album</option>
                                                </select>
                                            </div>
                                            <div className="h-6 w-px bg-white/10 hidden md:block" />
                                            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-5 py-2.5 flex-1 max-w-sm hover:border-white/20 transition-colors">
                                                <Hash size={16} className="text-amber-500 opacity-50" />
                                                <input
                                                    type="text"
                                                    value={release.genre}
                                                    onChange={(e) => handleUpdateRelease('genre', e.target.value)}
                                                    onBlur={handleSaveRelease}
                                                    placeholder="Genre (e.g. Neo-Soul)"
                                                    className="bg-transparent border-none text-white focus:ring-0 p-0 text-xs font-bold w-full"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3 text-slate-400 mb-2">
                                            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                                                <Activity size={16} className="text-red-400" />
                                            </div>
                                            <span className="text-xs font-black uppercase tracking-widest">Atmosphere & Mood</span>
                                        </div>
                                        <textarea
                                            value={release.mood}
                                            onChange={(e) => handleUpdateRelease('mood', e.target.value)}
                                            onBlur={handleSaveRelease}
                                            className="w-full h-48 bg-black/40 border border-white/5 rounded-2xl p-6 text-sm font-medium text-slate-300 focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/10 outline-none resize-none no-scrollbar leading-relaxed"
                                            placeholder="Describe the sonic and visual atmosphere..."
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3 text-slate-400 mb-2">
                                            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                                <Shield size={16} className="text-blue-400" />
                                            </div>
                                            <span className="text-xs font-black uppercase tracking-widest">Conceptual Themes</span>
                                        </div>
                                        <textarea
                                            value={release.themes}
                                            onChange={(e) => handleUpdateRelease('themes', e.target.value)}
                                            onBlur={handleSaveRelease}
                                            className="w-full h-48 bg-black/40 border border-white/5 rounded-2xl p-6 text-sm font-medium text-slate-300 focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/10 outline-none resize-none no-scrollbar leading-relaxed"
                                            placeholder="Translate the artistry into narrative goals..."
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}


                        {/* HEALTH CHECK TAB */}
                        {activeTab === 'health' && (
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
                                        <div className="p-6 border-b border-white/5 bg-black/20">
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex justify-between items-center">
                                                System Audit
                                                {contentToCheck && (
                                                    <span className="text-[8px] bg-amber-500/20 px-2 py-0.5 rounded-full text-amber-500 border border-amber-500/20">{contentToCheck.length} chars</span>
                                                )}
                                            </h3>
                                        </div>
                                        <textarea
                                            value={contentToCheck}
                                            onChange={(e) => setContentToCheck(e.target.value)}
                                            placeholder="Paste caption, email, or lyrics here for high-fidelity brand alignment check..."
                                            className="flex-1 w-full bg-transparent p-8 text-base text-slate-200 resize-none focus:outline-none placeholder:text-slate-700 leading-relaxed font-medium no-scrollbar"
                                        />
                                        <div className="p-6 border-t border-white/5 bg-black/40 backdrop-blur-md">
                                            <button
                                                onClick={handleAnalyze}
                                                disabled={isAnalyzing || !contentToCheck}
                                                className="w-full py-4 bg-white text-black font-black rounded-2xl hover:bg-slate-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98] shadow-[0_0_30px_rgba(255,255,255,0.05)]"
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
                                        <div className="glass-panel rounded-3xl h-full flex flex-col items-center justify-center text-slate-600 border border-white/5 p-12 text-center bg-white/[0.01] backdrop-blur-xl">
                                            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-8 border border-white/10 shadow-[0_0_50px_rgba(255,255,255,0.02)]">
                                                <Activity size={40} className="text-amber-500 animate-pulse" />
                                            </div>
                                            <h3 className="text-2xl font-black text-white mb-4 tracking-tight">DNA Scanner Standby</h3>
                                            <p className="max-w-md mx-auto text-sm leading-relaxed font-medium opacity-60">
                                                Deploy the internal Brand Intelligence to cross-reference copy against your established visual and conceptual guidelines.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
};


export default BrandManager;
