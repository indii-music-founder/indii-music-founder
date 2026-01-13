import React, { useState } from 'react';
import { X, Sparkles, Loader2, Calendar, Target, Users, MessageSquare, RefreshCw, Check } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { CampaignAI } from '@/services/marketing/CampaignAIService';
import {
    CampaignBrief,
    CampaignAsset,
    GeneratedCampaignPlan,
    CampaignObjective,
    CampaignTone,
    Platform
} from '../types';

interface AIGenerateCampaignModalProps {
    onClose: () => void;
    onSave: (campaign: CampaignAsset) => void;
}

const OBJECTIVES: { id: CampaignObjective; label: string; description: string }[] = [
    { id: 'launch', label: 'Launch', description: 'New release or product launch' },
    { id: 'awareness', label: 'Awareness', description: 'Build brand visibility' },
    { id: 'engagement', label: 'Engagement', description: 'Increase fan interaction' },
    { id: 'conversion', label: 'Conversion', description: 'Drive specific actions' }
];

const TONES: { id: CampaignTone; label: string }[] = [
    { id: 'professional', label: 'Professional' },
    { id: 'casual', label: 'Casual' },
    { id: 'edgy', label: 'Edgy' },
    { id: 'inspirational', label: 'Inspirational' }
];

const PLATFORMS: { id: Platform; label: string; icon: string }[] = [
    { id: 'Instagram', label: 'Instagram', icon: '📸' },
    { id: 'Twitter', label: 'X / Twitter', icon: '🐦' },
    { id: 'LinkedIn', label: 'LinkedIn', icon: '💼' }
];

export default function AIGenerateCampaignModal({ onClose, onSave }: AIGenerateCampaignModalProps) {
    const toast = useToast();

    // Form state
    const [topic, setTopic] = useState('');
    const [objective, setObjective] = useState<CampaignObjective>('launch');
    const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['Instagram', 'Twitter']);
    const [durationDays, setDurationDays] = useState(7);
    const [postsPerDay, setPostsPerDay] = useState(1);
    const [tone, setTone] = useState<CampaignTone>('professional');
    const [targetAudience, setTargetAudience] = useState('');

    // Generation state
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedPlan, setGeneratedPlan] = useState<GeneratedCampaignPlan | null>(null);
    const [startDate, setStartDate] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    });

    const togglePlatform = (platform: Platform) => {
        setSelectedPlatforms(prev =>
            prev.includes(platform)
                ? prev.filter(p => p !== platform)
                : [...prev, platform]
        );
    };

    const handleGenerate = async () => {
        if (!topic.trim()) {
            toast.error('Please enter a topic for your campaign');
            return;
        }
        if (selectedPlatforms.length === 0) {
            toast.error('Please select at least one platform');
            return;
        }

        setIsGenerating(true);
        setGeneratedPlan(null);

        const brief: CampaignBrief = {
            topic,
            objective,
            platforms: selectedPlatforms,
            durationDays,
            postsPerDay,
            tone,
            targetAudience: targetAudience || undefined
        };

        try {
            const plan = await CampaignAI.generateCampaign(brief);
            setGeneratedPlan(plan);
            toast.success('Campaign plan generated!');
        } catch (error) {
            // console.error('Generation failed:', error);
            toast.error('Failed to generate campaign. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = () => {
        if (!generatedPlan) return;

        const campaign = CampaignAI.planToCampaignAsset(generatedPlan, startDate);
        onSave(campaign);
        toast.success('Campaign created!');
        onClose();
    };

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div className="bg-[#161b22] border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg">
                            <Sparkles className="text-white" size={20} />
                        </div>
                        <div>
                            <h2 id="modal-title" className="text-lg font-bold text-white">AI Campaign Generator</h2>
                            <p className="text-sm text-gray-500">Create a complete campaign with AI</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                        aria-label="Close"
                    >
                        <X className="text-gray-400" size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {!generatedPlan ? (
                        /* Form View */
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left Column - Main Settings */}
                            <div className="space-y-6">
                                {/* Topic */}
                                <div>
                                    <label htmlFor="campaign-topic" className="block text-xs text-gray-500 uppercase font-semibold mb-2">
                                        Campaign Topic *
                                    </label>
                                    <textarea
                                        id="campaign-topic"
                                        value={topic}
                                        onChange={(e) => setTopic(e.target.value)}
                                        placeholder="e.g., New album 'Midnight Dreams' release, upcoming tour dates, new merch drop..."
                                        className="w-full h-24 bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-gray-200 focus:border-pink-500 outline-none resize-none"
                                    />
                                </div>

                                {/* Objective */}
                                <div>
                                    <label className="block text-xs text-gray-500 uppercase font-semibold mb-2 flex items-center gap-2">
                                        <Target size={14} /> Objective
                                    </label>
                                    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Objective">
                                        {OBJECTIVES.map(obj => (
                                            <button
                                                key={obj.id}
                                                onClick={() => setObjective(obj.id)}
                                                role="radio"
                                                aria-checked={objective === obj.id}
                                                className={`p-3 rounded-lg text-left transition-all ${objective === obj.id
                                                    ? 'bg-pink-900/30 border border-pink-500/50'
                                                    : 'bg-[#0d1117] border border-gray-800 hover:border-gray-600'
                                                    }`}
                                            >
                                                <div className={`text-sm font-medium ${objective === obj.id ? 'text-pink-200' : 'text-gray-300'}`}>
                                                    {obj.label}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">{obj.description}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Platforms */}
                                <div>
                                    <label className="block text-xs text-gray-500 uppercase font-semibold mb-2">
                                        Platforms *
                                    </label>
                                    <div className="flex gap-2" role="group" aria-label="Platforms">
                                        {PLATFORMS.map(platform => (
                                            <button
                                                key={platform.id}
                                                onClick={() => togglePlatform(platform.id)}
                                                aria-pressed={selectedPlatforms.includes(platform.id)}
                                                className={`flex-1 py-2 px-3 rounded-lg text-sm flex items-center justify-center gap-2 transition-all ${selectedPlatforms.includes(platform.id)
                                                    ? 'bg-pink-900/30 border border-pink-500/50 text-pink-200'
                                                    : 'bg-[#0d1117] border border-gray-800 text-gray-400 hover:border-gray-600'
                                                    }`}
                                            >
                                                <span>{platform.icon}</span>
                                                <span className="hidden sm:inline">{platform.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column - Additional Settings */}
                            <div className="space-y-6">
                                {/* Duration & Posts */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="campaign-duration" className="block text-xs text-gray-500 uppercase font-semibold mb-2 flex items-center gap-2">
                                            <Calendar size={14} /> Duration (days)
                                        </label>
                                        <select
                                            id="campaign-duration"
                                            value={durationDays}
                                            onChange={(e) => setDurationDays(Number(e.target.value))}
                                            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-gray-200 focus:border-pink-500 outline-none"
                                        >
                                            <option value={3}>3 days</option>
                                            <option value={7}>7 days</option>
                                            <option value={14}>14 days</option>
                                            <option value={30}>30 days</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="campaign-posts" className="block text-xs text-gray-500 uppercase font-semibold mb-2">
                                            Posts/Day
                                        </label>
                                        <select
                                            id="campaign-posts"
                                            value={postsPerDay}
                                            onChange={(e) => setPostsPerDay(Number(e.target.value))}
                                            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-gray-200 focus:border-pink-500 outline-none"
                                        >
                                            <option value={1}>1 post</option>
                                            <option value={2}>2 posts</option>
                                            <option value={3}>3 posts</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Tone */}
                                <div>
                                    <label className="block text-xs text-gray-500 uppercase font-semibold mb-2 flex items-center gap-2">
                                        <MessageSquare size={14} /> Tone
                                    </label>
                                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tone">
                                        {TONES.map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => setTone(t.id)}
                                                role="radio"
                                                aria-checked={tone === t.id}
                                                className={`px-4 py-2 rounded-full text-sm border transition-all ${tone === t.id
                                                    ? 'bg-white text-black border-white'
                                                    : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'
                                                    }`}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Target Audience */}
                                <div>
                                    <label htmlFor="campaign-audience" className="block text-xs text-gray-500 uppercase font-semibold mb-2 flex items-center gap-2">
                                        <Users size={14} /> Target Audience (optional)
                                    </label>
                                    <input
                                        id="campaign-audience"
                                        type="text"
                                        value={targetAudience}
                                        onChange={(e) => setTargetAudience(e.target.value)}
                                        placeholder="e.g., Gen Z music lovers, indie rock fans..."
                                        className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-gray-200 focus:border-pink-500 outline-none"
                                    />
                                </div>

                                {/* Start Date */}
                                <div>
                                    <label htmlFor="campaign-start" className="block text-xs text-gray-500 uppercase font-semibold mb-2">
                                        Start Date
                                    </label>
                                    <input
                                        id="campaign-start"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-gray-200 focus:border-pink-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Preview View */
                        <div className="space-y-6">
                            {/* Plan Header */}
                            <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-6">
                                <h3 className="text-xl font-bold text-white mb-2">{generatedPlan.title}</h3>
                                <p className="text-gray-400 text-sm">{generatedPlan.description}</p>
                                <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                                    <span>{generatedPlan.posts.length} posts</span>
                                    <span>{durationDays} days</span>
                                    <span>{selectedPlatforms.join(', ')}</span>
                                </div>
                            </div>

                            {/* Posts Preview */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-400 uppercase mb-3">Post Preview</h4>
                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                                    {generatedPlan.posts.slice(0, 10).map((post, index) => (
                                        <div
                                            key={index}
                                            className="bg-[#0d1117] border border-gray-800 rounded-lg p-4"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400">
                                                        Day {post.day}
                                                    </span>
                                                    <span className={`text-xs px-2 py-1 rounded ${post.platform === 'Instagram' ? 'bg-pink-900/30 text-pink-300' :
                                                        post.platform === 'Twitter' ? 'bg-blue-900/30 text-blue-300' :
                                                            'bg-indigo-900/30 text-indigo-300'
                                                        }`}>
                                                        {post.platform}
                                                    </span>
                                                </div>
                                                {post.bestTimeToPost && (
                                                    <span className="text-xs text-gray-500">{post.bestTimeToPost}</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-300 line-clamp-2">{post.copy}</p>
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {post.hashtags.slice(0, 5).map((tag, i) => (
                                                    <span key={i} className="text-xs text-blue-400">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {generatedPlan.posts.length > 10 && (
                                        <p className="text-center text-gray-500 text-sm py-2">
                                            +{generatedPlan.posts.length - 10} more posts...
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-gray-800 bg-[#0d1117]">
                    {generatedPlan ? (
                        <>
                            <button
                                onClick={() => setGeneratedPlan(null)}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                            >
                                <RefreshCw size={16} />
                                Regenerate
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold rounded-lg transition-all flex items-center gap-2"
                            >
                                <Check size={16} />
                                Create Campaign
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || !topic.trim() || selectedPlatforms.length === 0}
                                className="px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="animate-spin" size={16} />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={16} />
                                        Generate Campaign
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
