import { createWorker } from 'tesseract.js';
import { delay } from '@/utils/async';

export const OCRService = {
    /**
     * Recognize text from an image file using Tesseract.js
     * @param file The image file to process
     * @param onProgress Optional callback for status updates
     * @returns The extracted text
     */
    recognizeText: async (file: File, onProgress?: (status: string) => void): Promise<string> => {
        // Tesseract v6: Simplified worker creation with explicit CDN path
        const worker = await createWorker('eng', 1, {
            langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int',
            logger: m => {
                if (onProgress) {
                    // Normalize progress to 0-100
                    const p = m.progress || 0;
                    const percent = Math.round(p * 100);
                    onProgress(`${m.status} (${percent}%)`);
                }
            }
        });

        // Add timeout to prevent infinite hanging
        const timeoutPromise = delay(60000).then(() => {
            throw new Error('OCR Metadata Download Timed Out');
        });

        try {
            const result = await Promise.race([
                worker.recognize(file),
                timeoutPromise
            ]) as { data: { text: string } };

            return result.data.text;
        } finally {
            await worker.terminate();
        }
    }
};
