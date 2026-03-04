import React from 'react';
import { CheckCircle, ArrowRight } from 'lucide-react';

interface ProgressItem {
    key: string;
    label: string;
}

interface ProfileProgressPanelProps {
    coreProgress: number;
    releaseProgress: number;
    coreMissing: string[];
    releaseMissing: string[];
    isReadyForDashboard: boolean;
    onComplete: () => void;
}

const CORE_TOPICS: ProgressItem[] = [
    { key: 'bio', label: 'Bio' },
    { key: 'brandDescription', label: 'Brand Description' },
    { key: 'socials', label: 'Social Links' },
    { key: 'visuals', label: 'Visual Assets' },
    { key: 'careerStage', label: 'Career Stage' },
    { key: 'goals', label: 'Goals' },
    { key: 'colorPalette', label: 'Color Palette' },
    { key: 'typography', label: 'Typography' },
    { key: 'aestheticStyle', label: 'Aesthetic Style' },
];

const RELEASE_TOPICS: ProgressItem[] = [
    { key: 'title', label: 'Release Title' },
    { key: 'type', label: 'Release Type' },
    { key: 'genre', label: 'Genre' },
    { key: 'mood', label: 'Mood' },
    { key: 'themes', label: 'Themes' },
];

export function ProfileProgressPanel({
    coreProgress,
    releaseProgress,
    coreMissing,
    releaseMissing,
    isReadyForDashboard,
    onComplete
}: ProfileProgressPanelProps) {
    return (
        <div className="w-full">
            {/* Identity Progress */}
            <div className="mb-8">
                <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400 font-medium tracking-tight">Core Identity</span>
                    <span className="text-white font-bold">{coreProgress}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div
                        className="h-full bg-white transition-all duration-700 ease-out"
                        style={{ width: `${coreProgress}%` }}
                    />
                </div>
                <div className="mt-4 space-y-2.5">
                    {CORE_TOPICS.map(({ key, label }) => {
                        const isMissing = coreMissing.includes(key);
                        return (
                            <div key={key} className="flex items-center gap-3 text-sm group">
                                {isMissing ? (
                                    <div className="w-5 h-5 rounded-full border-2 border-white/10 flex items-center justify-center transition-colors group-hover:border-white/20">
                                        <div className="w-1.5 h-1.5 rounded-full bg-transparent" />
                                    </div>
                                ) : (
                                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-black">
                                        <CheckCircle size={12} fill="currentColor" className="text-black" />
                                    </div>
                                )}
                                <span className={isMissing ? 'text-gray-500' : 'text-gray-200 font-medium'}>
                                    {label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Release Progress */}
            <div className="mb-8 pt-6 border-t border-white/5">
                <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400 font-medium tracking-tight">Current Release</span>
                    <span className="text-white font-bold">{releaseProgress}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                    <div
                        className="h-full bg-purple-500 transition-all duration-700 ease-out"
                        style={{ width: `${releaseProgress}%` }}
                    />
                </div>
                <div className="mt-4 space-y-2.5">
                    {RELEASE_TOPICS.map(({ key, label }) => {
                        const isMissing = releaseMissing.includes(key);
                        return (
                            <div key={key} className="flex items-center gap-3 text-sm group">
                                {isMissing ? (
                                    <div className="w-5 h-5 rounded-full border-2 border-white/10 flex items-center justify-center transition-colors group-hover:border-white/20">
                                        <div className="w-1.5 h-1.5 rounded-full bg-transparent" />
                                    </div>
                                ) : (
                                    <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-white">
                                        <CheckCircle size={12} fill="currentColor" className="text-white" />
                                    </div>
                                )}
                                <span className={isMissing ? 'text-gray-500' : 'text-gray-200 font-medium'}>
                                    {label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {isReadyForDashboard && (
                <div className="pt-6 border-t border-white/10">
                    <button
                        onClick={onComplete}
                        className="w-full bg-white text-black px-6 py-4 rounded-xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2 group shadow-xl shadow-white/5"
                    >
                        Go to Studio <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                    <p className="text-center text-[10px] text-gray-500 mt-3 font-medium uppercase tracking-widest">You can continue editing later.</p>
                </div>
            )}
        </div>
    );
}
