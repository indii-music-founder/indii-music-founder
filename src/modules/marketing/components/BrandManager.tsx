import React, { useState, useEffect } from 'react';
import { useStore } from '@/core/store';
import { Shield, Upload, CheckCircle, AlertTriangle, FileText, Loader2, RefreshCw, Palette, Type, Hash, Disc, User, Activity, Edit2, Check, X, Plus, Trash2, Layout, Zap } from 'lucide-react';
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
        // Debounce save in real app, here we just update store immediately
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
        // Construct dot notation keys for specific updates if needed, strictly we just merge entire brandKit in store usually
        // For accurate Firestore patching we might need precise paths, but typically we send the whole object or updated fields
        // Here we try to map the updates to nested fields if possible
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

        // Construct context from profile
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
        { id: 'release', label: 'Current Mission', icon: Disc },
        { id: 'health', label: 'Brand Health', icon: Activity },
    ];

    return (
        <div className="h-full flex flex-col space-y-6">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <Shield className="text-primary" size={32} />
                        Brand HQ
                    </h1>
                    <p className="text-gray-400 mt-1">Manage your artist identity, visual system, and release strategy.</p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-white/10 overflow-x-auto scrollbar-hide">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all relative ${activeTab === tab.id
                                ? 'text-primary'
                                : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        <tab.icon size={18} />
                        <span className="whitespace-nowrap">{tab.label}</span>
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_10px_rgba(255,255,0,0.5)]"
                                initial={false}
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
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
                                <div className="glass-panel p-6 rounded-xl border-l-4 border-l-primary">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                            <FileText size={20} className="text-gray-400" />
                                            Artist Bio
                                        </h3>
                                        {!isEditingBio ? (
                                            <button onClick={() => { setBioDraft(userProfile?.bio || ''); setIsEditingBio(true); }} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                                                <Edit2 size={16} />
                                            </button>
                                        ) : (
                                            <div className="flex gap-2">
                                                <button onClick={() => setIsEditingBio(false)} className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"><X size={16} /></button>
                                                <button onClick={handleSaveBio} className="p-2 hover:bg-green-500/20 rounded-lg text-green-400 transition-colors"><Check size={16} /></button>
                                            </div>
                                        )}
                                    </div>

                                    {isEditingBio ? (
                                        <textarea
                                            value={bioDraft}
                                            onChange={(e) => setBioDraft(e.target.value)}
                                            className="w-full h-64 bg-black/40 border border-white/10 rounded-lg p-4 text-base text-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all leading-relaxed"
                                            placeholder="Tell your story..."
                                        />
                                    ) : (
                                        <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed whitespace-pre-wrap">
                                            {userProfile?.bio || <span className="text-gray-600 italic">No bio written yet. Start by editing this section.</span>}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Stats / Quick Info */}
                            <div className="space-y-6">
                                <div className="glass-panel p-6 rounded-xl">
                                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Vitals</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">Career Stage</label>
                                            <div className="px-3 py-2 bg-white/5 rounded-lg text-white border border-white/10">
                                                {userProfile?.careerStage || 'Unspecified'}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">Primary Goal</label>
                                            <div className="px-3 py-2 bg-white/5 rounded-lg text-white border border-white/10 flex items-center gap-2">
                                                <Zap size={14} className="text-yellow-500" />
                                                {userProfile?.goals?.[0] || 'World Domination'}
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
                            <div className="glass-panel p-6 rounded-xl">
                                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                                    <Palette size={20} className="text-blue-400" />
                                    Color Palette
                                </h3>
                                <div className="flex flex-wrap gap-4">
                                    {brandKit.colors?.map((color, idx) => (
                                        <div key={idx} className="group relative">
                                            <div
                                                className="w-24 h-24 rounded-2xl shadow-lg cursor-pointer transition-transform transform hover:scale-105 border border-white/10 overflow-hidden relative"
                                                style={{ backgroundColor: color }}
                                            >
                                                <input
                                                    type="color"
                                                    value={color}
                                                    onChange={(e) => handleUpdateColor(idx, e.target.value)}
                                                    onBlur={() => saveBrandKit({ colors: brandKit.colors })}
                                                    className="opacity-0 w-full h-full cursor-pointer absolute inset-0"
                                                />
                                            </div>
                                            <div className="mt-2 text-center">
                                                <p className="text-xs text-gray-400 font-mono uppercase">{color}</p>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveColor(idx)}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={handleAddColor}
                                        className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-700 flex flex-col items-center justify-center text-gray-500 hover:text-white hover:border-gray-500 transition-all gap-2"
                                    >
                                        <Plus size={24} />
                                        <span className="text-xs font-semibold">Add</span>
                                    </button>
                                </div>
                            </div>

                            {/* Typography & Style */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="glass-panel p-6 rounded-xl">
                                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                        <Type size={20} className="text-purple-400" />
                                        Typography
                                    </h3>
                                    <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                                        <p className="text-4xl font-bold text-white mb-2" style={{ fontFamily: brandKit.fonts }}>Aa</p>
                                        <p className="text-sm text-gray-400 font-mono">{brandKit.fonts || 'Inter'}</p>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-4">
                                        Fonts are currently managed via the Global Design System options.
                                    </p>
                                </div>
                                <div className="glass-panel p-6 rounded-xl">
                                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                        <Layout size={20} className="text-green-400" />
                                        Aesthetic Style
                                    </h3>
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap gap-2">
                                            {/* We could pull these from a real aesthetic tag list if available */}
                                            {['Clean', 'Minimalist', 'Modern', 'Dark Mode'].map(tag => (
                                                <span key={tag} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-gray-300">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* RELEASE TAB */}
                    {activeTab === 'release' && (
                        <motion.div
                            key="release"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="bg-gradient-to-br from-gray-900 to-black rounded-xl border border-white/10 overflow-hidden"
                        >
                            <div className="p-8 border-b border-white/10 bg-white/5 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-32 bg-purple-600/20 blur-[100px] rounded-full pointer-events-none" />
                                <div className="relative z-10">
                                    <label className="text-xs text-purple-400 font-bold uppercase tracking-widest mb-2 block">Active Mission</label>
                                    <input
                                        type="text"
                                        value={release.title}
                                        onChange={(e) => handleUpdateRelease('title', e.target.value)}
                                        onBlur={handleSaveRelease}
                                        className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500 bg-transparent border-none focus:ring-0 p-0 w-full placeholder:text-gray-800"
                                        placeholder="UNTITLED"
                                    />
                                    <div className="flex items-center gap-4 mt-4">
                                        <select
                                            value={release.type}
                                            onChange={(e) => { handleUpdateRelease('type', e.target.value); handleSaveRelease(); }}
                                            className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-sm text-gray-300 focus:border-purple-500 outline-none"
                                        >
                                            <option value="Single">Single</option>
                                            <option value="EP">EP</option>
                                            <option value="Album">Album</option>
                                        </select>
                                        <div className="h-4 w-px bg-white/20" />
                                        <input
                                            type="text"
                                            value={release.genre}
                                            onChange={(e) => handleUpdateRelease('genre', e.target.value)}
                                            onBlur={handleSaveRelease}
                                            placeholder="Genre (e.g. Hyperpop)"
                                            className="bg-transparent border-none text-gray-400 focus:text-white focus:ring-0 p-0 text-sm w-48"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                                        <Activity size={16} />
                                        <span className="text-sm font-semibold uppercase tracking-wider">Mood & Vibe</span>
                                    </div>
                                    <textarea
                                        value={release.mood}
                                        onChange={(e) => handleUpdateRelease('mood', e.target.value)}
                                        onBlur={handleSaveRelease}
                                        className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-gray-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none"
                                        placeholder="Describe the emotional atmosphere..."
                                    />
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                                        <Hash size={16} />
                                        <span className="text-sm font-semibold uppercase tracking-wider">Themes & Topics</span>
                                    </div>
                                    <textarea
                                        value={release.themes}
                                        onChange={(e) => handleUpdateRelease('themes', e.target.value)}
                                        onBlur={handleSaveRelease}
                                        className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-gray-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none"
                                        placeholder="What is this release about?"
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
                            className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-250px)]" // Fixed height calculation for layout
                        >
                            <div className="lg:col-span-2 flex flex-col gap-4 h-full">
                                <div className="glass-panel p-1 rounded-xl flex-1 flex flex-col overflow-hidden">
                                    <h3 className="text-sm font-semibold text-gray-400 p-4 border-b border-white/5 uppercase tracking-wider flex justify-between items-center">
                                        Content Inspector
                                        {contentToCheck && (
                                            <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-gray-300">{contentToCheck.length} chars</span>
                                        )}
                                    </h3>
                                    <textarea
                                        value={contentToCheck}
                                        onChange={(e) => setContentToCheck(e.target.value)}
                                        placeholder="Paste caption, email, or lyrics here..."
                                        className="flex-1 w-full bg-transparent p-4 text-sm text-gray-200 resize-none focus:outline-none"
                                    />
                                    <div className="p-4 border-t border-white/5 bg-black/20">
                                        <button
                                            onClick={handleAnalyze}
                                            disabled={isAnalyzing || !contentToCheck}
                                            className="w-full py-3 bg-primary text-black font-bold rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_15px_rgba(255,255,0,0.2)]"
                                        >
                                            {isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                                            Run Analysis
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="lg:col-span-3 h-full">
                                {analysisResult ? (
                                    <div className="glass-panel p-6 rounded-xl h-full overflow-y-auto space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h2 className="text-2xl font-bold text-white mb-1">Consistency Report</h2>
                                                <p className="text-sm text-gray-400">Based on your Brand Identity & Release Profile</p>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-4xl font-black ${analysisResult.score > 80 ? 'text-green-500' : 'text-yellow-500'}`}>
                                                    {analysisResult.score}%
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                                                <h4 className="text-red-400 font-semibold mb-3 flex items-center gap-2">
                                                    <AlertTriangle size={16} />
                                                    Detected Issues
                                                </h4>
                                                <ul className="space-y-2">
                                                    {analysisResult.issues.map((issue, i) => (
                                                        <li key={i} className="text-sm text-red-200/80 flex gap-2">
                                                            <span className="opacity-50">•</span> {issue}
                                                        </li>
                                                    ))}
                                                    {analysisResult.issues.length === 0 && <li className="text-sm text-gray-500 italic">No issues found.</li>}
                                                </ul>
                                            </div>
                                            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                                                <h4 className="text-green-400 font-semibold mb-3 flex items-center gap-2">
                                                    <CheckCircle size={16} />
                                                    Improvements
                                                </h4>
                                                <ul className="space-y-2">
                                                    {analysisResult.suggestions.map((sug, i) => (
                                                        <li key={i} className="text-sm text-green-200/80 flex gap-2">
                                                            <span className="opacity-50">•</span> {sug}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="glass-panel rounded-xl h-full flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-white/5 p-8 text-center bg-white//[0.02]">
                                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                                            <Activity size={40} className="opacity-40" />
                                        </div>
                                        <h3 className="text-xl font-semibold text-white mb-2">Ready to Inspect</h3>
                                        <p className="max-w-md mx-auto text-sm leading-relaxed opacity-60">
                                            Paste your marketing copy or content on the left to analyze it against your brand's voice, tone, and goals.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default BrandManager;
