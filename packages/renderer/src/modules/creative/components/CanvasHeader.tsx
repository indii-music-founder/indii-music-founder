import React from 'react';
import { ArrowLeft, Lock, MonitorUp, Sparkles, Star, Wand2, Shield } from 'lucide-react';
import { auth } from '@/services/firebase';

interface CanvasHeaderProps {
    isMagicFillMode: boolean;
    magicFillPrompt: string;
    setMagicFillPrompt: (prompt: string) => void;
    handleMagicFill: () => void;
    isProcessing: boolean;
    processingStatus?: string;
    isHighFidelity: boolean;
    setIsHighFidelity: (val: boolean) => void;
    modelTier?: 'fast' | 'pro';
    resolution?: string;
    aspectRatio?: string;
    grounding?: boolean;
    imageSize?: string;
    // ISSUE-1390: the editor overlay must always offer an explicit path back
    // to the canvas. Before this prop the only exit was the CanvasActionRail
    // close button, which is desktop-only (`hidden md:flex`) — on mobile and
    // narrow windows there was no way out of the creative editor.
    onClose?: () => void;
    // ISSUE-1395: the upper-left "Canvas" control is the user's primary path
    // for moving the asset being edited onto the creative canvas (the gray
    // work board). When the editor can stage the asset — save, place it on
    // the InfiniteCanvas, switch to the canvas view — wire it here. Without
    // it, clicking "Canvas" used to close the editor straight into the
    // Creative Hub instead of the canvas. Falls back to a plain close.
    onSendToCanvas?: () => void | Promise<void>;
}

export const CanvasHeader: React.FC<CanvasHeaderProps> = ({
    isMagicFillMode,
    magicFillPrompt,
    setMagicFillPrompt,
    handleMagicFill,
    isProcessing,
    processingStatus,
    isHighFidelity,
    setIsHighFidelity,
    modelTier,
    resolution,
    aspectRatio,
    grounding,
    imageSize,
    onClose,
    onSendToCanvas,
}) => {
    const isAuthenticated = !!auth.currentUser;
    const effectiveModel = modelTier || (isHighFidelity ? 'pro' : 'fast');

    return (
        <header className="grid grid-cols-[minmax(140px,1fr)_minmax(320px,560px)_minmax(140px,1fr)] items-start gap-4 px-5 py-3 border-b border-white/10 bg-[#050608]/95 backdrop-blur-xl">
            <div className="min-w-0 flex items-center gap-2">
                {(onClose || onSendToCanvas) && (
                    <button
                        onClick={() => {
                            const action = onSendToCanvas ?? onClose;
                            if (action) void action();
                        }}
                        title={onSendToCanvas ? 'Send this image to the creative canvas' : 'Back to canvas'}
                        aria-label={onSendToCanvas ? 'Send to canvas' : 'Back to canvas'}
                        data-testid="canvas-header-back"
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                    >
                        {onSendToCanvas ? <MonitorUp size={13} /> : <ArrowLeft size={13} />}
                        <span>Canvas</span>
                    </button>
                )}
                <h3 className="text-sm font-bold text-white truncate">
                    Creative Canvas
                </h3>
            </div>

            <div className="min-w-0 flex flex-col items-center">
                <div className="flex w-full max-w-[560px] items-center gap-2 bg-gray-900/50 border border-white/5 p-1 px-2 rounded-xl backdrop-blur-md shadow-inner ring-1 ring-white/10 group/magic focus-within:ring-dept-creative/50 transition-all duration-300">
                    <Sparkles size={14} className="text-dept-creative animate-pulse" />
                    <input
                        type="text"
                        value={magicFillPrompt}
                        onChange={(e) => setMagicFillPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleMagicFill()}
                        data-testid="magic-fill-input"
                        placeholder={isMagicFillMode ? "Describe edit for masked area..." : "Describe how to remix the whole image..."}
                        className="min-w-0 flex-1 bg-transparent border-none text-white text-xs px-2 focus:ring-0 outline-none placeholder:text-gray-500 font-medium"
                    />
                    <button
                        onClick={handleMagicFill}
                        data-testid="magic-generate-btn"
                        disabled={isProcessing}
                        title={!isAuthenticated ? 'Sign in to use Magic Edit' : 'Refine image with Intelligence'}
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

                    <div className="flex items-center gap-1.5">
                        {/* High Fidelity Toggle */}
                        <button
                            onClick={() => setIsHighFidelity(!isHighFidelity)}
                            title={isHighFidelity ? "Switch to High Speed (Flash)" : "Switch to High Fidelity (Pro)"}
                            aria-label={isHighFidelity ? "Model quality: Pro" : "Model quality: High Speed"}
                            className={`p-1.5 px-3 rounded-lg border transition-all flex items-center gap-1.5 ${isHighFidelity
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-500 shadow-lg shadow-amber-500/20 font-bold'
                                : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-white font-medium'
                                }`}
                        >
                            <Star size={12} fill={isHighFidelity ? "currentColor" : "none"} />
                            <span className="text-[10px] uppercase tracking-wider">{isHighFidelity ? "Pro" : "Speed"}</span>
                        </button>

                        {effectiveModel === 'pro' && (
                            <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-200">
                                <Shield size={11} />
                                Higher cost
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-2 flex w-full max-w-[560px] flex-wrap items-center justify-center gap-1.5 text-[10px] text-gray-400">
                    <span className="rounded-full border border-white/8 bg-white/4 px-2 py-1 text-gray-300">
                        {isHighFidelity ? 'High Fidelity' : 'Rapid Edit'}
                    </span>
                    <span className="rounded-full border border-white/8 bg-white/4 px-2 py-1">
                        {effectiveModel === 'pro' ? 'Tier: Pro' : 'Tier: Flash'}
                    </span>
                    <span className="rounded-full border border-white/8 bg-white/4 px-2 py-1">
                        {imageSize || resolution || '2K'}
                    </span>
                    <span className="rounded-full border border-white/8 bg-white/4 px-2 py-1">
                        {grounding ? 'Grounded' : 'Ungrounded'}
                    </span>
                    <span className="rounded-full border border-white/8 bg-white/4 px-2 py-1">
                        {aspectRatio || '1:1'}
                    </span>
                </div>
            </div>

            <div className="min-w-0" />
        </header>
    );
};
