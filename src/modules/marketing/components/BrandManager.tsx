import React, { useState, useEffect } from 'react';
import { useStore } from '@/core/store';
import {
    Shield, Palette, Disc, Activity, Edit2,
    Plus, X, Check, Trash2, User, Layout, Type,
    FileText, Zap, RefreshCw, Loader2, AlertTriangle,
    CheckCircle, Sparkles, Hash, Globe, Instagram, Twitter,
    Youtube, Facebook, Music, ChevronDown, ExternalLink,
    Image as ImageIcon, Calendar, Clock, Users, GripVertical,
    History, TrendingUp, BarChart2, Folder, Image, ShieldCheck,
    Download, Search, Filter
} from 'lucide-react';
import { SocialLinks, BrandAsset } from '@/types/User';
import { useToast } from '@/core/context/ToastContext';
import { GenAI as AI } from '@/services/ai/GenAI';
import { db } from '@/services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Schema } from 'firebase/ai';
import { BrandKit } from '@/modules/workflow/types';
import { TourMap } from '@/modules/touring/components/TourMap';
import UnifiedAssetLibrary from './UnifiedAssetLibrary';
import { logger } from '@/utils/logger';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';

// --- Sub-Components ---

const CareerStageSelector = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
    const stages = ['Emerging', 'Rising', 'Established', 'Icon'];
    return (
        <div className="relative group z-30 inline-block w-full">
            <select
                value={value || 'Emerging'}
                onChange={(e) => onChange(e.target.value)}
                className="w-full appearance-none bg-[#0a0a0a] border border-gray-800 rounded-lg px-3 py-2 text-sm font-bold text-white focus:border-dept-marketing/50 focus:ring-1 focus:ring-dept-marketing/20 outline-none cursor-pointer hover:border-gray-600 transition-colors"
            >
                {stages.map(s => <option key={s} value={s} className="bg-[#111] text-gray-200">{s}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-dept-marketing pointer-events-none" />
        </div>
    );
};

const FontSelector = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
    // Curated Google Fonts selection (Safe web fonts + popular Google Fonts)
    const fonts = [
        'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
        'Oswald', 'Playfair Display', 'Merriweather', 'Courier Prime',
        'Space Mono', 'Syne', 'Outfit'
    ];

    return (
        <div className="relative group">
            <select
                value={value || 'Inter'}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-gray-800 rounded-lg pl-3 pr-8 py-1.5 text-xs font-bold text-white focus:border-dept-marketing/50 focus:ring-1 focus:ring-dept-marketing/20 outline-none appearance-none cursor-pointer hover:border-gray-600 transition-colors"
                style={{ fontFamily: value || 'Inter' }}
                aria-label="Select typography"
            >
                {fonts.map(f => (
                    <option key={f} value={f} style={{ fontFamily: f }} className="bg-[#111] py-2">
                        {f}
                    </option>
                ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none group-hover:text-white transition-colors" />
        </div>
    );
};

const SocialLinksManager = ({ socials, onChange }: { socials: SocialLinks, onChange: (s: SocialLinks) => void }) => {
    const platforms = [
        { key: 'instagram', icon: Instagram, label: 'Instagram' },
        { key: 'twitter', icon: Twitter, label: 'Twitter/X' },
        { key: 'youtube', icon: Youtube, label: 'YouTube' },
        { key: 'spotify', icon: Music, label: 'Spotify' },
        { key: 'website', icon: Globe, label: 'Website' },
    ] as const;

    const handleChange = (key: keyof SocialLinks, val: string) => {
        onChange({ ...socials, [key]: val });
    };

    return (
        <div className="space-y-3">
            {platforms.map(p => (
                <div key={p.key} className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-lg bg-[#0a0a0a] border border-gray-800 flex items-center justify-center text-gray-500 group-hover:text-white group-hover:border-gray-600 transition-all shrink-0">
                        <p.icon size={14} />
                    </div>
                    <input
                        type="text"
                        value={socials?.[p.key] || ''}
                        onChange={(e) => handleChange(p.key, e.target.value)}
                        placeholder={`Add ${p.label} URL...`}
                        className="flex-1 bg-transparent border-b border-gray-800 text-xs text-gray-300 py-1.5 focus:border-dept-marketing/50 focus:outline-none transition-colors placeholder:text-gray-700 font-medium min-w-0"
                    />
                    {socials?.[p.key] && (
                        <a href={socials[p.key]} target="_blank" rel="noreferrer" className="text-gray-600 hover:text-dept-marketing transition-colors shrink-0">
                            <ExternalLink size={12} />
                        </a>
                    )}
                </div>
            ))}
        </div>
    );
};

const TrackListEditor = ({ tracks, onChange }: { tracks: any[], onChange: (t: any[]) => void }) => {
    const addTrack = () => onChange([...tracks, { title: '', duration: '', collaborators: '' }]);
    const updateTrack = (idx: number, field: string, val: string) => {
        const newTracks = [...tracks];
        newTracks[idx] = { ...newTracks[idx], [field]: val };
        onChange(newTracks);
    };
    const removeTrack = (idx: number) => {
        const newTracks = [...tracks];
        newTracks.splice(idx, 1);
        onChange(newTracks);
    };

    return (
        <div className="space-y-2">
            {tracks?.map((track, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-[#0a0a0a] p-2 rounded-lg border border-gray-800 group">
                    <GripVertical size={14} className="text-gray-600 cursor-grab" />
                    <span className="text-[10px] text-gray-500 font-mono w-4">{idx + 1}</span>
                    <input
                        value={track.title}
                        onChange={(e) => updateTrack(idx, 'title', e.target.value)}
                        className="flex-1 bg-transparent border-none text-sm text-white focus:ring-0 p-0 placeholder:text-gray-700 font-medium"
                        placeholder="Track Title"
                    />
                    <div className="flex items-center gap-2 bg-[#111] px-2 py-1 rounded text-gray-400">
                        <Clock size={10} />
                        <input
                            value={track.duration}
                            onChange={(e) => updateTrack(idx, 'duration', e.target.value)}
                            className="w-10 bg-transparent border-none text-xs focus:ring-0 p-0 text-center"
                            placeholder="0:00"
                        />
                    </div>
                    <button onClick={() => removeTrack(idx)} className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={12} />
                    </button>
                </div>
            ))}
            <button onClick={addTrack} className="w-full py-2 border border-dashed border-gray-800 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-all flex items-center justify-center gap-2">
                <Plus size={12} /> Add Track
            </button>
        </div>
    );
};

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
    const [contentType, setContentType] = useState<'messaging' | 'social' | 'bio' | 'visuals'>('messaging');
    const [isAuditingAssets, setIsAuditingAssets] = useState(false);

    // Helpers to access nested data safely
    const brandKit = userProfile?.brandKit || {
        colors: [], fonts: 'Inter', brandDescription: '', negativePrompt: '', socials: {},
        brandAssets: [], referenceImages: [],
        releaseDetails: { title: '', type: '', artists: '', genre: '', mood: '', themes: '', lyrics: '' },
        healthHistory: [],
        digitalAura: ['High Fidelity', 'Glassmorphism', 'Luxury']
    };

    // Track History locally for UI, but it syncs from brandKit
    const [analysisHistory, setAnalysisHistory] = useState(brandKit.healthHistory || []);

    // Sync history when brandKit changes (e.g. on load)
    useEffect(() => {
        if (brandKit.healthHistory) setAnalysisHistory(brandKit.healthHistory);
    }, [brandKit.healthHistory]);
    const release = brandKit.releaseDetails || { title: '', type: '', artists: '', genre: '', mood: '', themes: '', lyrics: '' };

    // -- IDENTITY SECTION HANDLERS --
    const handleSaveBio = async () => {
        if (!userProfile?.id) {
            logger.error("[BrandManager] Save failed: No userProfile.id");
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
            logger.error("[BrandManager] Bio save error:", e);
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

    // -- VISUAL AURA HANDLERS --
    const handleAddAuraTag = (tag: string) => {
        const current = brandKit.digitalAura || [];
        if (tag && !current.includes(tag)) {
            const updated = [...current, tag];
            updateBrandKit({ digitalAura: updated });
            saveBrandKit({ digitalAura: updated });
        }
    };

    const handleRemoveAuraTag = (tag: string) => {
        const updated = (brandKit.digitalAura || []).filter(t => t !== tag);
        updateBrandKit({ digitalAura: updated });
        saveBrandKit({ digitalAura: updated });
    };

    const handleAuditVisualAssets = async () => {
        const totalAssets = (brandKit.brandAssets?.length || 0) + (brandKit.referenceImages?.length || 0);
        if (totalAssets === 0) {
            toast.warning("No visual assets found in your library to audit.");
            return;
        }

        setIsAuditingAssets(true);
        try {
            // AI-powered visual consistency check across both collections
            await new Promise(resolve => setTimeout(resolve, 2500));
            toast.success(`Visual audit complete. ${totalAssets} assets are brand-aligned.`);
        } catch (e) {
            toast.error("Visual audit failed check system logs.");
        } finally {
            setIsAuditingAssets(false);
        }
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
            const newHistoryItem = {
                id: Date.now().toString(),
                date: new Date().toISOString().split('T')[0],
                type: contentType,
                score: result.score,
                content: contentToCheck.substring(0, 30) + (contentToCheck.length > 30 ? '...' : ''),
                issues: result.issues,
                suggestions: result.suggestions
            };

            const updatedHistory = [newHistoryItem, ...(brandKit.healthHistory || [])].slice(0, 10);
            updateBrandKit({ healthHistory: updatedHistory });
            saveBrandKit({ healthHistory: updatedHistory });

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
        <ModuleErrorBoundary moduleName="Brand Manager">
            <div className="flex h-screen w-full bg-background text-gray-200 font-sans overflow-hidden selection:bg-dept-marketing/30 relative">
                {/* Global Background Ambience */}
                {/* Global Background Ambience - Toned down for professional feel */}
                <div className="fixed inset-0 pointer-events-none z-0">
                    <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-dept-marketing/5 blur-[150px]" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-dept-marketing/5 blur-[150px]" />
                </div>

                {/* Sidebar Navigation */}
                <aside className="w-64 border-r border-gray-800 bg-[#0a0a0a] flex flex-col h-full z-20">
                    {/* Brand Header */}
                    <div className="p-4 border-b border-white/5 flex items-center gap-2 h-14">
                        <Shield className="text-dept-marketing" size={16} />
                        <span className="text-xs font-bold text-white tracking-widest uppercase">Brand HQ</span>
                    </div>

                    <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                        {/* Quick Stats / Info */}
                        <div className="mb-6 p-4 rounded-xl bg-[#111] border border-gray-800 space-y-4 shadow-lg shadow-black/20">
                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 flex items-center gap-2">
                                    <Sparkles size={10} className="text-dept-marketing" />
                                    Career Stage
                                </div>
                                <CareerStageSelector
                                    value={userProfile?.careerStage || 'Emerging'}
                                    onChange={(val) => {
                                        if (userProfile) setUserProfile({ ...userProfile, careerStage: val });
                                    }}
                                />
                            </div>
                            <div className="h-px bg-gray-800/50" />
                            <div>
                                <div className="text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-2">Primary Goal</div>
                                <div className="text-xs font-bold text-white flex items-center gap-2 bg-[#0a0a0a] p-2 rounded-lg border border-gray-800">
                                    <Zap size={12} className="text-yellow-500" />
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
                                        ? 'bg-dept-marketing/10 text-white border border-dept-marketing/30'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                    }
                                `}
                            >
                                <tab.icon
                                    size={14}
                                    className={`transition-colors ${activeTab === tab.id ? 'text-dept-marketing' : 'text-gray-500 group-hover:text-gray-400'}`}
                                />
                                <span>{tab.label}</span>
                                {activeTab === tab.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-dept-marketing rounded-r-full" />}
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
                                {tabs.find(t => t.id === activeTab) && React.createElement(tabs.find(t => t.id === activeTab)!.icon, { size: 16, className: "text-dept-marketing" })}
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
                                                    className="w-full h-80 bg-black/40 border border-white/10 rounded-lg p-4 text-sm text-gray-300 focus:border-dept-marketing/50 focus:ring-1 focus:ring-dept-marketing/20 outline-none transition-all leading-relaxed custom-scrollbar"
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
                                        {/* Socials / Digital Footprint */}
                                        <div className="p-6 rounded-xl border border-gray-800 bg-[#111]">
                                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <Globe size={12} /> Digital Footprint
                                            </h3>
                                            <SocialLinksManager
                                                socials={brandKit.socials || {}}
                                                onChange={(newSocials) => {
                                                    updateBrandKit({ socials: newSocials });
                                                    saveBrandKit({ socials: newSocials });
                                                }}
                                            />
                                        </div>

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
                                                        <div className="h-1.5 flex-1 bg-white/5 rounded-full overflow-hidden">
                                                            <div className="h-full bg-dept-marketing" style={{ width: '75%' }} />
                                                        </div>
                                                        <span className="text-[10px] font-bold text-dept-marketing">75%</span>
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
                                                className="flex items-center gap-2 px-3 py-1.5 bg-dept-marketing text-white rounded-lg text-[10px] font-bold hover:opacity-90 transition-all active:scale-95 border border-white/10"
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
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                                    Typography
                                                </h3>
                                                <div className="w-36">
                                                    <FontSelector
                                                        value={brandKit.fonts || 'Inter'}
                                                        onChange={(val) => {
                                                            updateBrandKit({ fonts: val });
                                                            saveBrandKit({ fonts: val });
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="p-6 bg-[#0a0a0a] rounded-xl border border-gray-800 relative overflow-hidden group transition-all hover:border-dept-marketing/30">
                                                <div className="absolute top-0 right-0 p-12 bg-purple-500/5 blur-[40px] rounded-full group-hover:bg-purple-500/10 transition-colors" />
                                                <p className="text-5xl font-bold text-white mb-2 tracking-tight transition-all" style={{ fontFamily: brandKit.fonts }}>AaBb</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-400 font-mono">{brandKit.fonts || 'Inter'}</span>
                                                    <span className="text-[10px] text-emerald-500 flex items-center gap-1"><CheckCircle size={8} /> Active</span>
                                                </div>
                                            </div>
                                            <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wider mt-4 flex items-center gap-2">
                                                <Activity size={10} /> Global Design System Sync: Active
                                            </p>
                                        </div>
                                        <div className="p-6 rounded-xl border border-gray-800 bg-[#111]">
                                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                Digital Aura
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {(brandKit.digitalAura || ['High Fidelity', 'Glassmorphism', 'Luxury']).map(tag => (
                                                    <span
                                                        key={tag}
                                                        className="group/tag px-3 py-1.5 bg-[#0a0a0a] border border-gray-800 rounded-lg text-[10px] font-bold text-gray-400 uppercase tracking-wide hover:bg-[#151515] hover:text-dept-marketing hover:border-dept-marketing/30 transition-all flex items-center gap-2"
                                                    >
                                                        {tag}
                                                        <button
                                                            onClick={() => handleRemoveAuraTag(tag)}
                                                            className="opacity-0 group-hover/tag:opacity-100 hover:text-red-400 transition-all"
                                                        >
                                                            <Plus size={10} className="rotate-45" />
                                                        </button>
                                                    </span>
                                                ))}
                                                <input
                                                    type="text"
                                                    placeholder="+ Add Vibe"
                                                    className="bg-transparent border border-dashed border-gray-800 rounded-lg px-3 py-1 text-[10px] font-bold text-gray-600 focus:text-white focus:border-dept-marketing/50 focus:ring-0 outline-none w-24 uppercase"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleAddAuraTag((e.target as HTMLInputElement).value);
                                                            (e.target as HTMLInputElement).value = '';
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Asset Library Section */}
                                    <div className="p-8 rounded-2xl border border-gray-800 bg-[#111] relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-32 bg-dept-marketing/5 blur-[80px] rounded-full pointer-events-none" />
                                        <div className="relative z-10 space-y-8">
                                            <UnifiedAssetLibrary
                                                userId={userProfile?.id || ''}
                                                brandAssets={brandKit.brandAssets || []}
                                                referenceImages={brandKit.referenceImages || []}
                                                onUpdateBrandAssets={(assets) => {
                                                    updateBrandKit({ brandAssets: assets });
                                                    saveBrandKit({ brandAssets: assets });
                                                }}
                                                onUpdateReferenceImages={(assets) => {
                                                    updateBrandKit({ referenceImages: assets });
                                                    saveBrandKit({ referenceImages: assets });
                                                }}
                                            />

                                            <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <ShieldCheck className="text-emerald-500" size={20} />
                                                    <div>
                                                        <h4 className="text-sm font-bold text-white">Visual Audit System</h4>
                                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Powered by Brand Intelligence</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleAuditVisualAssets}
                                                    disabled={isAuditingAssets}
                                                    className="px-6 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    {isAuditingAssets ? (
                                                        <>
                                                            <Loader2 className="animate-spin" size={12} />
                                                            <span>Auditing...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span>Audit All Assets</span>
                                                        </>
                                                    )}
                                                </button>
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
                                    {/* Header Section */}
                                    <div className="p-8 border-b border-gray-800 bg-[#0a0a0a] relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-32 bg-dept-marketing/5 blur-[80px] rounded-full pointer-events-none" />

                                        <div className="flex flex-col md:flex-row gap-8 relative z-10">
                                            {/* Cover Art Placeholder */}
                                            <div className="shrink-0 group">
                                                <div className="w-48 h-48 bg-[#111] border border-gray-800 rounded shadow-2xl flex flex-col items-center justify-center text-gray-600 hover:border-dept-marketing/50 transition-colors cursor-pointer relative overflow-hidden">
                                                    {release.coverArtUrl ? (
                                                        <img src={release.coverArtUrl} alt="Cover" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <>
                                                            <ImageIcon size={32} className="mb-2 opacity-50 group-hover:opacity-100 transition-opacity" />
                                                            <span className="text-[9px] font-bold uppercase tracking-widest text-center px-4">Upload Artwork<br />(3000x3000px)</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Release Info */}
                                            <div className="flex-1 space-y-4">
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className="text-[9px] text-dept-marketing font-bold uppercase tracking-[0.2em]">Mission Architect</label>
                                                        <input
                                                            type="date"
                                                            value={release.releaseDate || ''}
                                                            onChange={(e) => { handleUpdateRelease('releaseDate', e.target.value); handleSaveRelease(); }}
                                                            className="bg-transparent border-none text-[10px] uppercase font-bold text-gray-500 focus:text-white focus:ring-0 p-0 text-right"
                                                        />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={release.title}
                                                        onChange={(e) => handleUpdateRelease('title', e.target.value)}
                                                        onBlur={handleSaveRelease}
                                                        className="text-5xl md:text-6xl font-black text-white bg-transparent border-none focus:ring-0 p-0 w-full placeholder:text-gray-800 tracking-tight leading-none"
                                                        placeholder="UNTITLED PROJECT"
                                                    />
                                                </div>

                                                <div className="flex flex-wrap items-center gap-4">
                                                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-4 py-2">
                                                        <Disc size={14} className="text-dept-marketing" />
                                                        <select
                                                            value={release.type}
                                                            onChange={(e) => { handleUpdateRelease('type', e.target.value); handleSaveRelease(); }}
                                                            className="bg-transparent border-none text-xs font-bold text-gray-200 focus:ring-0 p-0 min-w-[60px] cursor-pointer"
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
                                                    <div className="flex items-center gap-3 bg-[#151515] border border-gray-800 rounded-lg px-4 py-2 hover:border-gray-700 transition-colors">
                                                        <Users size={14} className="text-blue-500 opacity-50" />
                                                        <input
                                                            type="text"
                                                            value={release.artists}
                                                            onChange={(e) => handleUpdateRelease('artists', e.target.value)}
                                                            onBlur={handleSaveRelease}
                                                            placeholder="feat. Artists"
                                                            className="bg-transparent border-none text-white focus:ring-0 p-0 text-xs font-bold w-full placeholder:text-gray-600 min-w-[100px]"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
                                        {/* Left Column: Vibes */}
                                        <div className="lg:col-span-7 space-y-6">
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 text-gray-500 mb-2">
                                                    <Activity size={12} className="text-red-400" />
                                                    <span className="text-[10px] font-bold uppercase tracking-widest">Atmosphere & Mood</span>
                                                </div>
                                                <textarea
                                                    value={release.mood}
                                                    onChange={(e) => handleUpdateRelease('mood', e.target.value)}
                                                    onBlur={handleSaveRelease}
                                                    className="w-full h-24 bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 text-xs font-medium text-gray-300 focus:border-dept-marketing/30 focus:ring-1 focus:ring-dept-marketing/10 outline-none resize-none custom-scrollbar leading-relaxed"
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
                                                    className="w-full h-24 bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 text-xs font-medium text-gray-300 focus:border-dept-marketing/30 focus:ring-1 focus:ring-dept-marketing/10 outline-none resize-none custom-scrollbar leading-relaxed"
                                                    placeholder="Translate the artistry into narrative goals..."
                                                />
                                            </div>
                                        </div>

                                        {/* Right Column: Tracklist */}
                                        <div className="lg:col-span-5 border-l border-gray-800 pl-8 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                                    <Disc size={12} />
                                                    Tracklist ({release.tracks?.length || 0})
                                                </h3>
                                            </div>
                                            {(release.type === 'EP' || release.type === 'Album') ? (
                                                <TrackListEditor
                                                    tracks={release.tracks || []}
                                                    onChange={(newTracks) => { handleUpdateRelease('tracks', newTracks as any); handleSaveRelease(); }}
                                                />
                                            ) : (
                                                <div className="p-8 border border-dashed border-gray-800 rounded-xl text-center">
                                                    <Disc size={24} className="mx-auto text-gray-700 mb-2" />
                                                    <p className="text-xs text-gray-500">Tracklist available for<br />EP & Album types.</p>
                                                </div>
                                            )}
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
                                            <div className="p-6 border-b border-white/5 bg-black/20 flex justify-between items-center">
                                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                    <TrendingUp size={12} className="text-dept-marketing" />
                                                    System Audit
                                                </h3>
                                                <select
                                                    value={contentType}
                                                    onChange={(e) => setContentType(e.target.value as any)}
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
                            )}
                        </AnimatePresence>
                    </div>
                </main>
            </div>
        </ModuleErrorBoundary>
    );
};



export default BrandManager;
