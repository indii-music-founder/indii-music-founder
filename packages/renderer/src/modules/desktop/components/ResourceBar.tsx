import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ResourceBarProps {
    label: string;
    value: number;
    color: string;
}

/** Animated progress bar for system resource utilization display. */
export function ResourceBar({ label, value, color }: ResourceBarProps) {
    return (
        <div>
            <div className="flex justify-between text-xs mb-2">
                <span className="text-gray-400 font-medium tracking-wide">{label}</span>
                <span className="text-white font-bold" data-testid={`resource-value-${label.toLowerCase().replace(/\s+/g, '-')}`}>{value}%</span>
            </div>
            <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className={cn("h-full rounded-full shadow-[0_0_10px_rgba(255,255,255,0.2)]", color)}
                />
            </div>
        </div>
    );
}
