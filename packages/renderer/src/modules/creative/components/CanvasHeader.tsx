/* eslint-disable @typescript-eslint/no-explicit-any -- Module component with dynamic data */
import React from 'react';
import { Wand2, Save, Image as ImageIcon, Play, X, Star, Sparkles, Lock, Film } from 'lucide-react';
import { HistoryItem } from '@/core/store';
import { auth } from '@/services/firebase';

interface CanvasHeaderProps {
    // Removed isEditing and setIsEditing as they are no longer used
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
    onCreateLastFrame?: () => void;
    processingStatus?: string;
    isHighFidelity: boolean;
    setIsHighFidelity: (val: boolean) => void;
    batchExportDimensions?: () => void;
}

export const CanvasHeader: React.FC<CanvasHeaderProps> = ({
    // Removed isEditing, setIsEditing
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
    onSendToWorkflow: _onSendToWorkflow,
    onRefine: _onRefine,
    onCreateLastFrame,
    processingStatus,
    isHighFidelity,
    setIsHighFidelity,
    batchExportDimensions
}) => {
    const isAuthenticated = !!auth.currentUser;

    return (
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-background">
            <div className="flex-1 mr-4 flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                    Creative Canvas
                </h3>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 mr-4 bg-gray-900/50 border border-white/5 p-1 px-2 rounded-xl backdrop-blur-md shadow-inner ring-1 ring-white/10 group/magic focus-within:ring-dept-creative/50 transition-all duration-300">
                    <Sparkles size={14} className="text-dept-creative animate-pulse" />
                    <input
                        type="text"
                        value={magicFillPrompt}
                        onChange={(e) => setMagicFillPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleMagicFill()}
                        data-testid="magic-fill-input"
                        placeholder={isMagicFillMode ? "Describe edit for masked area..." : "Describe how to remix the whole image..."}
                        className="bg-transparent border-none text-white text-xs px-2 focus:ring-0 outline-none w-64 placeholder:text-gray-500 font-medium"
                    />
                    <button
                        onClick={handleMagicFill}
                        data-testid="magic-generate-btn"
                        disabled={isProcessing}
                        title={!isAuthenticated ? 'Sign in to use Magic Edit' : 'Refine image with AI'}
                        className={`px-4 py-1.5 text-white text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2 border shadow-lg transition-all active:scale-95 disabled:opacity-50 ${
                            isAuthenticated
                                ? 'bg-dept-creative hover:bg-dept-creative/80 border-white/20 shadow-dept-creative/30'
                                : 'bg-dept-creative/50 border-white/10 shadow-none cursor-help'
                        }`}
                    >
                        {isProcessing ? (
                            <>
                                <Wand2 size={12} className="animate-spin" />
                                <span>{processingStatus || 'Synthesizing'}</span>
                            </>
                        ) : (
                            <>
                                {!isAuthenticated && <Lock size={10} className="opacity-70" />}
                                <Wand2 size={12} />
                                <span>Refine</span>
                            </>
                        )}
                    </button>

                    {/* High Fidelity Toggle */}
                    <button
                        onClick={() => setIsHighFidelity(!isHighFidelity)}
                        title={isHighFidelity ? "Switch to High Speed (Flash)" : "Switch to High Fidelity (Pro)"}
                        className={`p-1.5 px-3 rounded-lg border transition-all flex items-center gap-1.5 ${isHighFidelity
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-500 shadow-lg shadow-amber-500/20 font-bold'
                            : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-white font-medium'
                            }`}
                    >
                        <Star size={12} fill={isHighFidelity ? "currentColor" : "none"} />
                        <span className="text-[10px] uppercase tracking-wider">{isHighFidelity ? "Pro" : "Flash"}</span>
                    </button>
                </div>

                <div className="relative group">
                    <button
                        onClick={batchExportDimensions}
                        disabled={isProcessing}
                        title="Export for all social formats (TikTok, IG, YT)"
                        className="px-4 py-2 bg-dept-marketing/20 hover:bg-dept-marketing/30 border border-dept-marketing/50 text-dept-marketing text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                    >
                        <ImageIcon size={14} /> Multi-Format
                    </button>
                </div>

                <div className="relative group">
                    <button
                        onClick={() => _onSendToWorkflow && _onSendToWorkflow('firstFrame', item)}
                        data-testid="send-to-video-btn"
                        disabled={isProcessing || !_onSendToWorkflow}
                        className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-600/50 text-indigo-400 text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                        title="Send to Video Producer"
                    >
                        <Film size={14} /> Send to Video
                    </button>
                </div>

                <div className="relative group">
                    <button
                        onClick={saveCanvas}
                        data-testid="save-canvas-btn"
                        className="px-4 py-2 bg-dept-licensing hover:bg-dept-licensing/80 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Save size={14} /> Save
                    </button>
                </div>

                {item.type === 'image' && (
                    <>
                        {endFrameItem ? (
                            <div className="flex items-center gap-2 bg-gray-800 px-2 py-1 rounded-lg">
                                <img src={endFrameItem.url} alt="End Frame" className="w-6 h-6 rounded object-cover" />
                                <span className="text-xs text-gray-300">End Frame</span>
                                <button onClick={() => setEndFrameItem(null)} aria-label="Remove end frame" className="text-gray-400 hover:text-white">
                                    <X size={12} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={onCreateLastFrame || (() => setIsSelectingEndFrame(true))}
                                data-testid="create-last-frame-inline-btn"
                                disabled={isProcessing}
                                className="px-3 py-2 bg-dept-creative hover:bg-dept-creative/80 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-dept-creative/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isProcessing && processingStatus ? (
                                    <>
                                        <Wand2 size={14} className="animate-spin" />
                                        <span>{processingStatus}</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={14} />
                                        <span>Create Last Frame</span>
                                    </>
                                )}
                            </button>
                        )}
                        <button
                            onClick={handleAnimate}
                            data-testid="animate-btn"
                            className="px-4 py-2 bg-dept-marketing hover:bg-dept-marketing/80 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Play size={14} /> Animate
                        </button>
                    </>
                )}


                <button
                    onClick={onClose}
                    data-testid="canvas-close-btn"
                    aria-label="Close canvas"
                    className="p-2 hover:bg-red-900/50 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
};
