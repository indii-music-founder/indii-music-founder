import { useRef, useEffect, useState, useCallback } from 'react';

/**
 * Item 265: Lazy Image Loading Hook
 *
 * Uses IntersectionObserver to defer image loading until the element
 * enters (or is about to enter) the viewport. Eliminates the performance
 * hit of loading all thumbnails at once in large image grids.
 *
 * Usage:
 * ```tsx
 * const { ref, isVisible } = useLazyLoad({ rootMargin: '200px' });
 *
 * return (
 *   <div ref={ref}>
 *     {isVisible ? (
 *       <img src={imageUrl} alt={alt} />
 *     ) : (
 *       <div className="skeleton" style={{ width, height }} />
 *     )}
 *   </div>
 * );
 * ```
 */

interface UseLazyLoadOptions {
    /** Margin around the viewport to trigger loading early (default: '200px') */
    rootMargin?: string;
    /** Visibility threshold (0-1) to trigger (default: 0) */
    threshold?: number;
    /** Whether the element should stay loaded once visible (default: true) */
    once?: boolean;
}

interface UseLazyLoadResult {
    /** Ref to attach to the element to observe */
    ref: React.MutableRefObject<HTMLDivElement | null>;
    /** Whether the element is (or was) visible */
    isVisible: boolean;
}

export function useLazyLoad({
    rootMargin = '200px',
    threshold = 0,
    once = true,
}: UseLazyLoadOptions = {}): UseLazyLoadResult {
    const ref = useRef<HTMLDivElement | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    const handleIntersection = useCallback(
        (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    if (once) {
                        observer.unobserve(entry.target);
                    }
                } else if (!once) {
                    setIsVisible(false);
                }
            }
        },
        [once]
    );

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const observer = new IntersectionObserver(handleIntersection, {
            rootMargin,
            threshold,
        });

        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, [handleIntersection, rootMargin, threshold]);

    return { ref, isVisible };
}

/**
 * Lightweight component wrapper for lazy-loaded images.
 * Drop-in replacement for <img> with built-in IntersectionObserver.
 */
interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    /** Fallback element to show before the image loads */
    fallback?: React.ReactNode;
    /** Margin around viewport to trigger early loading */
    rootMargin?: string;
}

export function LazyImage({
    src,
    alt,
    fallback,
    rootMargin = '200px',
    className,
    style,
    ...props
}: LazyImageProps) {
    const { ref, isVisible } = useLazyLoad({ rootMargin });

    return (
        <div ref={ref} className={className} style={style}>
            {isVisible ? (
                <img
                    src={src}
                    alt={alt}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    {...props}
                />
            ) : (
                fallback || (
                    <div
                        className="w-full h-full bg-white/5 animate-pulse rounded-lg"
                        role="img"
                        aria-label={alt || 'Loading image'}
                    />
                )
            )}
        </div>
    );
}
