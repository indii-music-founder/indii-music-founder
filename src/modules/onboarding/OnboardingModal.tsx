
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../core/store';
import { runOnboardingConversation, processFunctionCalls, calculateProfileStatus } from '../../services/onboarding/onboardingService';
import { X, Send, Upload, CheckCircle, Circle, Sparkles, Paperclip, FileText, Image as ImageIcon, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ConversationFile } from '../../modules/workflow/types';
import { v4 as uuidv4 } from 'uuid';

export const OnboardingModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const { userProfile, setUserProfile } = useStore();
    const [input, setInput] = useState('');
    const [history, setHistory] = useState<{ role: string; parts: { text: string }[] }[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [files, setFiles] = useState<ConversationFile[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial greeting
    useEffect(() => {
        if (isOpen && history.length === 0) {
            const greeting = "Hi, I'm indii, your Chief Creative Officer. Let's get your profile set up so I can help you better. First, tell me a bit about yourself as an artist. What's your vibe?";
            setHistory([{ role: 'model', parts: [{ text: greeting }] }]);
        }
    }, [isOpen]);

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
            // Convert files to base64 if needed (simplified for now, just passing empty array as placeholder)
            // In a real implementation, we'd read the files here.
            // const conversationFiles: any[] = [];

            const { text, functionCalls } = await runOnboardingConversation(newHistory, userProfile, 'onboarding', currentFiles);

            if (functionCalls && functionCalls.length > 0) {
                const { updatedProfile, isFinished, updates } = processFunctionCalls(functionCalls, userProfile, currentFiles);
                setUserProfile(updatedProfile);

                if (updates.length > 0) {
                    // feedback about updates could go here
                }

                if (isFinished) {
                    // Handle completion
                }

                // Fallback: If model did work but didn't speak, speak for it.
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
            // toast.error("Connection glitch. Please try again."); // Assuming toast is available or add it
            setHistory(prev => [...prev, { role: 'model', parts: [{ text: "Sorry, I ran into a glitch. Can you say that again?" }] }]);
        } finally {
            setIsProcessing(false);
        }
    };

    const { coreProgress, releaseProgress, coreMissing, releaseMissing } = calculateProfileStatus(userProfile);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#1a1a1a] border border-gray-800 rounded-2xl w-full max-w-4xl h-[80vh] flex overflow-hidden shadow-2xl"
            >
                {/* Left Panel: Chat */}
                <div className="flex-1 flex flex-col border-r border-gray-800">
                    <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#111]">
                        <div className="flex items-center gap-2">
                            <Sparkles className="text-white" size={20} />
                            <h2 className="font-bold text-white">Brand Kit Builder</h2>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0f0f0f]">
                        {history.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-xl ${msg.role === 'user'
                                    ? 'bg-white text-black rounded-tr-none'
                                    : 'bg-[#222] text-gray-200 rounded-tl-none'
                                    }`}>
                                    {msg.parts[0].text}
                                </div>
                            </div>
                        ))}
                        {isProcessing && (
                            <div className="flex justify-start">
                                <div className="bg-gray-800 text-gray-400 p-3 rounded-xl rounded-tl-none animate-pulse">
                                    indii is thinking...
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* File Previews */}
                    {files.length > 0 && (
                        <div className="px-4 py-2 bg-[#111] border-t border-gray-800 flex gap-2 overflow-x-auto">
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

                    <div className="p-4 bg-[#111] border-t border-gray-800">
                        <div className="flex gap-2">
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
                                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                <Paperclip size={20} />
                            </button>
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Type your answer..."
                                className="flex-1 bg-black border border-[#333] rounded-lg px-4 py-2 text-white focus:border-white outline-none"
                                autoFocus
                            />
                            <button
                                onClick={handleSend}
                                disabled={isProcessing || (!input.trim() && files.length === 0)}
                                className="bg-white hover:bg-gray-200 text-black p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Send size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Status */}
                <div className="hidden md:block w-80 bg-[#111] p-6 overflow-y-auto">
                    <h3 className="text-white font-bold mb-6">Profile Status</h3>

                    {/* Identity Progress */}
                    <div className="mb-8">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-400">Artist Identity</span>
                            <span className="text-white font-bold">{coreProgress}%</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white transition-all duration-500"
                                style={{ width: `${coreProgress}%` }}
                            />
                        </div>
                        <div className="mt-4 space-y-2">
                            {['bio', 'brandDescription', 'socials', 'visuals'].map(key => {
                                const isMissing = coreMissing.includes(key);
                                return (
                                    <div key={key} className="flex items-center gap-2 text-sm">
                                        {isMissing ? (
                                            <Circle size={14} className="text-gray-600" />
                                        ) : (
                                            <CheckCircle size={14} className="text-white" />
                                        )}
                                        <span className={isMissing ? 'text-gray-500' : 'text-gray-300 capitalize'}>
                                            {key.replace(/([A-Z])/g, ' $1').trim()}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Release Progress */}
                    <div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-400">Current Release</span>
                            <span className="text-gray-400 font-bold">{releaseProgress}%</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gray-500 transition-all duration-500"
                                style={{ width: `${releaseProgress}%` }}
                            />
                        </div>
                        <div className="mt-4 space-y-2">
                            {['title', 'type', 'mood', 'themes'].map(key => {
                                const isMissing = releaseMissing.includes(key);
                                return (
                                    <div key={key} className="flex items-center gap-2 text-sm">
                                        {isMissing ? (
                                            <Circle size={14} className="text-gray-600" />
                                        ) : (
                                            <CheckCircle size={14} className="text-white" />
                                        )}
                                        <span className={isMissing ? 'text-gray-500' : 'text-gray-300 capitalize'}>
                                            {key}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Preview of Captured Data */}
                    <div className="mt-8 pt-8 border-t border-gray-800">
                        <h4 className="text-gray-400 text-xs font-bold uppercase mb-4">Live Preview</h4>
                        {userProfile.bio && (
                            <div className="mb-4">
                                <p className="text-xs text-gray-500 mb-1">Bio</p>
                                <p className="text-sm text-gray-300 line-clamp-3">{userProfile.bio}</p>
                            </div>
                        )}
                        {userProfile.brandKit.releaseDetails.title && (
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Active Release</p>
                                <p className="text-sm text-gray-300">
                                    {userProfile.brandKit.releaseDetails.title}
                                    <span className="text-gray-500 ml-1">({userProfile.brandKit.releaseDetails.type})</span>
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
