import { logger } from '@/utils/logger';

export type LayoutPresetType = 'story' | 'cd' | 'vinyl' | 'cassette';

export interface LayoutDimensions {
    width: number;
    height: number;
    description: string;
}

export interface AdaptationResult {
    paddedImage: { mimeType: string; data: string };
    maskImage: { mimeType: string; data: string };
    dimensions: LayoutDimensions;
}

export const LAYOUT_PRESETS: Record<LayoutPresetType, LayoutDimensions> = {
    story: { width: 1080, height: 1920, description: '9:16 Vertical Story / Social Media' },
    cd: { width: 1417, height: 1417, description: 'CD Booklet Front (12cm x 12cm @ 300dpi)' },
    vinyl: { width: 1200, height: 1200, description: 'Vinyl Center Label (4" diameter @ 300dpi)' },
    cassette: { width: 1065, height: 1065, description: 'Cassette J-Card Front Cover' }
};

export class LayoutAdaptationService {
    /**
     * Accepts a base64 image data (or data URI) and pads it to match the layout preset dimensions.
     * Generates:
     * 1. A padded image where the original image is placed in the center, and the outer border is filled with white.
     * 2. A binary mask where the original image area is black, and the newly padded border zone is white.
     */
    static async generateOutpaintSetup(
        imageBase64: string,
        layoutType: LayoutPresetType
    ): Promise<AdaptationResult> {
        logger.info(`[LayoutAdaptationService] Generating outpaint setup for preset: ${layoutType}`);
        const preset = LAYOUT_PRESETS[layoutType];
        
        // standard helper to load image element asynchronously
        const img = await this.loadImageElement(imageBase64);
        
        // Create canvases
        const contentCanvas = document.createElement('canvas');
        const maskCanvas = document.createElement('canvas');
        
        contentCanvas.width = preset.width;
        contentCanvas.height = preset.height;
        maskCanvas.width = preset.width;
        maskCanvas.height = preset.height;
        
        const ctxContent = contentCanvas.getContext('2d');
        const ctxMask = maskCanvas.getContext('2d');
        
        if (!ctxContent || !ctxMask) {
            throw new Error('Failed to obtain canvas contexts');
        }
        
        // 1. Fill content canvas background with white
        ctxContent.fillStyle = '#ffffff';
        ctxContent.fillRect(0, 0, preset.width, preset.height);
        
        // 2. Fill mask canvas background with white (indicating edit/outpaint zones)
        ctxMask.fillStyle = '#ffffff';
        ctxMask.fillRect(0, 0, preset.width, preset.height);
        
        // Calculate fit coordinates for centering original image
        const imgRatio = img.width / img.height;
        const targetRatio = preset.width / preset.height;
        
        let drawWidth = preset.width;
        let drawHeight = preset.height;
        let xOffset = 0;
        let yOffset = 0;
        
        if (imgRatio > targetRatio) {
            // Image is wider than target aspect ratio
            drawWidth = preset.width;
            drawHeight = preset.width / imgRatio;
            yOffset = (preset.height - drawHeight) / 2;
        } else {
            // Image is taller than target aspect ratio
            drawHeight = preset.height;
            drawWidth = preset.height * imgRatio;
            xOffset = (preset.width - drawWidth) / 2;
        }
        
        // 3. Draw original image onto content canvas in the center
        ctxContent.drawImage(img, xOffset, yOffset, drawWidth, drawHeight);
        
        // 4. Draw black rectangle over the original image region in the mask canvas (preserve original image)
        ctxMask.fillStyle = '#000000';
        ctxMask.fillRect(xOffset, yOffset, drawWidth, drawHeight);
        
        // Draw physical overlay fold guidelines/cutouts if necessary
        if (layoutType === 'vinyl') {
            // Vinyl has a center spindle hole (usually 0.286" or 1.5" for 45rpm)
            const centerX = preset.width / 2;
            const centerY = preset.height / 2;
            const spindleRadius = preset.width * 0.05; // 5% of width
            
            // On content canvas: draw guidering
            ctxContent.strokeStyle = 'rgba(0,0,0,0.3)';
            ctxContent.lineWidth = 2;
            ctxContent.beginPath();
            ctxContent.arc(centerX, centerY, spindleRadius, 0, Math.PI * 2);
            ctxContent.stroke();
        }
        
        const paddedBase64 = contentCanvas.toDataURL('image/png');
        const maskBase64 = maskCanvas.toDataURL('image/png');
        
        return {
            paddedImage: {
                mimeType: 'image/png',
                data: paddedBase64.replace(/^data:image\/png;base64,/, '')
            },
            maskImage: {
                mimeType: 'image/png',
                data: maskBase64.replace(/^data:image\/png;base64,/, '')
            },
            dimensions: preset
        };
    }
    
    private static loadImageElement(src: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(new Error('Failed to load image element: ' + String(err)));
            img.src = src.startsWith('data:') ? src : `data:image/png;base64,${src}`;
        });
    }
}
