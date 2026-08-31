import React, { useState } from 'react';
import { Download } from 'lucide-react';

export type ExportFormat = 'png' | 'jpeg' | 'psd';

interface ExportBarProps {
    onExport: (format: ExportFormat, scale: number) => void;
}

/**
 * ExportBar — format/scale selectors plus the export action. Rendering at
 * width×height×scale happens in the caller (C1.4 export path); this panel is
 * only the control surface.
 */
export const ExportBar: React.FC<ExportBarProps> = ({ onExport }) => {
    const [format, setFormat] = useState<ExportFormat>('png');
    const [scale, setScale] = useState(2);

    return (
        <div className="flex flex-col gap-2 px-3 py-2 border-t border-white/5" data-testid="export-bar" aria-label="Export">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">Export</div>
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
        </div>
    );
};
