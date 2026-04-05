import React from 'react';
import { Lightbulb, Zap, BookOpen, Image, Music, Clock, DollarSign, FileCheck } from 'lucide-react';
import { getDistributorRequirements } from '@/services/onboarding/distributorRequirements';

// --- Multiple Choice Renderer ---
interface MultipleChoiceRendererProps {
    options: string[];
    hasBeenAnswered: boolean;
    onSelect: (option: string) => void;
}

export const MultipleChoiceRenderer = ({ options, hasBeenAnswered, onSelect }: MultipleChoiceRendererProps) => {
    return (
        <div className="mt-4 flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {options.map((option: string) => (
                <button
                    key={option}
                    onClick={() => !hasBeenAnswered && onSelect(option)}
                    disabled={hasBeenAnswered}
                    className={`px-4 py-2 rounded-lg text-sm transition-all ${hasBeenAnswered
                        ? 'bg-white/5 border border-white/5 text-gray-600 cursor-not-allowed opacity-50'
                        : 'bg-white/10 hover:bg-white hover:text-black border border-white/10 transform hover:scale-[1.02] active:scale-[0.98]'
                        }`}
                >
                    {option}
                </button>
            ))}
        </div>
    );
};

// --- Industry Insight Card ---
interface IndustryInsightCardProps {
    insight: string;
    action_suggestion?: string;
}

export const IndustryInsightCard = ({ insight, action_suggestion }: IndustryInsightCardProps) => (
    <div className="mt-4 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-lg shadow-amber-900/5">
        <div className="flex items-start gap-4">
            <div className="p-2.5 bg-amber-500/10 rounded-lg border border-amber-500/30">
                <Lightbulb size={20} className="text-amber-400" />
            </div>
            <div className="flex-1">
                <p className="text-[10px] text-amber-500/80 font-bold uppercase tracking-[0.15em] mb-1.5">Industry Strategy</p>
                <p className="text-sm text-gray-200 leading-relaxed font-medium">{insight}</p>
                {action_suggestion && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-amber-400/90 font-semibold italic bg-amber-500/5 py-1.5 px-3 rounded-lg border border-amber-500/10 w-fit">
                        <span>→</span> {action_suggestion}
                    </div>
                )}
            </div>
        </div>
    </div>
);

// --- Creative Direction Card ---
interface CreativeDirectionCardProps {
    suggestion: string;
    rationale: string;
    examples?: string[];
}

export const CreativeDirectionCard = ({ suggestion, rationale, examples }: CreativeDirectionCardProps) => (
    <div className="mt-4 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border border-purple-500/20 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-lg shadow-purple-900/5">
        <div className="flex items-start gap-4">
            <div className="p-2.5 bg-purple-500/10 rounded-lg border border-purple-500/30">
                <Zap size={20} className="text-purple-400" />
            </div>
            <div className="flex-1">
                <p className="text-[10px] text-purple-500/80 font-bold uppercase tracking-[0.15em] mb-1.5">Creative Evolution</p>
                <p className="text-sm text-gray-200 leading-relaxed font-medium">{suggestion}</p>
                <p className="text-xs text-gray-400/80 mt-2.5 leading-relaxed">{rationale}</p>
                {examples && examples.length > 0 && (
                    <div className="flex gap-2 mt-4 flex-wrap">
                        {examples.map((ex: string, idx: number) => (
                            <span key={idx} className="text-[10px] uppercase font-bold tracking-wider bg-purple-500/10 text-purple-300 px-2.5 py-1 rounded-md border border-purple-500/20">
                                {ex}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    </div>
);

// --- Distributor Info Card ---
interface DistributorInfoCardProps {
    distributorName: string;
}

export const DistributorInfoCard = ({ distributorName }: DistributorInfoCardProps) => {
    const distro = getDistributorRequirements(distributorName);
    if (!distro) return null;

    return (
        <div className="mt-4 bg-gradient-to-br from-cyan-500/10 via-cyan-500/5 to-transparent border border-cyan-500/20 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-lg shadow-cyan-900/5">
            <div className="flex items-start gap-4 mb-5 border-b border-cyan-500/10 pb-4">
                <div className="p-2.5 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
                    <BookOpen size={20} className="text-cyan-400" />
                </div>
                <div>
                    <p className="text-[10px] text-cyan-500/80 font-bold uppercase tracking-[0.15em] mb-1">{distro.name} Protocol</p>
                    <p className="text-[11px] text-gray-400 font-medium">Critical requirements for your next release</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                        <Image size={14} className="text-cyan-400" />
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Cover Art</span>
                    </div>
                    <p className="text-[11px] text-gray-200 font-medium">{distro.coverArt.minSize} - {distro.coverArt.maxSize}</p>
                    <p className="text-[10px] text-gray-500 mt-1 font-medium">{distro.coverArt.format} • {distro.coverArt.colorMode}</p>
                </div>

                <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                        <Music size={14} className="text-cyan-400" />
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Audio Spec</span>
                    </div>
                    <p className="text-[11px] text-gray-200 font-medium">{distro.audio.format}</p>
                    <p className="text-[10px] text-gray-500 mt-1 font-medium">{distro.audio.sampleRate} / {distro.audio.bitDepth}</p>
                </div>

                <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock size={14} className="text-cyan-400" />
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Lead Time</span>
                    </div>
                    <p className="text-[11px] text-gray-200 font-medium">{distro.timeline.minLeadTime}</p>
                    <p className="text-[10px] text-gray-500 mt-1 font-medium">{distro.timeline.reviewTime} review</p>
                </div>

                <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                        <DollarSign size={14} className="text-cyan-400" />
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Economics</span>
                    </div>
                    <p className="text-[11px] text-gray-200 font-medium">{distro.pricing.artistPayout}</p>
                    <p className="text-[10px] text-gray-500 mt-1 font-medium">{distro.pricing.model}</p>
                </div>
            </div>

            <div className="bg-white/[0.03] rounded-xl p-3 mb-5 border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                    <FileCheck size={14} className="text-cyan-400" />
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Required Metadata</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {distro.metadata.requiredFields.slice(0, 8).map((field, idx) => (
                        <span key={idx} className="text-[9px] uppercase font-bold tracking-wider bg-cyan-500/10 text-cyan-300 px-2 py-1 rounded-md border border-cyan-500/20">
                            {field}
                        </span>
                    ))}
                </div>
            </div>

            {distro.proTips.length > 0 && (
                <div className="border-t border-cyan-500/10 pt-4">
                    <p className="text-[10px] text-cyan-500/80 font-bold uppercase tracking-[0.15em] mb-2.5">Distributor Insights</p>
                    <ul className="space-y-2">
                        {distro.proTips.slice(0, 3).map((tip, idx) => (
                            <li key={idx} className="text-xs text-gray-400/90 flex items-start gap-3 leading-relaxed">
                                <span className="text-cyan-500 font-bold">→</span>
                                {tip}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
