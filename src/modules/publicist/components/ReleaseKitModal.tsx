import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Send, Copy, Check, FileText, Share2, Mail } from 'lucide-react';
import { PUBLICIST_TOOLS } from '../tools';
import { usePublicist } from '../hooks/usePublicist';
import { type ToolFunctionResult } from '@/services/agent/types';

interface ReleaseKitModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface GeneratedAssets {
    pressRelease: { headline: string; content: string; contactInfo: string };
    socialPosts: { platform: string; content: string; hashtags: string[] }[];
    emailBlast: { subject: string; body: string };
}

export const ReleaseKitModal: React.FC<ReleaseKitModalProps> = ({ isOpen, onClose }) => {
    const [step, setStep] = useState<'input' | 'generating' | 'results'>('input');
    const [formData, setFormData] = useState({
        trackTitle: '',
        artistName: '',
        releaseDate: '',
        musicalStyle: '',
        targetAudience: ''
    });
    const [assets, setAssets] = useState<GeneratedAssets | null>(null);
    const [activeTab, setActiveTab] = useState<'press' | 'social' | 'email'>('press');
    const [copied, setCopied] = useState<string | null>(null);

    const handleGenerate = async () => {
        setStep('generating');
        try {
            const result = await PUBLICIST_TOOLS.generate_campaign_assets({
                trackTitle: formData.trackTitle,
                artistName: formData.artistName,
                releaseDate: formData.releaseDate,
                musicalStyle: formData.musicalStyle.split(',').map(s => s.trim()),
                targetAudience: formData.targetAudience
            });

            if (result.success && result.data) {
                setAssets(result.data as GeneratedAssets);
                setStep('results');
            } else {
                console.error("Generation failed", result);
                setStep('input'); // Reset on failure for now
            }
        } catch (e) {
            console.error(e);
            setStep('input');
        }
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="relative w-full max-w-4xl bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Release Kit Generator</h2>
                                <p className="text-xs text-gray-400">AI-powered press releases, social posts, and email blasts</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        {step === 'input' && (
                            <div className="space-y-6 max-w-xl mx-auto py-8">
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Track Title</label>
                                            <input
                                                type="text"
                                                value={formData.trackTitle}
                                                onChange={e => setFormData({ ...formData, trackTitle: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                                placeholder="e.g. Neon Nights"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Artist Name</label>
                                            <input
                                                type="text"
                                                value={formData.artistName}
                                                onChange={e => setFormData({ ...formData, artistName: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                                placeholder="e.g. Retro Wave"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Release Date</label>
                                        <input
                                            type="date"
                                            value={formData.releaseDate}
                                            onChange={e => setFormData({ ...formData, releaseDate: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Musical Style / Vibe</label>
                                        <input
                                            type="text"
                                            value={formData.musicalStyle}
                                            onChange={e => setFormData({ ...formData, musicalStyle: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                            placeholder="e.g. Synth-pop, 80s nostalgia, energetic"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Target Audience</label>
                                        <textarea
                                            value={formData.targetAudience}
                                            onChange={e => setFormData({ ...formData, targetAudience: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors min-h-[100px]"
                                            placeholder="Who is this song for?"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={handleGenerate}
                                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-indigo-500 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <Sparkles size={18} />
                                    Generate Release Kit
                                </button>
                            </div>
                        )}

                        {step === 'generating' && (
                            <div className="flex flex-col items-center justify-center h-full py-20 space-y-6">
                                <div className="relative">
                                    <div className="w-20 h-20 rounded-full border-4 border-white/10 border-t-purple-500 animate-spin" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Sparkles size={24} className="text-purple-400 animate-pulse" />
                                    </div>
                                </div>
                                <div className="text-center space-y-2">
                                    <h3 className="text-xl font-bold text-white">Crafting Your Campaign</h3>
                                    <p className="text-gray-400">Writing press release, drafting tweets, and composing emails...</p>
                                </div>
                            </div>
                        )}

                        {step === 'results' && assets && (
                            <div className="flex flex-col h-full">
                                <div className="flex gap-4 mb-6 border-b border-white/10 pb-1">
                                    <button
                                        onClick={() => setActiveTab('press')}
                                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'press' ? 'border-purple-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                                    >
                                        Press Release
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('social')}
                                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'social' ? 'border-purple-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                                    >
                                        Social Media
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('email')}
                                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'email' ? 'border-purple-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                                    >
                                        Email Blast
                                    </button>
                                </div>

                                <div className="flex-1 bg-black/20 rounded-xl border border-white/5 p-6 overflow-y-auto">
                                    {activeTab === 'press' && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                            <div className="flex justify-between items-start gap-4">
                                                <div>
                                                    <h3 className="text-2xl font-bold text-white mb-2">{assets.pressRelease.headline}</h3>
                                                    <div className="flex gap-2 mb-4">
                                                        <span className="text-xs bg-white/10 text-gray-300 px-2 py-1 rounded">FOR IMMEDIATE RELEASE</span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => copyToClipboard(assets.pressRelease.headline + '\n\n' + assets.pressRelease.content, 'press')}
                                                    className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                                >
                                                    {copied === 'press' ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                                                </button>
                                            </div>
                                            <div className="prose prose-invert max-w-none">
                                                <p className="whitespace-pre-wrap text-gray-300 leading-relaxed font-serif text-lg">{assets.pressRelease.content}</p>
                                            </div>
                                            <div className="pt-6 border-t border-white/10">
                                                <p className="text-sm text-gray-500 font-bold uppercase">Media Contact</p>
                                                <p className="text-purple-400">{assets.pressRelease.contactInfo}</p>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'social' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2">
                                            {assets.socialPosts.map((post, idx) => (
                                                <div key={idx} className="bg-white/5 rounded-xl p-5 border border-white/5 flex flex-col">
                                                    <div className="flex justify-between items-center mb-4">
                                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{post.platform}</span>
                                                        <button
                                                            onClick={() => copyToClipboard(post.content + ' ' + post.hashtags.join(' '), `post-${idx}`)}
                                                            className="text-gray-500 hover:text-white transition-colors"
                                                        >
                                                            {copied === `post-${idx}` ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                                        </button>
                                                    </div>
                                                    <p className="text-white text-sm whitespace-pre-wrap flex-1 mb-4">{post.content}</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {post.hashtags.map((tag, i) => (
                                                            <span key={i} className="text-xs text-blue-400">{tag}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {activeTab === 'email' && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                            <div className="flex justify-between items-center bg-white/5 p-4 rounded-lg">
                                                <div>
                                                    <p className="text-xs text-gray-500 font-bold uppercase mb-1">Subject Line</p>
                                                    <p className="text-white font-medium">{assets.emailBlast.subject}</p>
                                                </div>
                                                <button
                                                    onClick={() => copyToClipboard(assets.emailBlast.subject + '\n\n' + assets.emailBlast.body, 'email')}
                                                    className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                                >
                                                    {copied === 'email' ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                                                </button>
                                            </div>
                                            <div className="bg-white rounded-lg p-8 text-black shadow-xl">
                                                <div className="prose max-w-none">
                                                    <p className="whitespace-pre-wrap leading-relaxed">{assets.emailBlast.body}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
