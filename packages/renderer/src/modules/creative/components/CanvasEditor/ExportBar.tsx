import React, { useState } from 'react';
import { Download, Maximize2 } from 'lucide-react';

export type ExportFormat = 'png' | 'jpeg' | 'psd';

interface ExportBarProps {
    onExport: (format: ExportFormat, scale: number) => void;
    onUpscaleToPrint?: () => void | Promise<void>;
    isUpscaling?: boolean;
}

/**
 * ExportBar — format/scale selectors plus the export action. Rendering at
 * width×height×scale happens in the caller (C1.4 export path); this panel is
 * only the control surface.
 */
export const ExportBar: React.FC<ExportBarProps> = ({ onExport, onUpscaleToPrint, isUpscaling }) => {
    const [format, setFormat] = useState<ExportFormat>('png');
    const [scale, setScale] = useState(2);

    return (
        <div className="flex flex-col gap-2 px-3 py-2 border-t border-white/5" data-testid="export-bar" aria-label="Export">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">Export & Print</div>
            <div className="flex items-center gap-2">
                <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as ExportFormat)}
                    data-testid="export-format"
                    aria-label="Export format"
                    className="bg-black/40 border border-white/10 rounded px-2 py-1 text-[11px] text-white/80"
                >
                    <option value="png">PNG</option>
                    <option value="jpeg">JPEG</option>
                    <option value="psd">PSD</option>
                </select>
                <select
                    value={scale}
                    onChange={(e) => setScale(Number(e.target.value))}
                    data-testid="export-scale"
                    aria-label="Export scale"
                    className="bg-black/40 border border-white/10 rounded px-2 py-1 text-[11px] text-white/80"
                >
                    <option value={1}>1×</option>
                    <option value={2}>2×</option>
                </select>
                <button
                    onClick={() => onExport(format, scale)}
                    data-testid="canvas-export"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-dept-creative/20 hover:bg-dept-creative/30 text-white border border-dept-creative/40 text-[11px] font-bold uppercase tracking-wider transition-colors"
                >
                    <Download size={12} />
                    Export
                </button>
            </div>
            {onUpscaleToPrint && (
                <button
                    onClick={() => void onUpscaleToPrint()}
                    disabled={isUpscaling}
                    data-testid="canvas-upscale-3000"
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <Maximize2 size={11} className={isUpscaling ? 'animate-spin' : ''} />
                    {isUpscaling ? 'Upscaling to 3000px...' : '3000px Print Standard (300 DPI)'}
                </button>
            )}
        </div>
    );
};
