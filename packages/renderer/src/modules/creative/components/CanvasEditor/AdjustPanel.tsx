import React from 'react';
import type { AdjustmentStack } from '@/services/canvas/CanvasDoc';

interface SliderSpec {
    key: keyof AdjustmentStack;
    label: string;
    min: number;
    max: number;
    step: number;
}

const SLIDERS: SliderSpec[] = [
    { key: 'brightness', label: 'Brightness', min: -1, max: 1, step: 0.01 },
    { key: 'contrast', label: 'Contrast', min: -1, max: 1, step: 0.01 },
    { key: 'saturation', label: 'Saturation', min: -1, max: 1, step: 0.01 },
    { key: 'hue', label: 'Hue', min: -180, max: 180, step: 1 },
    { key: 'temperature', label: 'Temperature', min: -1, max: 1, step: 0.01 },
    { key: 'exposure', label: 'Exposure', min: -1, max: 1, step: 0.01 },
    { key: 'blur', label: 'Blur', min: 0, max: 1, step: 0.01 },
    { key: 'vignette', label: 'Vignette', min: 0, max: 1, step: 0.01 },
];

interface AdjustPanelProps {
    adjustments: AdjustmentStack;
    onChange: (patch: Partial<AdjustmentStack>) => void;
}

/**
 * AdjustPanel — one range input per adjustment field. Every change dispatches a
 * partial `setAdjustments` patch; the store merges it over NEUTRAL_ADJUSTMENTS
 * and the doc (not the slider DOM) is the source of truth.
 */
export const AdjustPanel: React.FC<AdjustPanelProps> = ({ adjustments, onChange }) => {
    return (
        <div className="flex flex-col gap-2.5 px-3 py-2" data-testid="adjust-panel" aria-label="Adjustments">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">Adjustments</div>
            {SLIDERS.map(({ key, label, min, max, step }) => (
                <label key={key} className="flex flex-col gap-1 text-[11px] text-white/60">
                    <span className="flex justify-between">
                        <span>{label}</span>
                        <span className="font-mono text-white/40">{adjustments[key].toFixed(2)}</span>
                    </span>
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={adjustments[key]}
                        onChange={(e) => onChange({ [key]: Number(e.target.value) })}
                        data-testid={`adjust-${key}`}
                        aria-label={label}
                        className="h-1.5 cursor-pointer accent-dept-creative"
                    />
                </label>
            ))}
        </div>
    );
};
