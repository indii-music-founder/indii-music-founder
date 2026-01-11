import React, { useState } from 'react';
import { Brush, Wand2, Save, Image as ImageIcon, Play, X, Film, Clapperboard, ChevronDown, Share2, Star, Download, Sparkles } from 'lucide-react';
import { useStore, HistoryItem } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';

interface CanvasHeaderProps {
    isEditing: boolean;
    setIsEditing: (isEditing: boolean) => void;
    isMagicFillMode: boolean;
    magicFillPrompt: string;
    setMagicFillPrompt: (prompt: string) => void;
    handleMagicFill: () => void;
    isProcessing: boolean;
    saveCanvas: () => void;
    item: HistoryItem;
    endFrameItem: { id: string; url: string; prompt: string; type: 'image' | 'video' } | null;
    setEndFrameItem: (item: any) => void;
    setIsSelectingEndFrame: (isSelecting: boolean) => void;
    handleAnimate: () => void;
    onClose: () => void;
    onSendToWorkflow?: (type: 'firstFrame' | 'lastFrame', item: HistoryItem) => void;
    onRefine?: () => void;
}

export const CanvasHeader: React.FC<CanvasHeaderProps> = ({
    isEditing,
    setIsEditing,
    isMagicFillMode,
    magicFillPrompt,
    setMagicFillPrompt,
    handleMagicFill,
    isProcessing,
    saveCanvas,
    item,
    endFrameItem,
    setEndFrameItem,
    setIsSelectingEndFrame,
    handleAnimate,
    onClose,
    onSendToWorkflow,
    onRefine
}) => {
    const toast = useToast();

    return (
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-[#1a1a1a]">
            <div className="flex-1 mr-4 flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                    {isEditing ? "Fabric.js Editor" : "Preview"}
                </h3>
            </div>

            <div className="flex items-center gap-2">
                {!isEditing ? (
                    <>
                        <button
                            onClick={() => { setIsEditing(true); toast.success("Editor mode active"); }}
                            data-testid="edit-canvas-btn"
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Brush size={14} /> Edit in Canvas
                        </button>
                        {onRefine && (
                            <button
                                onClick={onRefine}
                                data-testid="refine-btn"
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Sparkles size={14} /> Refine
                            </button>
                        )}
                    </>
                ) : (
                    <>
                        {isMagicFillMode && (
                            <div className="flex items-center gap-2 mr-4 bg-gray-800 p-1 rounded-lg">
                                <input
                                    type="text"
                                    value={magicFillPrompt}
                                    onChange={(e) => setMagicFillPrompt(e.target.value)}
                                    data-testid="magic-fill-input"
                                    placeholder="Describe changes..."
                                    className="bg-transparent border-none text-white text-sm px-2 focus:ring-0 outline-none w-48"
                                />
                                <button
                                    onClick={handleMagicFill}
                                    data-testid="magic-generate-btn"
                                    disabled={isProcessing}
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded flex items-center gap-1"
                                >
                                    {isProcessing ? <Wand2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                                    Generate
                                </button>
                            </div>
                        )}
                        <div className="relative group">
                            <button
                                onClick={saveCanvas}
                                data-testid="save-canvas-btn"
                                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-l-lg transition-colors flex items-center gap-2"
                            >
                                <Save size={14} /> Save
                            </button>
                            <div className="absolute top-full left-0 mt-1 w-48 bg-[#1f1f1f] border border-gray-700 rounded-lg shadow-xl overflow-hidden hidden group-hover:block z-50">
                                {onSendToWorkflow && (
                                    <>
                                        <button
                                            onClick={() => onSendToWorkflow('firstFrame', item)}
                                            className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:text-white hover:bg-gray-700 flex items-center gap-2"
                                        >
                                            <Film size={14} className="text-blue-400" /> Use as First Frame
                                        </button>
                                        <button
                                            onClick={() => onSendToWorkflow('lastFrame', item)}
                                            className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:text-white hover:bg-gray-700 flex items-center gap-2"
                                        >
                                            <Clapperboard size={14} className="text-green-400" /> Use as Last Frame
                                        </button>
                                        <div className="border-t border-gray-700 my-1"></div>
                                    </>
                                )}
                                <button
                                    onClick={saveCanvas}
                                    className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:text-white hover:bg-gray-700 flex items-center gap-2"
                                >
                                    <Save size={14} /> Save to Gallery
                                </button>
                            </div>
                        </div>
                        {onSendToWorkflow && (
                            <button
                                onClick={() => onSendToWorkflow('firstFrame', item)}
                                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                                title="Send to Video Workflow"
                            >
                                <Film size={14} /> To Video
                            </button>
                        )}
                    </>
                )}

                {!isEditing && item.type === 'image' && (
                    <>
                        {endFrameItem ? (
                            <div className="flex items-center gap-2 bg-gray-800 px-2 py-1 rounded-lg">
                                <img src={endFrameItem.url} alt="End Frame" className="w-6 h-6 rounded object-cover" />
                                <span className="text-xs text-gray-300">End Frame</span>
                                <button onClick={() => setEndFrameItem(null)} className="text-gray-400 hover:text-white">
                                    <X size={12} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsSelectingEndFrame(true)}
                                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                            >
                                <ImageIcon size={14} /> Set Last Frame
                            </button>
                        )}
                        <button
                            onClick={handleAnimate}
                            data-testid="animate-btn"
                            className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Play size={14} /> Animate
                        </button>

                        <div className="flex items-center gap-1 bg-gray-800/50 p-1 rounded-lg border border-gray-700">
                            <button
                                onClick={() => toast.success("Shared!")}
                                className="p-2 hover:bg-blue-900/40 text-gray-400 hover:text-blue-400 rounded-lg transition-colors"
                                title="Share"
                            >
                                <Share2 size={16} />
                            </button>
                            <button
                                onClick={() => toast.success("Added to Favorites!")}
                                className="p-2 hover:bg-yellow-900/40 text-gray-400 hover:text-yellow-400 rounded-lg transition-colors"
                                title="Add to Favorites"
                            >
                                <Star size={16} />
                            </button>
                            <button
                                onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
                                data-testid="download-btn"
                                className="p-2 hover:bg-green-900/40 text-gray-400 hover:text-green-400 rounded-lg transition-colors"
                                title="Download"
                            >
                                <Download size={16} />
                            </button>
                        </div>
                    </>
                )}
                <button
                    onClick={onClose}
                    data-testid="canvas-close-btn"
                    className="p-2 hover:bg-red-900/50 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
};
