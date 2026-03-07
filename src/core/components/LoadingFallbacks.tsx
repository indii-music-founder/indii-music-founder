import React, { useState, useEffect } from 'react';
import { useStore } from '@/core/store';
import { type ModuleId } from '@/core/constants';
import { cn } from '@/lib/utils';

interface SkeletonProps {
    className?: string;
}

const Shimmer = ({ className }: SkeletonProps) => (
    <div className={cn("bg-white/5 animate-pulse rounded-xl", className)} />
);

// For Creative Studio, Video Studio, Merch
const StudioSkeleton = () => (
    <div className="flex-1 flex gap-4 h-full p-4">
        {/* Left Toolbar */}
        <div className="w-16 h-full flex flex-col gap-2">
            <Shimmer className="w-12 h-12 rounded-lg" />
            <Shimmer className="w-12 h-12 rounded-lg" />
            <Shimmer className="w-12 h-12 rounded-lg" />
            <Shimmer className="w-12 h-12 rounded-lg mt-auto" />
        </div>
        {/* Main Canvas */}
        <div className="flex-1 h-full">
            <Shimmer className="w-full h-full" />
        </div>
        {/* Right Properties Panel */}
        <div className="w-72 h-full flex flex-col gap-4">
            <Shimmer className="w-full h-32" />
            <Shimmer className="w-full flex-1" />
        </div>
    </div>
);

// For Dashboard, Finance, Marketing
const DashboardSkeleton = () => (
    <div className="h-full flex flex-col p-6 gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Shimmer className="h-10 w-10" />
                <Shimmer className="h-8 w-48" />
            </div>
            <div className="flex gap-2">
                <Shimmer className="h-10 w-24" />
                <Shimmer className="h-10 w-24" />
            </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4">
            <Shimmer className="h-32" />
            <Shimmer className="h-32" />
            <Shimmer className="h-32" />
            <Shimmer className="h-32" />
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-3 gap-6 flex-1">
            <div className="col-span-2 space-y-6 flex flex-col">
                <Shimmer className="h-64" />
                <Shimmer className="flex-1" />
            </div>
            <div className="space-y-6 flex flex-col">
                <Shimmer className="h-80" />
                <Shimmer className="flex-1" />
            </div>
        </div>
    </div>
);

// For Agent, Support, Social
const ChatSkeleton = () => (
    <div className="flex h-full p-4 gap-4">
        {/* Thread List */}
        <div className="w-80 h-full flex flex-col gap-3">
            <Shimmer className="h-12 w-full" />
            <div className="flex-1 flex flex-col gap-2 mt-4">
                <Shimmer className="h-20 w-full" />
                <Shimmer className="h-20 w-full" />
                <Shimmer className="h-20 w-full" />
                <Shimmer className="h-20 w-full" />
            </div>
        </div>
        {/* Main Chat Area */}
        <div className="flex-1 h-full flex flex-col gap-4">
            <Shimmer className="h-16 w-full" />
            <div className="flex-1 flex flex-col justify-end gap-4 pb-4">
                <Shimmer className="h-16 w-2/3 ml-auto" />
                <Shimmer className="h-24 w-1/2" />
                <Shimmer className="h-16 w-3/4 ml-auto" />
            </div>
            <Shimmer className="h-16 w-full" />
        </div>
    </div>
);

// Fallback Generic
const GenericSkeleton = () => (
    <div className="h-full flex flex-col p-6 gap-4">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Shimmer className="h-8 w-8" />
                <Shimmer className="h-5 w-40" />
            </div>
            <div className="flex gap-2">
                <Shimmer className="h-8 w-20" />
                <Shimmer className="h-8 w-20" />
            </div>
        </div>

        {/* Content skeleton */}
        <div className="flex-1 grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-4 flex flex-col">
                <Shimmer className="h-48" />
                <div className="grid grid-cols-2 gap-4 flex-1">
                    <Shimmer className="h-full" />
                    <Shimmer className="h-full" />
                </div>
            </div>
            <div className="space-y-4 flex flex-col">
                <Shimmer className="h-32" />
                <Shimmer className="h-32" />
                <Shimmer className="flex-1" />
            </div>
        </div>
    </div>
);

export function LoadingFallback() {
    const currentModule = useStore(state => state.currentModule);
    const [show, setShow] = useState(false);

    useEffect(() => {
        // Delay showing the skeleton to prevent flash for fast module loads
        const timer = setTimeout(() => setShow(true), 150);
        return () => clearTimeout(timer);
    }, [currentModule]); // Reset delay when module changes

    if (!show) {
        return null;
    }

    let SkeletonComponent = GenericSkeleton;

    if (['creative', 'video', 'merch', 'capture', 'workflow', 'files', 'audio-analyzer'].includes(currentModule)) {
        SkeletonComponent = StudioSkeleton;
    } else if (['dashboard', 'finance', 'marketing', 'distribution', 'publishing', 'legal', 'licensing', 'brand', 'campaign', 'road', 'knowledge', 'observability', 'history', 'debug', 'onboarding', 'select-org', 'investor'].includes(currentModule)) {
        SkeletonComponent = DashboardSkeleton;
    } else if (['agent', 'social', 'publicist'].includes(currentModule)) {
        SkeletonComponent = ChatSkeleton;
    }

    return (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-sm animate-in fade-in duration-200 z-[40]">
            <SkeletonComponent />
        </div>
    );
}
