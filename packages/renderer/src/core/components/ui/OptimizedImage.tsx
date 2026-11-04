import { useState, type ImgHTMLAttributes, type SyntheticEvent } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

interface OptimizedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
    fallback?: string;
}

type ImageContentProps = Omit<OptimizedImageProps, 'className'>;

function ImageContent({
    src,
    alt,
    fallback,
    onLoad,
    onError,
    loading = 'lazy',
    decoding = 'async',
    ...props
}: ImageContentProps) {
    const [showFallback, setShowFallback] = useState(!src && Boolean(fallback));
    const [isLoading, setIsLoading] = useState(Boolean(src || fallback));

    const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => {
        setIsLoading(false);
        onLoad?.(event);
    };

    const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
        if (!showFallback && fallback && fallback !== src) {
            setShowFallback(true);
            setIsLoading(true);
        } else {
            setIsLoading(false);
        }
        onError?.(event);
    };

    return (
        <>
            {isLoading && <Skeleton className="absolute inset-0 z-10 h-full w-full" />}
            <img
                {...props}
                src={showFallback ? fallback : src}
                alt={alt}
                loading={loading}
                decoding={decoding}
                className={cn(
                    'h-full w-full object-cover motion-safe:transition-opacity motion-safe:duration-500',
                    isLoading ? 'opacity-0' : 'opacity-100'
                )}
                onLoad={handleLoad}
                onError={handleError}
            />
        </>
    );
}

export const OptimizedImage = ({
    src,
    className,
    fallback,
    ...props
}: OptimizedImageProps) => (
    <div className={cn('relative overflow-hidden', className)}>
        <ImageContent key={JSON.stringify([src, fallback])} src={src} fallback={fallback} {...props} />
    </div>
);
