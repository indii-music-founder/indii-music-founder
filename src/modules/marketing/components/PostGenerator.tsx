import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { Megaphone, Copy, Image as ImageIcon, Loader2, Wand2, Upload } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { AI_MODELS } from '@/core/config/ai-models';
import { AI } from '@/services/ai/AIService';
import { SocialService } from '@/services/social/SocialService';
import AIEnhancePostModal from './AIEnhancePostModal';
import { ScheduledPost, CampaignStatus } from '../types';

interface PostContent {
    platform: string;
    caption: string;
    hashtags: string[];
    imagePrompt: string;
    generatedImageBase64?: string;
}

const PLATFORMS = [
    { id: 'instagram', name: 'Instagram', icon: '📸', maxLength: 2200 },
    { id: 'twitter', name: 'X / Twitter', icon: '🐦', maxLength: 280 },
    { id: 'linkedin', name: 'LinkedIn', icon: '💼', maxLength: 3000 },
    { id: 'tiktok', name: 'TikTok', icon: '🎵', maxLength: 2200 },
];

const VIBES = ['Professional', 'Witty', 'Edgy', 'Wholesome', 'Minimalist', 'Hype'];

export default function PostGenerator() {
    const { userProfile } = useStore();
    const toast = useToast();

    // Form State
    const [platform, setPlatform] = useState(PLATFORMS[0].id);
    const [topic, setTopic] = useState('');
    const [vibe, setVibe] = useState('Professional');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [isScheduling, setIsScheduling] = useState(false);
    const [isEnhanceModalOpen, setIsEnhanceModalOpen] = useState(false);

    // Result State
    const [result, setResult] = useState<PostContent | null>(null);

    const handleGenerate = async () => {
        if (!topic.trim()) {
            toast.error("Please enter a topic or update idea.");
            return;
        }

        setIsGenerating(true);
        setResult(null);

        // Build Context from Brand Kit
        const brand = userProfile?.brandKit;
        const profileAny = userProfile as unknown as Record<string, unknown>;
        const brandAny = brand as unknown as Record<string, unknown>;
        const artistName = (profileAny?.displayName as string) ?? 'Unknown';
        const targetDemo = (brandAny?.targetAudience as string) ?? 'General';
        const brandMood = (brandAny?.visualIdentity as string) ?? 'Neutral';
        const brandContext = brand ? `
            Brand Name: ${artistName}
            Brand Description: ${brand.brandDescription || ''}
            Target Audience: ${targetDemo}
            Brand Tone: ${brandMood}
        ` : '';

        const prompt = `
            You are a Social Media Manager for a Music Artist/Brand.
            
            CONTEXT:
            ${brandContext}

            TASK:
            Create a social media post for ${PLATFORMS.find(p => p.id === platform)?.name}.
            
            INPUT:
            Topic: "${topic}"
            Vibe: "${vibe}"

            OUTPUT FORMAT (JSON Only):
            {
                "caption": "The main text of the post.",
                "hashtags": ["#tag1", "#tag2"],
                "imagePrompt": "A detailed visual art prompt to generate an image for this post."
            }
        `;

        try {
            // Using Gemini 3 for high-throughput generation with native structured output
            const postSchema = {
                type: 'object',
                properties: {
                    caption: { type: 'string' },
                    hashtags: { type: 'array', items: { type: 'string' } },
                    imagePrompt: { type: 'string' }
                },
                required: ['caption', 'hashtags', 'imagePrompt']
            };

            const data = await AI.generateStructuredData<any>(prompt, postSchema as any);

            const caption = data.caption || '';
            const hashtags = Array.isArray(data.hashtags) ? data.hashtags : [];
            const imagePrompt = data.imagePrompt || `Abstract visual for ${topic}`;

            if (caption) {
                const newResult: PostContent = {
                    platform,
                    caption,
                    hashtags,
                    imagePrompt
                };
                setResult(newResult);

                // Auto-trigger image generation
                generateImage(newResult.imagePrompt);
            } else {
                toast.error("Failed to generate valid post format.");
            }

        } catch (error) {
            console.error("Text Gen Error:", error);
            toast.error("Failed to generate post text.");
        } finally {
            setIsGenerating(false);
        }
    };

    const generateImage = async (prompt: string) => {
        setIsGeneratingImage(true);
        try {
            // Using a standard model for image gen
            const base64 = await AI.generateImage({
                model: AI_MODELS.IMAGE.GENERATION,
                prompt: prompt
            });

            setResult((prev: PostContent | null) => prev ? { ...prev, generatedImageBase64: base64 } : null);
        } catch (error) {
            console.error("Image Gen Error:", error);
            toast.error("Failed to generate image. Using text only.");
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard!");
    };

    const handleSchedulePost = async () => {
        if (!result) return;
        setIsScheduling(true);

        try {
            await SocialService.schedulePost({
                platform: (platform.charAt(0).toUpperCase() + platform.slice(1)) as 'Twitter' | 'Instagram' | 'LinkedIn',
                copy: result.caption + "\n\n" + result.hashtags.join(' '),
                imageAsset: {
                    assetType: 'image',
                    title: topic,
                    imageUrl: result.generatedImageBase64 ? `data:image/png;base64,${result.generatedImageBase64}` : '',
                    caption: result.caption
                },
                day: 0,
                scheduledTime: Date.now() + (24 * 60 * 60 * 1000), // Default to tomorrow
            });

            toast.success("Post scheduled for tomorrow!");
            // Optional: reset or redirect
        } catch (error) {
            console.error("Schedule Error:", error);
            toast.error("Failed to schedule post.");
        } finally {
            setIsScheduling(false);
        }
    };



    const handleEnhanceApply = (postId: string, newCopy: string) => {
        if (result) {
            setResult({ ...result, caption: newCopy });
            toast.success("Enhanced copy applied!");
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">

            {/* Left Panel: Inputs */}
            <div className="lg:col-span-4 space-y-6">
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Wand2 className="text-pink-500" size={20} />
                        Content Wizard
                    </h2>

                    {/* Platform Select */}
                    <div className="mb-4">
                        <label className="block text-xs text-gray-500 uppercase font-semibold mb-2">Platform</label>
                        <div className="grid grid-cols-2 gap-2">
                            {PLATFORMS.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setPlatform(p.id)}
                                    className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-all ${platform === p.id
                                        ? 'bg-pink-900/30 border border-pink-500/50 text-pink-200'
                                        : 'bg-[#0d1117] border border-gray-800 text-gray-400 hover:border-gray-600'
                                        }`}
                                >
                                    <span>{p.icon}</span> {p.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Vibe Select */}
                    <div className="mb-4">
                        <label className="block text-xs text-gray-500 uppercase font-semibold mb-2">Vibe</label>
                        <div className="flex flex-wrap gap-2">
                            {VIBES.map(v => (
                                <button
                                    key={v}
                                    onClick={() => setVibe(v)}
                                    className={`px-3 py-1 rounded-full text-xs border transition-all ${vibe === v
                                        ? 'bg-white text-black border-white'
                                        : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'
                                        }`}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Topic Input */}
                    <div className="mb-6">
                        <label className="block text-xs text-gray-500 uppercase font-semibold mb-2">Concept / Topic</label>
                        <textarea
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="e.g., Announcing my new single 'Void Ocean' dropping this Friday..."
                            className="w-full h-32 bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-gray-200 focus:border-pink-500 outline-none resize-none"
                        />
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !topic}
                        className="w-full py-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                Creating Magic...
                            </>
                        ) : (
                            <>
                                <Megaphone size={18} />
                                Generate Post
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Right Panel: Preview */}
            <div className="lg:col-span-8">
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 h-full flex flex-col">
                    <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Preview</h3>

                    {result ? (
                        <div className="flex-1 flex flex-col gap-6 animate-in fade-in duration-500">
                            {/* Image Preview */}
                            <div className="aspect-video bg-[#0d1117] rounded-lg border border-gray-800 flex items-center justify-center overflow-hidden relative group">
                                {isGeneratingImage ? (
                                    <div className="text-center text-pink-400">
                                        <Loader2 size={32} className="animate-spin mx-auto mb-2" />
                                        <span className="text-xs animate-pulse">Designing visual asset...</span>
                                    </div>
                                ) : result.generatedImageBase64 ? (
                                    <>
                                        <img
                                            src={`data:image/png;base64,${result.generatedImageBase64}`}
                                            alt="Generated"
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button className="p-2 bg-white text-black rounded-full hover:scale-110 transition-transform">
                                                <Upload size={20} />
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-gray-600 flex flex-col items-center">
                                        <ImageIcon size={48} className="mb-2 opacity-20" />
                                        <span className="text-xs">No image generated</span>
                                    </div>
                                )}
                            </div>

                            {/* Caption Editor */}
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                    <span>Caption</span>
                                    <button
                                        onClick={() => copyToClipboard(result.caption)}
                                        className="flex items-center gap-1 hover:text-white transition-colors"
                                    >
                                        <Copy size={12} /> Copy
                                    </button>
                                </div>
                                <div className="flex justify-end mb-2">
                                    <button
                                        onClick={() => setIsEnhanceModalOpen(true)}
                                        className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                                    >
                                        <Wand2 size={12} /> Enhance with AI
                                    </button>
                                </div>
                                <textarea
                                    value={result.caption}
                                    onChange={(e) => setResult({ ...result, caption: e.target.value })}
                                    className="w-full h-32 bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-gray-200 focus:border-pink-500 outline-none resize-none"
                                />
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {result.hashtags.map((tag: string) => (
                                        <span key={tag} className="text-xs text-blue-400 bg-blue-900/20 px-2 py-1 rounded">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end pt-4 border-t border-gray-800">
                                <button
                                    onClick={handleSchedulePost}
                                    disabled={isScheduling}
                                    className="px-6 py-2 bg-white hover:bg-gray-200 text-black font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isScheduling && <Loader2 className="animate-spin" size={16} />}
                                    Schedule Post
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-gray-800 rounded-lg">
                            <Megaphone size={48} className="mb-4 opacity-20" />
                            <p className="max-w-xs text-center text-sm">
                                Enter your topic and vibe on the left to generate a tailored social media post with AI.
                            </p>
                        </div>
                    )}
                </div>
            </div>



            {
                isEnhanceModalOpen && result && (
                    <AIEnhancePostModal
                        post={{
                            id: 'temp-preview',
                            // Map lowercase platform id to capitalized Title Case for PublishedPost type (rudimentary mapping)
                            platform: (result.platform === 'twitter' ? 'Twitter' :
                                result.platform === 'instagram' ? 'Instagram' :
                                    result.platform === 'linkedin' ? 'LinkedIn' : 'Twitter') as any, // Default fallback or exact mapping
                            copy: result.caption,
                            imageAsset: {
                                assetType: 'image',
                                title: topic,
                                imageUrl: result.generatedImageBase64 ? `data:image/png;base64,${result.generatedImageBase64}` : '',
                                caption: result.caption
                            },
                            day: 0,
                            status: CampaignStatus.PENDING
                        }}
                        onClose={() => setIsEnhanceModalOpen(false)}
                        onApply={handleEnhanceApply}
                    />
                )
            }

        </div >
    );
}
