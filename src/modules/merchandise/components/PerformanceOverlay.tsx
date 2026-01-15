import React from 'react';
import { Activity } from 'lucide-react';
import { PerformanceMetrics } from '../hooks/usePerformanceMonitor';

export interface PerformanceOverlayProps {
    metrics: PerformanceMetrics;
}

export const PerformanceOverlay: React.FC<PerformanceOverlayProps> = ({ metrics }) => {
    // Get FPS color based on performance
    const getFpsColor = (fps: number) => {
        if (fps >= 55) return 'text-green-400';
        if (fps >= 30) return 'text-yellow-400';
        return 'text-red-400';
    };

    // Get render time color
    const getRenderTimeColor = (time: number) => {
        if (time <= 16.67) return 'text-green-400'; // 60fps = 16.67ms per frame
        if (time <= 33.33) return 'text-yellow-400'; // 30fps = 33.33ms per frame
        return 'text-red-400';
    };

    return (
        <div className="fixed bottom-4 right-4 bg-black/90 backdrop-blur-sm border border-white/10 rounded-lg p-3 text-xs font-mono z-50 min-w-[180px]">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                <Activity size={14} className="text-[#FFE135]" />
                <span className="text-neutral-400 font-semibold">Performance</span>
            </div>

            {/* Metrics */}
            <div className="space-y-1.5">
                <div className="flex justify-between">
                    <span className="text-neutral-500">FPS:</span>
                    <span className={`font-bold ${getFpsColor(metrics.fps)}`}>
                        {metrics.fps}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-neutral-500">Render:</span>
                    <span className={`font-bold ${getRenderTimeColor(metrics.renderTime)}`}>
                        {metrics.renderTime.toFixed(2)}ms
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-neutral-500">Objects:</span>
                    <span className="font-bold text-[#FFE135]">
                        {metrics.objectCount}
                    </span>
                </div>
            </div>

            {/* Footer hint */}
            <div className="mt-2 pt-2 border-t border-white/10">
                <p className="text-[10px] text-neutral-600">Dev mode only</p>
            </div>
        </div>
    );
};
