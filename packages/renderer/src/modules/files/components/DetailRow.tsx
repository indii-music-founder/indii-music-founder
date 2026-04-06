import React from 'react';
import { cn } from '@/lib/utils';

interface DetailRowProps {
    label: string;
    value: string;
    className?: string;
}

/** Key-value row for file detail properties panel. */
export function DetailRow({ label, value, className }: DetailRowProps) {
    return (
        <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">{label}</span>
            <span className={cn("text-gray-200 font-medium", className)}>{value}</span>
        </div>
    );
}
