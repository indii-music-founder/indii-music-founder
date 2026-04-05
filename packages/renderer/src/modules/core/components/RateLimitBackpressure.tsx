import React from 'react';
import { ShieldAlert, Timer } from 'lucide-react';
import { motion } from 'framer-motion';

interface RateLimitProps {
    retryAfterSeconds: number;
    featureName: string;
}

export const RateLimitBackpressure: React.FC<RateLimitProps> = ({ retryAfterSeconds, featureName }) => {
    // Mock Rate Limit "Backpressure" UX (Item 190)
    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-orange-900/20 border border-orange-500/30 rounded-xl text-orange-200 flex items-start gap-4 max-w-md shadow-lg backdrop-blur-md"
        >
            <div className="p-2 bg-orange-500/20 rounded-lg mt-0.5">
                <ShieldAlert size={20} className="text-orange-400" />
            </div>
            <div className="flex-1">
                <h3 className="font-semibold text-orange-300 mb-1">Cooling Down</h3>
                <p className="text-sm text-orange-200/70 leading-relaxed mb-3">
                    The AI models powering <strong>{featureName}</strong> are currently running hot to maintain elite creative quality.
                </p>
                <div className="flex items-center gap-2 text-xs font-mono bg-black/40 px-3 py-1.5 rounded-lg w-fit">
                    <Timer size={14} className="text-orange-400" />
                    <span>Resumes in {retryAfterSeconds}s</span>
                </div>
            </div>
        </motion.div>
    );
};
