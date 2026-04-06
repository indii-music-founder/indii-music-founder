import React from 'react';
import { Loader2, Image as ImageIcon, Video } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface GauntletPreviewProps {
    loading: boolean;
    step: number;
    resultImage: string | undefined;
    videoJobId: string | undefined;
}

/**
 * GauntletPreview — Live preview panel showing the current generation result.
 * Displays a loading overlay during execution, the generated image when available,
 * and a video job ID badge when a video generation is queued.
 */
export function GauntletPreview({ loading, step, resultImage, videoJobId }: GauntletPreviewProps) {
    return (
        <Card className="p-6 bg-surface/30 border-white/5 h-full min-h-[400px] flex flex-col">
            <h3 className="text-lg font-bold mb-4">Live Preview</h3>
            <div className="flex-1 border border-white/10 rounded-lg flex items-center justify-center bg-black/40 overflow-hidden relative">
                {resultImage && (
                    <img src={resultImage} alt="Result" className="w-full h-full object-cover" />
                )}
                {loading && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4">
                        <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
                        <p className="text-xl font-bold italic tracking-widest text-white">IF IT WORKED...</p>
                        <p className="text-sm text-purple-400 font-mono mt-2 animate-pulse">PROCESSING STEP {step}</p>
                    </div>
                )}
                {!loading && !resultImage && (
                    <div className="text-muted-foreground flex flex-col items-center gap-2">
                        <ImageIcon className="w-12 h-12 opacity-20" />
                        <p className="text-xs font-mono uppercase tracking-widest">Waiting for Execution</p>
                    </div>
                )}
            </div>
            {videoJobId && (
                <div className="mt-4 p-3 bg-purple-900/20 border border-purple-500/30 rounded flex items-center gap-3">
                    <Video className="w-5 h-5 text-purple-400" />
                    <div className="flex-1">
                        <p className="text-xs font-bold text-white leading-none">Job ID Detected</p>
                        <p className="text-[10px] font-mono text-purple-300 opacity-80">{videoJobId}</p>
                    </div>
                    <div className="text-[10px] font-bold px-2 py-1 bg-purple-500/40 rounded uppercase tracking-tighter">Live</div>
                </div>
            )}
        </Card>
    );
}
