/* eslint-disable @typescript-eslint/no-explicit-any -- Module component with dynamic data */
import React from 'react';
import { Lock, Sparkles, Star, Wand2 } from 'lucide-react';
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
}) => {
    const isAuthenticated = !!auth.currentUser;

    return (
        <header className="grid grid-cols-[minmax(140px,1fr)_minmax(320px,560px)_minmax(140px,1fr)] items-center gap-4 px-5 py-3 border-b border-white/10 bg-[#050608]/95 backdrop-blur-xl">
            <div className="min-w-0 flex items-center gap-2">
                <h3 className="text-sm font-bold text-white truncate">
                    Creative Editor
                </h3>
            </div>

            <div className="min-w-0 flex justify-center">
                <div className="flex w-full items-center gap-2 bg-gray-900/50 border border-white/5 p-1 px-2 rounded-xl backdrop-blur-md shadow-inner ring-1 ring-white/10 group/magic focus-within:ring-dept-creative/50 transition-all duration-300">
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
            </div>

            <div className="min-w-0" />
        </header>
    );
};
