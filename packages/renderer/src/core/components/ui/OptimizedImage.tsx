import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './Skeleton';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    fallback?: string;
}

export const OptimizedImage = ({
    src,
    alt,
    className,
    fallback,
    ...props
}: OptimizedImageProps) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);

    return (
        <div className={cn("relative overflow-hidden", className)}>
            {isLoading && (
                <Skeleton className="absolute inset-0 w-full h-full z-10" />
            )}

            <img
                src={error && fallback ? fallback : src}
                alt={alt}
                className={cn(
                    "w-full h-full object-cover transition-opacity duration-500",
                    isLoading ? "opacity-0" : "opacity-100"
                )}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                    setIsLoading(false);
                    setError(true);
                }}
                loading="lazy"
                decoding="async"
                {...props}
            />
        </div>
    );
};
