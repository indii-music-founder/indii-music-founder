import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'framer-motion';
import { Paperclip, X, Trash2, Send, ExternalLink, Minimize2, Maximize2, AlertCircle } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { SendToTarget } from '@/types/handoff';

const getCurrentTime = () => Date.now();

export default function CreativeClipboard() {
    const toast = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    const {
        clipboardItems,
        unpinFromClipboard,
        clearClipboard,
        sendToModule
    } = useStore(useShallow(state => ({
        clipboardItems: state.clipboardItems || [],
        unpinFromClipboard: state.unpinFromClipboard,
        clearClipboard: state.clearClipboard,
        sendToModule: state.sendToModule
    })));

    const handleSendTo = React.useCallback((target: SendToTarget, item: any) => {
        sendToModule(target, {
            assetId: item.id,
            assetUrl: item.url,
            assetType: item.type,
            prompt: item.prompt || 'Clipboard Asset',
            originModule: 'creative',
            timestamp: getCurrentTime()
        });
        toast.success(`Sent to ${target.toUpperCase()}! Redirecting...`);
        setActiveDropdown(null);
    }, [sendToModule, toast]);

    if (clipboardItems.length === 0) {
        return null;
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
            <AnimatePresence>
                {!isOpen ? (
                    // Collapsed Indicator
                    <motion.button
                        layoutId="clipboard-container"
                        onClick={() => setIsOpen(true)}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="pointer-events-auto flex items-center gap-2 px-4 py-3 bg-[#0d0d11]/90 backdrop-blur-xl border border-white/10 hover:border-violet-500/50 rounded-full shadow-[0_8px_32px_rgba(139,92,246,0.15)] transition-all group"
                    >
                        <Paperclip size={16} className="text-violet-400 group-hover:rotate-12 transition-transform" />
                        <span className="text-xs font-semibold text-gray-200 tracking-wide">
                            Visual Dock ({clipboardItems.length})
                        </span>
                        <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                    </motion.button>
                ) : (
                    // Expanded Dock Panel
                    <motion.div
                        layoutId="clipboard-container"
                        className="pointer-events-auto w-96 max-h-[460px] flex flex-col bg-[#0d0d11]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.5)] overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center px-4 py-3 bg-white/5 border-b border-white/5">
                            <div className="flex items-center gap-2">
                                <Paperclip size={14} className="text-violet-400" />
                                <span className="text-xs font-bold text-gray-200 uppercase tracking-widest">
                                    Creative Asset Clipboard
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => clearClipboard()}
                                    title="Clear Clipboard"
                                    className="p-1 hover:bg-white/10 text-gray-400 hover:text-red-400 rounded transition-colors"
                                >
                                    <Trash2 size={13} />
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 hover:bg-white/10 text-gray-400 hover:text-white rounded transition-colors"
                                >
                                    <Minimize2 size={13} />
                                </button>
                            </div>
                        </div>

                        {/* List container */}
                        <div className="flex-1 p-3 overflow-y-auto custom-scrollbar flex flex-col gap-2 max-h-[340px]">
                            {clipboardItems.map((item) => (
                                <div
                                    key={item.id}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('text/plain', JSON.stringify({
                                            id: item.id,
                                            url: item.url,
                                            type: item.type,
                                            prompt: item.prompt
                                        }));
                                    }}
                                    className="group relative flex items-center gap-3 p-2 bg-white/[0.02] border border-white/5 hover:border-violet-500/20 rounded-lg transition-all cursor-grab active:cursor-grabbing"
                                >
                                    {/* Thumbnail Preview */}
                                    <div className="w-16 h-12 bg-black rounded overflow-hidden border border-white/10 flex-shrink-0 relative">
                                        {item.type === 'video' ? (
                                            <video src={item.url} className="w-full h-full object-cover" muted loop />
                                        ) : (
                                            <img src={item.url} alt="thumbnail" className="w-full h-full object-cover" />
                                        )}
                                        <div className="absolute bottom-0.5 right-0.5 px-1 py-0.2 bg-black/75 rounded text-[7px] text-gray-400 uppercase font-mono">
                                            {item.type}
                                        </div>
                                    </div>

                                    {/* Title/Prompt metadata */}
                                    <div className="flex-1 min-w-0 pr-12">
                                        <p className="text-[11px] font-mono text-gray-300 truncate">
                                            {item.prompt || 'Untitled Asset'}
                                        </p>
                                        <p className="text-[8px] text-gray-500">
                                            Drag onto Canvas to import
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="absolute right-2 flex gap-1">
                                        {/* Send To Button */}
                                        <div className="relative">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveDropdown(activeDropdown === item.id ? null : item.id);
                                                }}
                                                className={`p-1.5 rounded transition-all ${
                                                    activeDropdown === item.id
                                                        ? 'bg-violet-600 text-white'
                                                        : 'bg-white/5 hover:bg-violet-600/20 text-gray-300 hover:text-violet-400'
                                                }`}
                                                title="Send to workspace"
                                            >
                                                <Send size={11} />
                                            </button>

                                            {/* Dropdown Options */}
                                            {activeDropdown === item.id && (
                                                <div className="absolute bottom-8 right-0 bg-[#0d0d11] border border-white/15 rounded-lg shadow-xl py-1 w-36 z-55 overflow-hidden">
                                                    <div className="px-2.5 py-1 text-[8px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5">
                                                        Destinations
                                                    </div>
                                                    <button
                                                        onClick={() => handleSendTo('merch', item)}
                                                        className="w-full text-left px-2.5 py-1.5 text-[10px] text-gray-300 hover:bg-violet-600/20 hover:text-violet-300 transition-colors flex items-center justify-between"
                                                    >
                                                        <span>Merch Designer</span>
                                                        <ExternalLink size={8} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleSendTo('marketing', item)}
                                                        className="w-full text-left px-2.5 py-1.5 text-[10px] text-gray-300 hover:bg-violet-600/20 hover:text-violet-300 transition-colors flex items-center justify-between"
                                                    >
                                                        <span>Campaign Kit</span>
                                                        <ExternalLink size={8} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleSendTo('boardroom', item)}
                                                        className="w-full text-left px-2.5 py-1.5 text-[10px] text-gray-300 hover:bg-violet-600/20 hover:text-violet-300 transition-colors flex items-center justify-between"
                                                    >
                                                        <span>Boardroom Deck</span>
                                                        <ExternalLink size={8} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleSendTo('touring', item)}
                                                        className="w-full text-left px-2.5 py-1.5 text-[10px] text-gray-300 hover:bg-violet-600/20 hover:text-violet-300 transition-colors flex items-center justify-between"
                                                    >
                                                        <span>Tour Tech Rider</span>
                                                        <ExternalLink size={8} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Remove Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                unpinFromClipboard(item.id);
                                            }}
                                            className="p-1.5 bg-white/5 hover:bg-red-500/20 text-gray-300 hover:text-red-400 rounded transition-all"
                                            title="Unpin item"
                                        >
                                            <X size={11} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Subtle Footer */}
                        <div className="px-4 py-2 border-t border-white/5 bg-white/[0.01] flex items-center justify-between text-[9px] text-gray-500 font-mono">
                            <span>{clipboardItems.length} items collected</span>
                            <span className="animate-pulse flex items-center gap-1">
                                <AlertCircle size={9} className="text-violet-500" />
                                HTML5 Drop Active
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
