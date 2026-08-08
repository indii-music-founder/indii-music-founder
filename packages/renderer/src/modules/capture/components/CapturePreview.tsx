import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

interface CapturePreviewProps {
    imagePreview: string;
    onTransmit: () => void;
}

/**
 * CapturePreview — Post-capture view showing the decoded local image and an
 * explicit upload action. It makes no OCR or image-analysis claim.
 */
export function CapturePreview({ imagePreview, onTransmit }: CapturePreviewProps) {
    return (
        <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-0 bg-black flex items-center justify-center p-4"
        >
            <div className="relative w-full max-w-md aspect-[3/4] rounded-xl overflow-hidden shadow-2xl border border-gray-800">
                <img
                    src={imagePreview}
                    alt="Captured Document"
                    className="w-full h-full object-cover"
                />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-8 left-0 right-0 flex justify-center px-6"
            >
                <button
                    onClick={onTransmit}
                    className="w-full max-w-sm bg-linear-to-r from-teal-500 to-indigo-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 active:scale-95 transition-transform"
                >
                    Upload to Studio <ArrowRight size={20} />
                </button>
            </motion.div>
        </motion.div>
    );
}
