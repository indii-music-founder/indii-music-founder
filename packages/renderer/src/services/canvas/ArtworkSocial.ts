import { getPrintPreset } from '@indii/shared';
import type { CanvasDoc } from './CanvasDoc';

const preset = getPrintPreset('social_1080x1350')!;
export const ARTWORK_SOCIAL_SIZE = {
    width: Math.round(preset.widthIn * preset.dpi),
    height: Math.round(preset.heightIn * preset.dpi),
};

export function requireSocialArtworkSize(doc: Pick<CanvasDoc, 'width' | 'height'>): void {
    if (doc.width !== ARTWORK_SOCIAL_SIZE.width || doc.height !== ARTWORK_SOCIAL_SIZE.height) {
        throw new Error('Choose Social feed (1080 × 1350) and review the layout before preparing a post.');
    }
}
