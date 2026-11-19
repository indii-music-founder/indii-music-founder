import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Z_LAYER, zLayerValue } from './zLayers';

const src = (relative: string) => readFileSync(resolve(__dirname, '..', relative), 'utf8');

describe('Z_LAYER stacking scale', () => {
    it('orders boardroom < sheet < modal < toast < tooltip', () => {
        const order = (['boardroom', 'sheet', 'modal', 'toast', 'tooltip'] as const).map(zLayerValue);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
        expect(new Set(order).size).toBe(order.length);
    });

    it('keeps cost approval, toasts and the Boardroom on the shared scale', () => {
        expect(src('core/components/CostWarningModal.tsx')).toContain('Z_LAYER.modal');
        expect(src('core/context/ToastContext.tsx')).toContain('Z_LAYER.toast');
        expect(src('modules/boardroom/BoardroomModule.tsx')).toContain('Z_LAYER.boardroom');
        expect(src('components/ui/tooltip.tsx')).toContain(Z_LAYER.tooltip);
    });

    it('does not let Boardroom seat tooltips override the tooltip layer', () => {
        expect(src('modules/boardroom/components/ParticipantSelector.tsx')).not.toMatch(/TooltipContent[^>]*z-\[100\]/);
    });
});
