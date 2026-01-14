import React from 'react';
import { motion } from 'framer-motion';

interface ChartDataPoint {
    label: string;
    value: number;
}

interface RevenueChartProps {
    data: ChartDataPoint[];
    title?: string;
    valuePrefix?: string;
}

export const RevenueChart: React.FC<RevenueChartProps> = ({
    data,
    title = "Revenue Over Time",
    valuePrefix = "$"
}) => {
    const maxValue = Math.max(...data.map(d => d.value), 1); // Avoid division by zero

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-white">{title}</h3>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-purple-500" />
                    <span className="text-xs text-gray-400">Revenue</span>
                </div>
            </div>

            <div className="flex-1 flex items-end justify-between gap-4 min-h-[220px] px-2 pb-2">
                {data.map((point, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center justify-end h-full group">
                        <div className="relative w-full h-[85%] flex flex-col justify-end">
                            {/* Value tooltip on hover */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                whileHover={{ opacity: 1, y: 0 }}
                                className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md border border-white/20 text-white text-[10px] rounded-lg px-2 py-1 shadow-xl pointer-events-none z-20"
                            >
                                {valuePrefix}{point.value.toLocaleString()}
                            </motion.div>

                            {/* Bar background */}
                            <div className="w-full h-full bg-white/5 rounded-t-xl overflow-hidden relative border border-white/5">
                                {/* The actual bar */}
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: `${(point.value / maxValue) * 100}%` }}
                                    transition={{ duration: 1, delay: index * 0.1, ease: [0.23, 1, 0.32, 1] }}
                                    className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-purple-600/60 to-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.3)] group-hover:from-purple-500 group-hover:to-purple-300 transition-colors"
                                />
                            </div>
                        </div>
                        <span className="text-[10px] font-medium text-gray-500 mt-3 group-hover:text-gray-300 transition-colors truncate w-full text-center">
                            {point.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
