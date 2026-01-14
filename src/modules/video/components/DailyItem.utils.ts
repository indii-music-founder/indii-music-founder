import { HistoryItem } from '@/core/store/slices/creativeSlice';
import React from 'react';

export interface DailyItemProps {
    video: HistoryItem;
    isSelected: boolean;
    onSelect: (item: HistoryItem) => void;
    onDragStart: (e: React.DragEvent, item: HistoryItem) => void;
    /** Duration in seconds. Defaults to 4s if not provided. */
    duration?: number;
}

// ⚡ Bolt Optimization: Deep comparison to prevent re-renders from Firestore/Store reference instability
export function arePropsEqual(prev: DailyItemProps, next: DailyItemProps): boolean {
    const isVideoEqual =
        prev.video.id === next.video.id &&
        prev.video.url === next.video.url &&
        prev.video.prompt === next.video.prompt &&
        prev.video.type === next.video.type;

    return (
        isVideoEqual &&
        prev.isSelected === next.isSelected &&
        prev.duration === next.duration &&
        prev.onSelect === next.onSelect &&
        prev.onDragStart === next.onDragStart
    );
}
