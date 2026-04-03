import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import {
    Shield, Palette, Disc, Activity,
    User, Zap, Sparkles, MessageCircle
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { BrandKit } from '@/modules/workflow/types';
import BrandInterview from './BrandInterview';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import { calculateProfileStatus } from '@/services/onboarding/onboardingService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import {
    IdentityPanel,
    VisualsPanel,
    ReleasePanel,
    HealthPanel,
    CareerStageSelector,
} from './brand-manager';
import type { BrandKitWithDefaults, ReleaseDetails } from './brand-manager';

type TabId = 'identity' | 'visuals' | 'release' | 'health' | 'interview';

const BrandManager: React.FC = () => {
    const { userProfile, updateBrandKit, setUserProfile } = useStore(useShallow(state => ({
        userProfile: state.userProfile,
        updateBrandKit: state.updateBrandKit,
        setUserProfile: state.setUserProfile
    })));

    // Tab State
    const [activeTab, setActiveTab] = useState<TabId>('identity');

    // Brand Kit with defaults
    const brandKit: BrandKitWithDefaults = {
        colors: userProfile?.brandKit?.colors || [],
        fonts: userProfile?.brandKit?.fonts || 'Inter',
        brandDescription: userProfile?.brandKit?.brandDescription || '',
        negativePrompt: userProfile?.brandKit?.negativePrompt || '',
        socials: userProfile?.brandKit?.socials || {},
        brandAssets: userProfile?.brandKit?.brandAssets || [],
        referenceImages: userProfile?.brandKit?.referenceImages || [],
        releaseDetails: userProfile?.brandKit?.releaseDetails || { title: '', type: '', artists: '', genre: '', mood: '', themes: '', lyrics: '' },
        healthHistory: userProfile?.brandKit?.healthHistory || [],
        digitalAura: userProfile?.brandKit?.digitalAura || ['High Fidelity', 'Glassmorphism', 'Luxury'],
    };

    const release: ReleaseDetails = brandKit.releaseDetails || { title: '', type: '', artists: '', genre: '', mood: '', themes: '', lyrics: '' };

    // -- PERSISTENCE HELPER --
    const saveBrandKit = async (updates: Partial<BrandKit>) => {
        if (!userProfile || !userProfile.id) return;
        const userRef = doc(db, 'users', userProfile.id);
        const firestoreUpdates: Record<string, BrandKit[keyof BrandKit]> = {};
        Object.keys(updates).forEach(key => {
            firestoreUpdates[`brandKit.${key}`] = updates[key as keyof BrandKit];
        });
        await updateDoc(userRef, firestoreUpdates);
    };

    // Profile completeness for the interview badge
    const { coreProgress, releaseProgress } = calculateProfileStatus(userProfile);
    const profileIncomplete = (coreProgress + releaseProgress) / 2 < 80;

    // Shared props for all tab panels
    const tabProps = {
        userProfile,
        brandKit,
        release,
        updateBrandKit,
        saveBrandKit,
        setUserProfile,
    };

    // Navigation Tabs
    const tabs = [
        { id: 'interview' as const, label: 'Brand Interview', icon: MessageCircle },
        { id: 'identity' as const, label: 'Identity Core', icon: User },
        { id: 'visuals' as const, label: 'Visual DNA', icon: Palette },
        { id: 'release' as const, label: 'Release Manifest', icon: Disc },
        { id: 'health' as const, label: 'Brand Health', icon: Activity },
    ];

    return (
        <ModuleErrorBoundary moduleName="Brand Manager">
            <div className="flex h-screen w-full bg-background text-gray-200 font-sans overflow-hidden selection:bg-dept-marketing/30 relative">
                {/* Global Background Ambience - Toned down for professional feel */}
                <div className="fixed inset-0 pointer-events-none z-0">
                    <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-dept-marketing/5 blur-[150px]" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-dept-marketing/5 blur-[150px]" />
                </div>

                {/* Sidebar Navigation */}
                <aside className="hidden md:flex w-64 border-r border-gray-800 bg-[#0a0a0a] flex-col h-full z-20">
                    {/* Brand Header */}
                    <div className="p-4 border-b border-white/5 flex items-center gap-2 h-14">
                        <Shield className="text-dept-marketing" size={16} />
                        <span className="text-xs font-bold text-white tracking-widest uppercase">Brand HQ</span>
                    </div>

                    {/* Navigation Menu — top of sidebar for visibility */}
                    <div className="px-3 py-3 border-b border-white/5 space-y-0.5">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-1">Manager Menu</div>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
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
                                {tab.id === 'interview' && profileIncomplete && activeTab !== 'interview' && (
                                    <span className="ml-auto w-2 h-2 rounded-full bg-dept-marketing animate-pulse" />
                                )}
                                {activeTab === tab.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-dept-marketing rounded-r-full" />}
                            </button>
                        ))}
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
                </aside>

                {/* Main Area */}
                <main className="flex-1 relative flex flex-col min-w-0 z-10 h-full overflow-hidden">
                    {/* HUD Header */}
                    <header className="h-12 md:h-14 shrink-0 px-4 md:px-6 flex items-center justify-between border-b border-gray-800 bg-[#0a0a0a] z-20">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-gray-400">
                                {tabs.find(t => t.id === activeTab) && React.createElement(tabs.find(t => t.id === activeTab)!.icon, { size: 16, className: "text-dept-marketing" })}
                                <h2 className="text-sm font-bold text-gray-200 tracking-tight">
                                    {tabs.find(t => t.id === activeTab)?.label}
                                </h2>
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 scroll-smooth custom-scrollbar">

                        <AnimatePresence mode="wait">

                            {/* IDENTITY TAB */}
                            {activeTab === 'identity' && <IdentityPanel {...tabProps} />}

                            {/* VISUALS TAB */}
                            {activeTab === 'visuals' && <VisualsPanel {...tabProps} />}

                            {/* RELEASE TAB */}
                            {activeTab === 'release' && <ReleasePanel {...tabProps} />}

                            {/* HEALTH CHECK TAB */}
                            {activeTab === 'health' && <HealthPanel {...tabProps} />}

                            {/* INTERVIEW TAB */}
                            {activeTab === 'interview' && (
                                <motion.div
                                    key="interview"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="h-full -m-4 md:-m-6"
                                >
                                    <BrandInterview />
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
