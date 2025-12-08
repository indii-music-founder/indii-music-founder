
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@/core/store';
import { runOnboardingConversation, processFunctionCalls, calculateProfileStatus } from '@/services/onboarding/onboardingService';
import { Send, CheckCircle, Circle, Sparkles, Paperclip, FileText, Trash2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ConversationFile } from '@/modules/workflow/types';
import { v4 as uuidv4 } from 'uuid';

export default function OnboardingPage() {
    const { userProfile, setUserProfile, setModule } = useStore();
    const [input, setInput] = useState('');
    const [history, setHistory] = useState<{ role: string; parts: { text: string }[] }[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [files, setFiles] = useState<ConversationFile[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial greeting
    useEffect(() => {
        if (history.length === 0) {
            const greeting = "Hi, I'm indii, your Chief Creative Officer. Let's get your profile set up so I can help you better. First, tell me a bit about yourself as an artist. What's your vibe?";
            setHistory([{ role: 'model', parts: [{ text: greeting }] }]);
        }
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const filePromises = Array.from(e.target.files).map(file => {
                return new Promise<ConversationFile>((resolve) => {
                    const isImage = file.type.startsWith('image/');
                    const isText = file.type === 'text/plain' || file.type === 'application/json' || file.type === 'text/markdown';

                    if (isImage) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            resolve({
                                id: uuidv4(),
                                file,
                                preview: e.target?.result as string,
                                type: 'image',
                                base64: (e.target?.result as string)?.split(',')[1]
                            });
                        };
                        reader.readAsDataURL(file);
                    } else if (isText) {
                        file.text().then(text => {
                            resolve({
                                id: uuidv4(),
                                file,
                                preview: '',
                                type: 'document',
                                content: text
                            });
                        });
                    }
                });
            });

            const newFiles = await Promise.all(filePromises);
            setFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removeFile = (id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id));
    };

    const handleSend = async () => {
        if (!input.trim() && files.length === 0) return;

        const userMsg = { role: 'user', parts: [{ text: input }] };
        const newHistory = [...history, userMsg];
        setHistory(newHistory);
        setInput('');
        const currentFiles = [...files];
        setFiles([]); // Clear files after sending
        setIsProcessing(true);

        try {
            const { text, functionCalls } = await runOnboardingConversation(newHistory, userProfile, 'onboarding', currentFiles);

            if (functionCalls && functionCalls.length > 0) {
                const { updatedProfile, isFinished, updates } = processFunctionCalls(functionCalls, userProfile, currentFiles);
                setUserProfile(updatedProfile);

                if (isFinished) {
                    // Handle completion - perhaps offer to go to dashboard
                }

                if (!text && updates.length > 0) {
                    const fallbackText = `I've updated your ${updates.join(', ')}. What else can I help you with?`;
                    setHistory(prev => [...prev, { role: 'model', parts: [{ text: fallbackText }] }]);
                } else if (text) {
                    setHistory(prev => [...prev, { role: 'model', parts: [{ text }] }]);
                } else {
                    setHistory(prev => [...prev, { role: 'model', parts: [{ text: "I processed that, but I'm not sure what to say. Is there anything else?" }] }]);
                }
            } else {
                setHistory(prev => [...prev, { role: 'model', parts: [{ text }] }]);
            }

        } catch (error) {
            console.error("Onboarding error:", error);
            setHistory(prev => [...prev, { role: 'model', parts: [{ text: "Sorry, I ran into a glitch. Can you say that again?" }] }]);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleComplete = () => {
        setModule('dashboard');
    };

    const { coreProgress, releaseProgress, coreMissing, releaseMissing } = calculateProfileStatus(userProfile);
    const isReadyForDashboard = coreProgress > 50; // Threshold for allowing skip/complete

    return (
        <div className="flex h-screen w-full bg-[#0d1117] overflow-hidden">
            {/* Left Panel: Chat */}
            <div className="flex-1 flex flex-col relative">
                {/* Header */}
                <div className="absolute top-0 left-0 right-0 p-6 z-10 flex justify-between items-center bg-gradient-to-b from-[#0d1117] to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                            <Sparkles className="text-white" size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">Setup Your Artist Profile</h1>
                            <p className="text-sm text-gray-400">Chat with indii to build your brand kit</p>
                        </div>
                    </div>
                    {isReadyForDashboard && (
                        <button
                            onClick={handleComplete}
                            className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full font-bold hover:bg-gray-200 transition-colors"
                        >
                            Go to Studio <ArrowRight size={18} />
                        </button>
                    )}
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto px-4 pt-24 pb-4 space-y-6 max-w-3xl mx-auto w-full">
                    {history.map((msg, idx) => (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={idx}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`max-w-[80%] p-4 rounded-2xl ${msg.role === 'user'
                                ? 'bg-white text-black rounded-tr-sm'
                                : 'bg-[#1a1f2e] text-gray-200 rounded-tl-sm border border-gray-800'
                                }`}>
                                <div className="text-base leading-relaxed whitespace-pre-wrap">{msg.parts[0].text}</div>
                            </div>
                        </motion.div>
                    ))}
                    {isProcessing && (
                        <div className="flex justify-start">
                            <div className="bg-[#1a1f2e] text-gray-400 p-4 rounded-2xl rounded-tl-sm border border-gray-800 flex items-center gap-2">
                                <Sparkles size={16} className="animate-spin" /> indii is thinking...
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* File Previews */}
                {files.length > 0 && (
                    <div className="px-4 py-2 bg-[#0d1117]/80 backdrop-blur border-t border-gray-800 flex gap-2 overflow-x-auto max-w-3xl mx-auto w-full">
                        {files.map(file => (
                            <div key={file.id} className="relative group flex-shrink-0 w-16 h-16 bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                                {file.type === 'image' ? (
                                    <img src={file.preview} alt="preview" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <FileText size={24} />
                                    </div>
                                )}
                                <button
                                    onClick={() => removeFile(file.id)}
                                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Input Area */}
                <div className="p-6 bg-[#0d1117] border-t border-gray-800">
                    <div className="max-w-3xl mx-auto flex gap-3">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            className="hidden"
                            multiple
                            accept="image/*,.txt,.md,.json"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-4 text-gray-400 hover:text-white bg-[#1a1f2e] hover:bg-[#252b40] rounded-xl border border-gray-800 transition-colors"
                        >
                            <Paperclip size={24} />
                        </button>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Tell me about your music, style, or upload a bio..."
                            className="flex-1 bg-[#1a1f2e] border border-gray-800 rounded-xl px-6 py-4 text-white focus:border-white/20 focus:outline-none text-lg placeholder:text-gray-600"
                            autoFocus
                        />
                        <button
                            onClick={handleSend}
                            disabled={isProcessing || (!input.trim() && files.length === 0)}
                            className="bg-white hover:bg-gray-200 text-black p-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Send size={24} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Panel: Live Status */}
            <div className="hidden lg:block w-96 bg-[#010409] border-l border-gray-800 p-8 overflow-y-auto">
                <div className="mb-8">
                    <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-6">Profile Completion</h3>

                    {/* Identity Progress */}
                    <div className="mb-8">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-300 font-medium">Core Identity</span>
                            <span className="text-white font-bold">{coreProgress}%</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white transition-all duration-500"
                                style={{ width: `${coreProgress}%` }}
                            />
                        </div>
                        <div className="mt-4 space-y-3">
                            {['bio', 'brandDescription', 'socials', 'visuals'].map(key => {
                                const isMissing = coreMissing.includes(key);
                                return (
                                    <div key={key} className="flex items-center gap-3 text-sm">
                                        {isMissing ? (
                                            <div className="w-5 h-5 rounded-full border-2 border-gray-700 flex items-center justify-center">
                                                <div className="w-full h-full rounded-full bg-transparent" />
                                            </div>
                                        ) : (
                                            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-black">
                                                <CheckCircle size={12} fill="currentColor" className="text-black" />
                                            </div>
                                        )}
                                        <span className={isMissing ? 'text-gray-500' : 'text-gray-200 capitalize font-medium'}>
                                            {key.replace(/([A-Z])/g, ' $1').trim()}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="pt-8 border-t border-gray-800">
                    <h4 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-4">Live Preview</h4>
                    <div className="bg-[#161b22] rounded-xl p-4 border border-gray-800">
                        {userProfile.bio ? (
                            <div className="mb-4">
                                <p className="text-xs text-gray-500 mb-2 uppercase font-bold">Bio</p>
                                <p className="text-sm text-gray-300 leading-relaxed">{userProfile.bio}</p>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-600 italic text-center py-4">Bio will appear here...</p>
                        )}

                        {(userProfile.brandKit.releaseDetails.title || userProfile.brandKit.releaseDetails.genre) && (
                            <div className="mt-4 pt-4 border-t border-gray-700/50">
                                <p className="text-xs text-gray-500 mb-2 uppercase font-bold">Latest Release</p>
                                {userProfile.brandKit.releaseDetails.title && (
                                    <p className="text-sm text-white font-medium mb-1">{userProfile.brandKit.releaseDetails.title}</p>
                                )}
                                <div className="flex gap-2 text-xs">
                                    {userProfile.brandKit.releaseDetails.genre && (
                                        <span className="bg-gray-800 px-2 py-1 rounded text-gray-300">{userProfile.brandKit.releaseDetails.genre}</span>
                                    )}
                                    {userProfile.brandKit.releaseDetails.type && (
                                        <span className="bg-gray-800 px-2 py-1 rounded text-gray-300">{userProfile.brandKit.releaseDetails.type}</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
