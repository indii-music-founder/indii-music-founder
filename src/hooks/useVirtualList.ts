import { useRef, useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Item 264: Lightweight Virtualized List Hook
 *
 * Uses IntersectionObserver to only render items that are visible (or near-visible)
 * in the viewport. Eliminates the need for external libraries like react-virtual.
 *
 * Usage:
 * ```tsx
 * const { containerRef, visibleRange, totalHeight, offsetY } = useVirtualList({
 *   itemCount: items.length,
 *   itemHeight: 64,
 *   overscan: 5,
 * });
 *
 * return (
 *   <div ref={containerRef} style={{ height: 500, overflow: 'auto' }}>
 *     <div style={{ height: totalHeight, position: 'relative' }}>
 *       <div style={{ transform: `translateY(${offsetY}px)` }}>
 *         {items.slice(visibleRange.start, visibleRange.end).map(item => (
 *           <ItemComponent key={item.id} item={item} />
 *         ))}
 *       </div>
 *     </div>
 *   </div>
 * );
 * ```
 */

interface UseVirtualListOptions {
    /** Total number of items in the list */
    itemCount: number;
    /** Fixed height of each item in pixels */
    itemHeight: number;
    /** Number of items to render above/below the visible area (default: 5) */
    overscan?: number;
}

interface UseVirtualListResult {
    /** Ref to attach to the scrollable container */
    containerRef: React.RefObject<HTMLDivElement | null>;
    /** The start and end indices of items to render */
    visibleRange: { start: number; end: number };
    /** Total height of the virtual content area */
    totalHeight: number;
    /** Y offset for the rendered items container */
    offsetY: number;
    /** Number of items currently being rendered */
    renderedCount: number;
}

export function useVirtualList({
    itemCount,
    itemHeight,
    overscan = 5,
}: UseVirtualListOptions): UseVirtualListResult {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);

    // Calculate visible range
    const { start, end, offsetY, totalHeight } = useMemo(() => {
        const total = itemCount * itemHeight;
        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
        const visibleCount = Math.ceil(containerHeight / itemHeight);
        const endIndex = Math.min(itemCount, startIndex + visibleCount + overscan * 2);
        const offset = startIndex * itemHeight;

        return {
            start: startIndex,
            end: endIndex,
            offsetY: offset,
            totalHeight: total,
        };
    }, [itemCount, itemHeight, overscan, scrollTop, containerHeight]);

    // Handle scroll
    const handleScroll = useCallback(() => {
        if (containerRef.current) {
            setScrollTop(containerRef.current.scrollTop);
        }
    }, []);

    // Set up scroll listener and ResizeObserver
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Initial measurement
        setContainerHeight(container.clientHeight);
        setScrollTop(container.scrollTop);

        // Scroll listener
        container.addEventListener('scroll', handleScroll, { passive: true });

        // Resize observer for container height changes
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerHeight(entry.contentRect.height);
            }
        });
        resizeObserver.observe(container);

        return () => {
            container.removeEventListener('scroll', handleScroll);
            resizeObserver.disconnect();
        };
    }, [handleScroll]);

    return {
        containerRef,
        visibleRange: { start, end },
        totalHeight,
        offsetY,
        renderedCount: end - start,
    };
}
