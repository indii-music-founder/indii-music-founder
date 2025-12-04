import React from 'react';
import { Brush, Wand2, Save, Image as ImageIcon, Play, X } from 'lucide-react';
import { HistoryItem } from '@/core/store';

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
    onClose
}) => {
    return (
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-[#1a1a1a]">
            <div className="flex-1 mr-4 flex items-center gap-2">
                <h3 className="text-sm font-bold text-white mb-1">
                    {isEditing ? "Fabric.js Editor" : "Preview"}
                </h3>
            </div>
            <div className="flex items-center gap-2">
                {!isEditing ? (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Brush size={14} /> Edit in Canvas
                    </button>
                ) : (
                    <>
                        {isMagicFillMode && (
                            <div className="flex items-center gap-2 mr-4 bg-gray-800 p-1 rounded-lg">
                                <input
                                    type="text"
                                    value={magicFillPrompt}
                                    onChange={(e) => setMagicFillPrompt(e.target.value)}
                                    placeholder="Describe changes..."
                                    className="bg-transparent border-none text-white text-sm px-2 focus:ring-0 outline-none w-48"
                                />
                                <button
                                    onClick={handleMagicFill}
                                    disabled={isProcessing}
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded flex items-center gap-1"
                                >
                                    {isProcessing ? <Wand2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                                    Generate
                                </button>
                            </div>
                        )}
                        <button
                            onClick={saveCanvas}
                            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Save size={14} /> Save / Export
                        </button>
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
                                <ImageIcon size={14} /> Set End Frame
                            </button>
                        )}
                        <button
                            onClick={() => handleAnimate()}
                            className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Play size={14} /> Animate
                        </button>
                    </>
                )}
                <button onClick={onClose} className="p-2 hover:bg-red-900/50 rounded-lg text-gray-400 hover:text-red-400 transition-colors">
                    <X size={18} />
                </button>
            </div>
        </div>
    );
};
