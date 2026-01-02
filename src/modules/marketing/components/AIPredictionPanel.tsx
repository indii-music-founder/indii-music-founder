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
        if (score >= 80) return 'text-green-400';
        if (score >= 60) return 'text-yellow-400';
        if (score >= 40) return 'text-orange-400';
        return 'text-red-400';
    };

    const getScoreGradient = (score: number) => {
        if (score >= 80) return 'from-green-500 to-emerald-500';
        if (score >= 60) return 'from-yellow-500 to-amber-500';
        if (score >= 40) return 'from-orange-500 to-amber-500';
        return 'from-red-500 to-orange-500';
    };

    const getConfidenceColor = (confidence: 'low' | 'medium' | 'high') => {
        switch (confidence) {
            case 'high': return 'text-green-400';
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
            <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                            <TrendingUp className="text-white" size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white">AI Performance Prediction</h3>
                            <p className="text-xs text-gray-500">Estimate engagement before launch</p>
                        </div>
                    </div>
                </div>

                <p className="text-sm text-gray-400 mb-4">
                    Get AI-powered predictions on how your campaign might perform across different platforms.
                </p>

                <button
                    onClick={handlePredict}
                    disabled={isLoading}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="animate-spin" size={16} />
                            Analyzing Campaign...
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
        <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-[#1c2128] transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                        <TrendingUp className="text-white" size={18} />
                    </div>
                    <div className="text-left">
                        <h3 className="text-sm font-semibold text-white">Performance Prediction</h3>
                        <p className="text-xs text-gray-500">Score: {prediction.overallScore}/100</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handlePredict();
                        }}
                        disabled={isLoading}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <RefreshCw className={`text-gray-400 ${isLoading ? 'animate-spin' : ''}`} size={16} />
                    </button>
                    {isExpanded ? (
                        <ChevronUp className="text-gray-400" size={20} />
                    ) : (
                        <ChevronDown className="text-gray-400" size={20} />
                    )}
                </div>
            </button>

            {isExpanded && (
                <div className="p-4 pt-0 space-y-4">
                    {/* Overall Score */}
                    <div className="flex items-center gap-4 p-4 bg-[#0d1117] rounded-lg">
                        <div className="relative w-20 h-20">
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
                                        <stop offset="0%" className={`${prediction.overallScore >= 60 ? 'text-green-500' : 'text-orange-500'}`} stopColor="currentColor" />
                                        <stop offset="100%" className={`${prediction.overallScore >= 60 ? 'text-emerald-500' : 'text-amber-500'}`} stopColor="currentColor" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className={`text-2xl font-bold ${getScoreColor(prediction.overallScore)}`}>
                                    {prediction.overallScore}
                                </span>
                            </div>
                        </div>
                        <div className="flex-1">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Est. Reach</p>
                                    <p className="text-lg font-semibold text-white">
                                        {formatNumber(prediction.estimatedReach)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Engagement Rate</p>
                                    <p className="text-lg font-semibold text-white">
                                        {prediction.estimatedEngagementRate.toFixed(1)}%
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Platform Breakdown */}
                    {prediction.platformBreakdown.length > 0 && (
                        <div>
                            <h4 className="text-xs text-gray-500 uppercase font-semibold mb-2">Platform Breakdown</h4>
                            <div className="space-y-2">
                                {prediction.platformBreakdown.map((platform, index) => (
                                    <div
                                        key={index}
                                        className="bg-[#0d1117] border border-gray-800 rounded-lg p-3"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`text-sm font-medium ${platform.platform === 'Instagram' ? 'text-pink-400' :
                                                platform.platform === 'Twitter' ? 'text-blue-400' :
                                                    'text-indigo-400'
                                                }`}>
                                                {platform.platform}
                                            </span>
                                            <span className={`text-xs ${getConfidenceColor(platform.confidence)}`}>
                                                {platform.confidence} confidence
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <div className="flex items-center gap-1 text-gray-400">
                                                <ThumbsUp size={14} />
                                                <span>{formatNumber(platform.predictedLikes)}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-gray-400">
                                                <MessageCircle size={14} />
                                                <span>{formatNumber(platform.predictedComments)}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-gray-400">
                                                <Share2 size={14} />
                                                <span>{formatNumber(platform.predictedShares)}</span>
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
                            <h4 className="text-xs text-gray-500 uppercase font-semibold mb-2 flex items-center gap-2">
                                <Lightbulb size={14} /> Recommendations
                            </h4>
                            <div className="space-y-2">
                                {prediction.recommendations.map((rec, index) => (
                                    <div
                                        key={index}
                                        className="flex items-start gap-2 text-sm text-gray-300 bg-[#0d1117] border border-gray-800 rounded-lg p-3"
                                    >
                                        <span className="text-green-400 flex-shrink-0">+</span>
                                        <span>{rec}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Risk Factors */}
                    {prediction.riskFactors.length > 0 && (
                        <div>
                            <h4 className="text-xs text-gray-500 uppercase font-semibold mb-2 flex items-center gap-2">
                                <AlertTriangle size={14} /> Risk Factors
                            </h4>
                            <div className="space-y-2">
                                {prediction.riskFactors.map((risk, index) => (
                                    <div
                                        key={index}
                                        className="flex items-start gap-2 text-sm text-gray-300 bg-orange-900/10 border border-orange-500/20 rounded-lg p-3"
                                    >
                                        <AlertTriangle size={14} className="text-orange-400 flex-shrink-0 mt-0.5" />
                                        <span>{risk}</span>
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
