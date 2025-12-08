import React, { useState, useRef } from 'react';
import { ArrowRight, Loader2, Paperclip, Camera, Mic, Image, ChevronUp, X } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { agentService } from '@/services/agent/AgentService';
import { agentRegistry } from '@/services/agent/registry';
import { useStore } from '@/core/store';
import { getColorForModule } from '../theme/moduleColors';
import { motion, AnimatePresence } from 'framer-motion';

import { voiceService } from '@/services/ai/VoiceService';

export default function CommandBar() {
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [openDelegate, setOpenDelegate] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const { currentModule, setModule, toggleAgentWindow, isAgentOpen } = useStore();
    const colors = getColorForModule(currentModule);

    const toast = useToast();

    const handleDelegate = (moduleId: string) => {
        if (moduleId !== 'dashboard') {
            setModule(moduleId as any);
        }

        if (!isAgentOpen) {
            toggleAgentWindow();
        }
        setOpenDelegate(false);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            setAttachments(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() && attachments.length === 0) return;

        setIsProcessing(true);
        // Ensure agent window (chat overlay) is open when sending a message
        if (!isAgentOpen) {
            toggleAgentWindow();
        }

        try {
            // Check if current module is a known agent
            const knownAgents = agentRegistry.getAll().map(a => a.id);
            const targetAgent = knownAgents.includes(currentModule) ? currentModule : undefined;

            // Process attachments
            const processedAttachments = await Promise.all(attachments.map(async (file) => {
                return new Promise<{ mimeType: string; base64: string }>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        resolve({
                            mimeType: file.type,
                            base64
                        });
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }));

            await agentService.sendMessage(input, processedAttachments.length > 0 ? processedAttachments : undefined, targetAgent);

            setInput('');
            setAttachments([]);
            setIsProcessing(false);
        } catch (error) {
            console.error("CommandBar error:", error);
            toast.error("Failed to send message.");
            setIsProcessing(false);
        }
    };

    return (
        <div className="w-full bg-[#0d1117] border-t border-white/10 p-4">
            <div className="max-w-4xl mx-auto">
                {/* Input Area */}
                <div
                    className={`bg-[#161b22] border rounded-xl transition-all ${colors.border} ${colors.ring} focus-within:ring-1 relative overflow-hidden ${isDragging ? 'ring-4 ring-blue-500/50 bg-blue-500/20' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {/* Drag Overlay */}
                    <AnimatePresence>
                        {isDragging && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                className="absolute inset-0 z-50 flex items-center justify-center bg-blue-900/40 backdrop-blur-md border-2 border-dashed border-blue-400 rounded-xl m-1 shadow-[0_0_30px_rgba(59,130,246,0.3)]"
                            >
                                <div className="text-center animate-bounce">
                                    <div className="bg-blue-500/20 p-5 rounded-full mx-auto mb-3 w-20 h-20 flex items-center justify-center border border-blue-400/30">
                                        <Paperclip size={40} className="text-blue-300" />
                                    </div>
                                    <p className="text-white font-bold text-xl tracking-wide drop-shadow-md">DROP FILES HERE</p>
                                    <p className="text-blue-200 text-sm mt-1">Images, Documents, Audio</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={isDragging ? "" : "Describe your task, drop files, or take a picture..."}
                            className="w-full bg-transparent text-gray-200 placeholder-gray-600 px-4 py-3 outline-none rounded-t-xl"
                        />

                        {/* Attachments Preview */}
                        {attachments.length > 0 && (
                            <div className="px-4 pb-2 flex gap-2 flex-wrap">
                                {attachments.map((file, index) => (
                                    <div key={index} className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded text-xs text-gray-300 border border-white/10">
                                        {file.type.startsWith('image/') ? <Image size={12} /> : <Paperclip size={12} />}
                                        <span className="max-w-[150px] truncate">{file.name}</span>
                                        <button type="button" onClick={() => removeAttachment(index)} className="hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors">
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Toolbar */}
                        <div className="flex items-center justify-between px-2 pb-2">
                            <div className="flex items-center gap-1">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    multiple
                                />
                                <input
                                    type="file"
                                    ref={cameraInputRef}
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    accept="image/*"
                                    capture="environment"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors"
                                >
                                    <Paperclip size={14} />
                                    <span className="hidden sm:inline">Attach</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 hover:text-blue-300 transition-all shadow-sm"
                                    title="Take a picture"
                                >
                                    <Camera size={14} />
                                    <span className="text-xs font-medium">Camera</span>
                                </button>
                                <div className="h-4 w-[1px] bg-white/10 mx-1"></div>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setOpenDelegate(!openDelegate)}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors"
                                    >
                                        <span>Delegate to {currentModule === 'dashboard' || currentModule === 'select-org' ? 'Indii' : currentModule.charAt(0).toUpperCase() + currentModule.slice(1)}</span>
                                        <ChevronUp size={12} className={`transition-transform ${openDelegate ? 'rotate-180' : ''}`} />
                                    </button>

                                    <AnimatePresence>
                                        {openDelegate && (
                                            <>
                                                <div
                                                    className="fixed inset-0 z-40"
                                                    onClick={() => setOpenDelegate(false)}
                                                />
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 10 }}
                                                    className="absolute bottom-full left-0 mb-2 w-64 bg-[#1a1a1a] border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[300px]"
                                                >
                                                    <div className="overflow-y-auto custom-scrollbar">
                                                        <div className="p-1">
                                                            <button
                                                                onClick={() => handleDelegate('dashboard')}
                                                                className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
                                                            >
                                                                <div className="w-2 h-2 rounded-full bg-gray-500" />
                                                                Indii (Chief of Staff)
                                                            </button>
                                                        </div>

                                                        <div className="border-t border-gray-800 my-1" />

                                                        <div className="p-2">
                                                            <p className="text-[10px] font-bold text-gray-500 uppercase px-2 mb-1">Manager's Office</p>
                                                            {agentRegistry.getAll()
                                                                .filter(agent => agent.category === 'manager' || agent.category === 'specialist')
                                                                .map(agent => (
                                                                    <button
                                                                        key={agent.id}
                                                                        onClick={() => handleDelegate(agent.id)}
                                                                        className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
                                                                    >
                                                                        <div className={`w-1.5 h-1.5 rounded-full ${agent.color}`} />
                                                                        {agent.name}
                                                                    </button>
                                                                ))}
                                                        </div>

                                                        <div className="border-t border-gray-800 my-1" />

                                                        <div className="p-2">
                                                            <p className="text-[10px] font-bold text-gray-500 uppercase px-2 mb-1">Departments</p>
                                                            {agentRegistry.getAll()
                                                                .filter(agent => agent.category === 'department')
                                                                .map(dept => (
                                                                    <button
                                                                        key={dept.id}
                                                                        onClick={() => handleDelegate(dept.id)}
                                                                        className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
                                                                    >
                                                                        <div className={`w-1.5 h-1.5 rounded-full ${dept.color}`} />
                                                                        {dept.name}
                                                                    </button>
                                                                ))}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            </>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (isListening) {
                                            voiceService.stopListening();
                                            setIsListening(false);
                                        } else {
                                            if (voiceService.isSupported()) {
                                                setIsListening(true);
                                                voiceService.startListening((text) => {
                                                    setInput(prev => prev + (prev ? ' ' : '') + text);
                                                    setIsListening(false);
                                                }, () => setIsListening(false));
                                            } else {
                                                toast.error("Voice input not supported in this browser.");
                                            }
                                        }
                                    }}
                                    className={`p-1.5 rounded-lg transition-colors ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
                                >
                                    <Mic size={14} />
                                </button>
                                <button
                                    type="submit"
                                    disabled={(!input.trim() && attachments.length === 0) || isProcessing}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
                                >
                                    {isProcessing ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <>
                                            Run
                                            <ArrowRight size={14} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                <div className="flex justify-end mt-2">
                    <span className="text-[10px] text-gray-600 flex items-center gap-1">
                        <span className="text-yellow-500">✦</span> Powered by Gemini
                    </span>
                </div>
            </div>
        </div>
    );
}
