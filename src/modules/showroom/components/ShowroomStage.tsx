import React from 'react';

interface ShowroomStageProps {
    mockupImage: string | null;
    videoUrl: string | null;
    isGenerating: boolean;
    onGenerate: () => void;
    onAnimate: () => void;
    canGenerate: boolean;
    canAnimate: boolean;
}

export default function ShowroomStage({
    mockupImage,
    videoUrl,
    isGenerating,
    onGenerate,
    onAnimate,
    canGenerate,
    canAnimate
}: ShowroomStageProps) {
    return (
        <div className="flex flex-col h-full bg-[#0d1117] p-4 relative">
            <h2 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-wider">3. The Stage</h2>

            {/* Monitor */}
            <div className="flex-1 bg-black rounded-lg border border-gray-800 flex items-center justify-center overflow-hidden relative shadow-2xl">
                {isGenerating && (
                    <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                    </div>
                )}

                {videoUrl ? (
                    <video src={videoUrl} controls autoPlay loop className="w-full h-full object-contain" />
                ) : mockupImage ? (
                    <img src={mockupImage} alt="Mockup" className="w-full h-full object-contain" />
                ) : (
                    <div className="text-gray-700 font-mono text-sm">
                        [WAITING FOR INPUT]
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="h-20 mt-4 flex items-center justify-center gap-4">
                <button
                    onClick={onGenerate}
                    disabled={!canGenerate || isGenerating}
                    className={`
                        px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-all
                        ${canGenerate
                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'}
                    `}
                >
                    <span>📸</span> Generate Mockup
                </button>

                <button
                    onClick={onAnimate}
                    disabled={!canAnimate || isGenerating}
                    className={`
                        px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-all
                        ${canAnimate
                            ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'}
                    `}
                >
                    <span>🎬</span> Animate Scene
                </button>
            </div>
        </div>
    );
}
