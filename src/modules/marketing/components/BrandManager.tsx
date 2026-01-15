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
import { BrandKit } from '@/modules/workflow/types';

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
        brandAssets: [], referenceImages: [], releaseDetails: { title: '', type: '', artists: '', genre: '', mood: '', themes: '', lyrics: '' }
    };
    const release = brandKit.releaseDetails || { title: '', type: '', artists: '', genre: '', mood: '', themes: '', lyrics: '' };

    // -- IDENTITY SECTION HANDLERS --
    const handleSaveBio = async () => {
        if (!userProfile?.id) {
            console.error("[BrandManager] Save failed: No userProfile.id");
            return;
        }
        console.info(`[BrandManager] Saving bio for user: ${userProfile.id}`, { bioDraft });

        try {
            const updatedProfile = { ...userProfile, bio: bioDraft };

            // This triggers ProfileSlice.setUserProfile -> saveProfileToStorage
            // which saves to LocalDB AND Firestore (if auth ID matches).
            setUserProfile(updatedProfile);

            console.info("[BrandManager] Bio save triggered via ProfileSlice");
            setIsEditingBio(false);
            toast.success("Bio updated");
        } catch (e) {
            console.error("[BrandManager] Bio save error:", e);
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
    const saveBrandKit = async (updates: Partial<BrandKit>) => {
        if (!userProfile || !userProfile.id) return;
        const userRef = doc(db, 'users', userProfile.id);
        const firestoreUpdates: Record<string, unknown> = {};
        Object.keys(updates).forEach(key => {
            firestoreUpdates[`brandKit.${key}`] = updates[key as keyof BrandKit];
        });
        await updateDoc(userRef, firestoreUpdates as any);
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
        <div className="flex h-screen w-full bg-[#0f0f0f] text-gray-200 font-sans overflow-hidden selection:bg-purple-500/30 relative">
            {/* Global Background Ambience */}
            {/* Global Background Ambience - Toned down for professional feel */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-purple-900/5 blur-[150px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-900/5 blur-[150px]" />
            </div>

            {/* Sidebar Navigation */}
            <aside className="w-64 border-r border-gray-800 bg-[#0a0a0a] flex flex-col h-full z-20">
                {/* Brand Header */}
                <div className="p-4 border-b border-gray-800 flex items-center gap-2 h-14">
                    <Shield className="text-purple-500" size={16} />
                    <span className="text-xs font-bold text-white tracking-widest uppercase">Brand HQ</span>
                </div>

                <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                    {/* Quick Stats / Info */}
                    <div className="mb-6 p-3 rounded-xl bg-[#111] border border-gray-800 space-y-3">
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Career Stage</div>
                            <div className="text-sm font-bold text-white">{userProfile?.careerStage || 'Unspecified'}</div>
                        </div>
                        <div>
                            <div className="text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-1">Current Goal</div>
                            <div className="text-xs font-bold text-purple-400 flex items-center gap-2">
                                <Zap size={12} className="text-purple-500" />
                                {userProfile?.goals?.[0] || 'World Domination'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Menu */}
                <div className="space-y-1">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-2">Manager Menu</div>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as 'identity' | 'visuals' | 'release' | 'health')}
                            className={`
                                    w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group relative
                                    ${activeTab === tab.id
                                    ? 'bg-purple-900/10 text-white border border-purple-500/30'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-[#151515]'
                                }
                                `}
                        >
                            <tab.icon
                                size={14}
                                className={`transition-colors ${activeTab === tab.id ? 'text-purple-400' : 'text-gray-500 group-hover:text-gray-400'}`}
                            />
                            <span>{tab.label}</span>
                            {activeTab === tab.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-purple-500 rounded-r-full" />}
                        </button>
                    ))}
                </div>
            </aside>

            {/* Main Area */}
            <main className="flex-1 relative flex flex-col min-w-0 z-10 h-full overflow-hidden">
                {/* HUD Header */}
                <header className="h-14 shrink-0 px-6 flex items-center justify-between border-b border-gray-800 bg-[#0a0a0a] z-20">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-gray-400">
                            {tabs.find(t => t.id === activeTab) && React.createElement(tabs.find(t => t.id === activeTab)!.icon, { size: 16, className: "text-purple-400" })}
                            <h2 className="text-sm font-bold text-gray-200 tracking-tight">
                                {tabs.find(t => t.id === activeTab)?.label}
                            </h2>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 scroll-smooth custom-scrollbar">

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
                                    <div className="p-6 rounded-xl border border-gray-800 bg-[#111]">
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                                                    Identity Bio
                                                </h3>
                                                <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest font-bold">Public Perspective</p>
                                            </div>
                                            {!isEditingBio ? (
                                                <button
                                                    onClick={() => { setBioDraft(userProfile?.bio || ''); setIsEditingBio(true); }}
                                                    className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-all"
                                                    aria-label="Edit bio"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setIsEditingBio(false)}
                                                        className="p-2 hover:bg-red-500/10 rounded-lg text-red-500 transition-all border border-red-500/20"
                                                        aria-label="Cancel editing"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                    <button
                                                        onClick={handleSaveBio}
                                                        className="p-2 hover:bg-emerald-500/10 rounded-lg text-emerald-500 transition-all border border-emerald-500/20"
                                                        aria-label="Save bio"
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {isEditingBio ? (
                                            <textarea
                                                value={bioDraft}
                                                onChange={(e) => setBioDraft(e.target.value)}
                                                className="w-full h-80 bg-[#0a0a0a] border border-gray-800 rounded-lg p-4 text-sm text-gray-300 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 outline-none transition-all leading-relaxed custom-scrollbar"
                                                placeholder="Tell your story..."
                                            />
                                        ) : (
                                            <div className="prose prose-invert max-w-none text-gray-400 leading-relaxed whitespace-pre-wrap text-sm font-medium">
                                                {userProfile?.bio || <span className="text-gray-600 italic">No bio written yet. Start by editing this section.</span>}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Stats / Quick Info */}
                                <div className="space-y-6">
                                    <div className="p-6 rounded-xl border border-gray-800 bg-[#111]">
                                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-6">Mission Stats</h3>
                                        <div className="space-y-4">
                                            <div className="p-3 rounded-lg bg-[#0a0a0a] border border-gray-800">
                                                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mb-2">Primary Aesthetic</label>
                                                <div className="text-sm font-bold text-gray-200">
                                                    {brandKit.brandDescription || 'Not Defined'}
                                                </div>
                                            </div>
                                            <div className="p-3 rounded-lg bg-[#0a0a0a] border border-gray-800">
                                                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mb-2">A&R Sentiment</label>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1.5 flex-1 bg-gray-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-purple-500" style={{ width: '75%' }} />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-purple-400">75%</span>
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
                                <div className="p-6 rounded-xl border border-gray-800 bg-[#111]">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                                                Color Palette
                                            </h3>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Chromatic Identity</p>
                                        </div>
                                        <button
                                            onClick={handleAddColor}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-[10px] font-bold hover:bg-purple-500 transition-all active:scale-95 border border-purple-500/50"
                                        >
                                            <Plus size={12} />
                                            <span>Add Color</span>
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap gap-4">
                                        {brandKit.colors?.map((color, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="group relative"
                                            >
                                                <div
                                                    className="w-24 h-24 rounded-xl cursor-pointer transition-all transform hover:scale-105 border border-gray-700 overflow-hidden relative ring-offset-[#111] ring-offset-2 hover:ring-2 hover:ring-purple-500/50"
                                                    style={{ backgroundColor: color }}
                                                >
                                                    <input
                                                        type="color"
                                                        value={color}
                                                        onChange={(e) => handleUpdateColor(idx, e.target.value)}
                                                        onBlur={() => saveBrandKit({ colors: brandKit.colors })}
                                                        className="opacity-0 w-full h-full cursor-pointer absolute inset-0"
                                                    />
                                                    <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm p-1.5 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <p className="text-[8px] text-white font-mono uppercase font-bold">{color}</p>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleRemoveColor(idx); }}
                                                            className="text-red-400 hover:text-red-300"
                                                            aria-label={`Remove color ${color}`}
                                                        >
                                                            <Trash2 size={10} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>

                                {/* Typography & Style */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-6 rounded-xl border border-gray-800 bg-[#111]">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            Typography
                                        </h3>
                                        <div className="p-6 bg-[#0a0a0a] rounded-xl border border-gray-800 relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-12 bg-purple-500/5 blur-[40px] rounded-full group-hover:bg-purple-500/10 transition-colors" />
                                            <p className="text-5xl font-bold text-white mb-2 tracking-tight" style={{ fontFamily: brandKit.fonts }}>AaBb</p>
                                            <p className="text-[10px] text-purple-400 font-mono font-bold tracking-widest">{brandKit.fonts || 'Inter'}</p>
                                        </div>
                                        <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wider mt-4">
                                            Global Design System Sync: Active
                                        </p>
                                    </div>
                                    <div className="p-6 rounded-xl border border-gray-800 bg-[#111]">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            Digital Aura
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {['High Fidelity', 'Glassmorphism', 'Cyberpunk', 'Luxury', 'Authentic'].map(tag => (
                                                <span key={tag} className="px-3 py-1.5 bg-[#0a0a0a] border border-gray-800 rounded-lg text-[10px] font-bold text-gray-400 uppercase tracking-wide hover:bg-[#151515] hover:text-gray-200 transition-colors cursor-default">
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
                                className="bg-[#111] rounded-2xl border border-gray-800 overflow-hidden shadow-2xl relative"
                            >
                                <div className="p-8 border-b border-gray-800 bg-[#0a0a0a] relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-32 bg-purple-900/5 blur-[80px] rounded-full pointer-events-none" />
                                    <div className="relative z-10">
                                        <label className="text-[9px] text-purple-500 font-bold uppercase tracking-[0.2em] mb-3 block">Mission Architect</label>
                                        <input
                                            type="text"
                                            value={release.title}
                                            onChange={(e) => handleUpdateRelease('title', e.target.value)}
                                            onBlur={handleSaveRelease}
                                            className="text-5xl md:text-7xl font-bold text-white bg-transparent border-none focus:ring-0 p-0 w-full placeholder:text-gray-800 tracking-tight"
                                            placeholder="MISSION_UNTITLED"
                                        />
                                        <div className="flex flex-wrap items-center gap-4 mt-6">
                                            <div className="flex items-center gap-3 bg-[#151515] border border-gray-800 rounded-lg px-4 py-2">
                                                <Disc size={14} className="text-purple-500" />
                                                <select
                                                    value={release.type}
                                                    onChange={(e) => { handleUpdateRelease('type', e.target.value); handleSaveRelease(); }}
                                                    className="bg-transparent border-none text-xs font-bold text-gray-200 focus:ring-0 p-0 min-w-[60px]"
                                                >
                                                    <option value="Single" className="bg-[#111]">Single</option>
                                                    <option value="EP" className="bg-[#111]">EP</option>
                                                    <option value="Album" className="bg-[#111]">Album</option>
                                                </select>
                                            </div>
                                            <div className="h-4 w-px bg-gray-800 hidden md:block" />
                                            <div className="flex items-center gap-3 bg-[#151515] border border-gray-800 rounded-lg px-4 py-2 flex-1 max-w-sm hover:border-gray-700 transition-colors">
                                                <Hash size={14} className="text-purple-500 opacity-50" />
                                                <input
                                                    type="text"
                                                    value={release.genre}
                                                    onChange={(e) => handleUpdateRelease('genre', e.target.value)}
                                                    onBlur={handleSaveRelease}
                                                    placeholder="Genre (e.g. Neo-Soul)"
                                                    className="bg-transparent border-none text-white focus:ring-0 p-0 text-xs font-bold w-full placeholder:text-gray-600"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-gray-500 mb-2">
                                            <Activity size={12} className="text-red-400" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest">Atmosphere & Mood</span>
                                        </div>
                                        <textarea
                                            value={release.mood}
                                            onChange={(e) => handleUpdateRelease('mood', e.target.value)}
                                            onBlur={handleSaveRelease}
                                            className="w-full h-40 bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 text-xs font-medium text-gray-300 focus:border-purple-500/30 focus:ring-1 focus:ring-purple-500/10 outline-none resize-none custom-scrollbar leading-relaxed"
                                            placeholder="Describe the sonic and visual atmosphere..."
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-gray-500 mb-2">
                                            <Shield size={12} className="text-blue-400" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest">Conceptual Themes</span>
                                        </div>
                                        <textarea
                                            value={release.themes}
                                            onChange={(e) => handleUpdateRelease('themes', e.target.value)}
                                            onBlur={handleSaveRelease}
                                            className="w-full h-40 bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 text-xs font-medium text-gray-300 focus:border-purple-500/30 focus:ring-1 focus:ring-purple-500/10 outline-none resize-none custom-scrollbar leading-relaxed"
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
