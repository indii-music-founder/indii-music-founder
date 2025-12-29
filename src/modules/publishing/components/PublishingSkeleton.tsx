import React from 'react';
import { motion } from 'framer-motion';

export const PublishingSkeleton = () => {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header Skeleton */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-8 w-48 bg-gray-800/50 rounded-lg"></div>
                    <div className="h-4 w-64 bg-gray-800/30 rounded-lg"></div>
                </div>
                <div className="h-10 w-32 bg-gray-800/50 rounded-lg"></div>
            </div>

            {/* Stats Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-[#161b22]/80 border border-gray-800/50 p-5 rounded-2xl h-32 relative overflow-hidden">
                        <div className="flex justify-between items-start mb-4">
                            <div className="h-4 w-24 bg-gray-800/50 rounded"></div>
                            <div className="h-8 w-8 bg-gray-800/50 rounded-lg"></div>
                        </div>
                        <div className="h-8 w-16 bg-gray-800/50 rounded mb-2"></div>
                        <div className="h-3 w-32 bg-gray-800/30 rounded"></div>
                    </div>
                ))}
            </div>

            {/* Search & Filter Bar Skeleton */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="h-6 w-32 bg-gray-800/50 rounded"></div>
                    <div className="h-4 w-24 bg-gray-800/30 rounded"></div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <div className="h-10 w-full sm:w-64 bg-gray-800/50 rounded-xl"></div>
                    <div className="h-10 w-32 bg-gray-800/50 rounded-xl"></div>
                </div>
            </div>

            {/* Release List Skeleton */}
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-5 bg-gray-900/30 border border-gray-800/50 rounded-2xl h-24">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-gray-800/50 rounded-lg"></div>
                            <div className="space-y-2">
                                <div className="h-5 w-48 bg-gray-800/50 rounded"></div>
                                <div className="h-4 w-32 bg-gray-800/30 rounded"></div>
                            </div>
                        </div>
                        <div className="flex items-center gap-8">
                            <div className="hidden md:block space-y-2">
                                <div className="h-4 w-20 bg-gray-800/50 rounded"></div>
                                <div className="h-3 w-16 bg-gray-800/30 rounded"></div>
                            </div>
                            <div className="hidden md:block w-32 h-2 bg-gray-800/50 rounded-full"></div>
                            <div className="h-8 w-8 bg-gray-800/50 rounded-lg"></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
