import React, { useState } from 'react';
import { TrendingUp, Loader2, RefreshCw, AlertTriangle, Lightbulb, ThumbsUp, MessageCircle, Share2, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { CampaignAI } from '@/services/marketing/CampaignAIService';
import { CampaignAsset, EngagementPrediction } from '../types';

interface AIPredictionPanelProps {
    campaign: CampaignAsset;
}

export default function AIPredictionPanel({ campaign }: AIPredictionPanelProps) {
    const toast = useToast();

    const [prediction, setPrediction] = useState<EngagementPrediction | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);

    const handlePredict = async () => {
        setIsLoading(true);

        try {
            const result = await CampaignAI.predictEngagement(campaign);
            setPrediction(result);
            toast.success('Prediction generated!');
        } catch (error) {
            console.error('Prediction failed:', error);
            toast.error('Failed to generate prediction. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-emerald-400';
        if (score >= 60) return 'text-yellow-400';
        if (score >= 40) return 'text-orange-400';
        return 'text-red-400';
    };

    const getConfidenceColor = (confidence: 'low' | 'medium' | 'high') => {
        switch (confidence) {
            case 'high': return 'text-emerald-400';
            case 'medium': return 'text-yellow-400';
            case 'low': return 'text-orange-400';
        }
    };

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    if (!prediction) {
        return (
            <div className="bg-black/20 backdrop-blur-xl border border-white/5 rounded-xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-purple-500/20 to-indigo-600/20 rounded-lg border border-white/5">
                            <TrendingUp className="text-purple-400" size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white">AI Prediction</h3>
                            <p className="text-xs text-gray-500">Estimate impact before launch</p>
                        </div>
                    </div>
                </div>

                <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                    Get AI-powered insights on how your campaign might perform.
                </p>

                <button
                    onClick={handlePredict}
                    disabled={isLoading}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="animate-spin" size={16} />
                            Analyzing...
                        </>
                    ) : (
                        <>
                            <TrendingUp size={16} />
                            Predict Performance
                        </>
                    )}
                </button>
            </div>
        );
    }

    return (
        <div className="bg-black/20 backdrop-blur-xl border border-white/5 rounded-xl overflow-hidden shadow-xl">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-b border-white/5"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500/20 to-indigo-600/20 rounded-lg border border-white/5">
                        <TrendingUp className="text-purple-400" size={18} />
                    </div>
                    <div className="text-left">
                        <h3 className="text-sm font-semibold text-white">Prediction</h3>
                        <p className="text-xs text-gray-500">Score: {prediction.overallScore}/100</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            handlePredict();
                        }}
                        className={`p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer text-gray-400 hover:text-white ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
                    >
                        <RefreshCw className={`${isLoading ? 'animate-spin' : ''}`} size={14} />
                    </div>
                    {isExpanded ? (
                        <ChevronUp className="text-gray-400" size={16} />
                    ) : (
                        <ChevronDown className="text-gray-400" size={16} />
                    )}
                </div>
            </button>

            {isExpanded && (
                <div className="p-4 space-y-4">
                    {/* Overall Score */}
                    <div className="flex items-center gap-4 p-4 bg-black/40 rounded-lg border border-white/5">
                        <div className="relative w-16 h-16 flex-shrink-0">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="45"
                                    fill="none"
                                    stroke="#1f2937"
                                    strokeWidth="8"
                                />
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="45"
                                    fill="none"
                                    stroke="url(#scoreGradient)"
                                    strokeWidth="8"
                                    strokeDasharray={`${prediction.overallScore * 2.83} 283`}
                                    strokeLinecap="round"
                                />
                                <defs>
                                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" className={`${prediction.overallScore >= 60 ? 'text-emerald-500' : 'text-orange-500'}`} stopColor="currentColor" />
                                        <stop offset="100%" className={`${prediction.overallScore >= 60 ? 'text-emerald-400' : 'text-amber-400'}`} stopColor="currentColor" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className={`text-xl font-bold ${getScoreColor(prediction.overallScore)}`}>
                                    {prediction.overallScore}
                                </span>
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Est. Reach</p>
                                    <p className="text-sm font-bold text-white truncate">
                                        {formatNumber(prediction.estimatedReach)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Engagement</p>
                                    <p className="text-sm font-bold text-white">
                                        {prediction.estimatedEngagementRate.toFixed(1)}%
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Platform Breakdown */}
                    {prediction.platformBreakdown.length > 0 && (
                        <div>
                            <h4 className="text-[10px] text-gray-500 uppercase font-bold mb-2 tracking-wider">Platform Breakdown</h4>
                            <div className="space-y-2">
                                {prediction.platformBreakdown.map((platform, index) => (
                                    <div
                                        key={index}
                                        className="bg-black/20 border border-white/5 rounded-lg p-3 hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`text-xs font-semibold ${platform.platform === 'Instagram' ? 'text-pink-400' :
                                                platform.platform === 'Twitter' ? 'text-sky-400' :
                                                    'text-indigo-400'
                                                }`}>
                                                {platform.platform}
                                            </span>
                                            <span className={`text-[10px] uppercase font-bold ${getConfidenceColor(platform.confidence)}`}>
                                                {platform.confidence}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-gray-400">
                                            <div className="flex items-center gap-1">
                                                <ThumbsUp size={12} />
                                                <span>{formatNumber(platform.predictedLikes)}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <MessageCircle size={12} />
                                                <span>{formatNumber(platform.predictedComments)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recommendations */}
                    {prediction.recommendations.length > 0 && (
                        <div>
                            <h4 className="text-[10px] text-gray-500 uppercase font-bold mb-2 tracking-wider flex items-center gap-1.5">
                                <Lightbulb size={12} /> Recommendations
                            </h4>
                            <div className="space-y-2">
                                {prediction.recommendations.map((rec, index) => (
                                    <div
                                        key={index}
                                        className="flex items-start gap-2 text-xs text-gray-300 bg-emerald-900/10 border border-emerald-500/10 rounded-lg p-2.5"
                                    >
                                        <span className="text-emerald-400 font-bold block mt-0.5">•</span>
                                        <span className="leading-relaxed">{rec}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Risk Factors */}
                    {prediction.riskFactors.length > 0 && (
                        <div>
                            <h4 className="text-[10px] text-gray-500 uppercase font-bold mb-2 tracking-wider flex items-center gap-1.5">
                                <AlertTriangle size={12} /> Risks
                            </h4>
                            <div className="space-y-2">
                                {prediction.riskFactors.map((risk, index) => (
                                    <div
                                        key={index}
                                        className="flex items-start gap-2 text-xs text-gray-300 bg-red-900/10 border border-red-500/10 rounded-lg p-2.5"
                                    >
                                        <AlertTriangle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
                                        <span className="leading-relaxed">{risk}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

