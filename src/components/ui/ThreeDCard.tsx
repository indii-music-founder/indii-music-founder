import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion';
import { cn } from '@/lib/utils';

interface ThreeDCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    containerClassName?: string;
    onClick?: () => void;
    /**
     * Optional ARIA label for the card.
     * Recommended when the card is interactive (has onClick).
     */
    'aria-label'?: string;
}

export const ThreeDCard = ({
    children,
    className,
    containerClassName,
    onClick,
    'aria-label': ariaLabel,
    style,
    // Exclude conflicting props that motion handles differently
    onDrag,
    onDragStart,
    onDragEnd,
    onAnimationStart,
    onAnimationEnd,
    ...rest
}: ThreeDCardProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const frameRef = useRef<number>(0);
    const rectRef = useRef<DOMRect | null>(null);

    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseX = useSpring(x, { stiffness: 500, damping: 100 });
    const mouseY = useSpring(y, { stiffness: 500, damping: 100 });

    const [hovered, setHovered] = useState(false);

    const rotateX = useTransform(mouseY, [-0.5, 0.5], ["17.5deg", "-17.5deg"]);
    const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-17.5deg", "17.5deg"]);

    const updateRect = useCallback(() => {
        if (ref.current) {
            rectRef.current = ref.current.getBoundingClientRect();
        }
    }, []);

    // Cleanup listeners on unmount
    useEffect(() => {
        return () => {
            window.removeEventListener('scroll', updateRect, { capture: true } as any);
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
            }
        };
    }, [updateRect]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!ref.current) return;

        const clientX = e.clientX;
        const clientY = e.clientY;

        if (frameRef.current) {
            cancelAnimationFrame(frameRef.current);
        }

        frameRef.current = requestAnimationFrame(() => {
            if (!ref.current) return;
            // Bolt Optimization: Use cached rect to avoid reflow on every frame
            const rect = rectRef.current || ref.current.getBoundingClientRect();

            const width = rect.width;
            const height = rect.height;

            const mouseXFromCenter = clientX - rect.left - width / 2;
            const mouseYFromCenter = clientY - rect.top - height / 2;

            x.set(mouseXFromCenter / width);
            y.set(mouseYFromCenter / height);
        });
    };

    const handleMouseEnter = () => {
        setHovered(true);
        updateRect();
        // Bolt Optimization: Update rect on scroll to handle scrolling while hovering
        window.addEventListener('scroll', updateRect, { capture: true, passive: true });
    };

    const handleMouseLeave = () => {
        setHovered(false);
        window.removeEventListener('scroll', updateRect, { capture: true } as any);
        if (frameRef.current) {
            cancelAnimationFrame(frameRef.current);
        }
        x.set(0);
        y.set(0);
    };

    const isInteractive = !!onClick; // Derived for reuse

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (isInteractive && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onClick?.();
        }
        rest.onKeyDown?.(e);
    };

    const interactiveProps = isInteractive ? {
        role: 'button',
        tabIndex: 0,
        onKeyDown: handleKeyDown,
        'aria-label': ariaLabel,
    } : {};

    return (
        <div
            className={cn(
                "flex items-center justify-center",
                containerClassName
            )}
            style={{
                perspective: "1000px",
            }}
        >
            <motion.div
                ref={ref}
                onMouseMove={handleMouseMove}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={onClick}
                {...interactiveProps}
                {...rest}
                style={{
                    rotateX,
                    rotateY,
                    transformStyle: "preserve-3d",
                    cursor: isInteractive ? 'pointer' : undefined,
                    ...style
                }}
                className={cn(
                    "relative transition-all duration-200 ease-linear",
                    isInteractive && "cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-xl",
                    className
                )}
            >
                <div
                    style={{
                        transform: "translateZ(75px)",
                        transformStyle: "preserve-3d",
                    }}
                    className="absolute inset-4 grid place-content-center rounded-xl bg-white shadow-lg"
                >
                    {/* Shadow/Depth layer placeholder if needed */}
                </div>

                {children}
            </motion.div>
        </div>
    );
};

export const ThreeDCardBody = ({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) => {
    return (
        <div
            className={cn(
                "h-96 w-96 [transform-style:preserve-3d]  [&>*]:[transform-style:preserve-3d]",
                className
            )}
        >
            {children}
        </div>
    );
};

export const ThreeDCardItem = ({
    as: Component = "div",
    children,
    className,
    translateX = 0,
    translateY = 0,
    translateZ = 0,
    rotateX = 0,
    rotateY = 0,
    rotateZ = 0,
    ...rest
}: {
    as?: any;
    children: React.ReactNode;
    className?: string;
    translateX?: number | string;
    translateY?: number | string;
    translateZ?: number | string;
    rotateX?: number | string;
    rotateY?: number | string;
    rotateZ?: number | string;
    [key: string]: any;
}) => {
    const ref = useRef<HTMLDivElement>(null);

    const [isMouseEntered] = useMouseEnter();

    return (
        <Component
            ref={ref}
            className={cn("w-fit transition-all duration-200 ease-linear", className)}
            style={{
                transform: `translateX(${translateX}px) translateY(${translateY}px) translateZ(${isMouseEntered ? translateZ : 0}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`,
            }}
            {...rest}
        >
            {children}
        </Component>
    );
};

// Context to share hover state
const MouseEnterContext = React.createContext<[boolean, React.Dispatch<React.SetStateAction<boolean>>] | undefined>(undefined);

export const ThreeDCardContainer = ({
    children,
    className,
    containerClassName,
    onClick
}: {
    children: React.ReactNode;
    className?: string;
    containerClassName?: string;
    onClick?: () => void;
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<number>(0);
    const rectRef = useRef<DOMRect | null>(null);
    const [isMouseEntered, setIsMouseEntered] = useState(false);

    const updateRect = useCallback(() => {
        if (containerRef.current) {
            rectRef.current = containerRef.current.getBoundingClientRect();
        }
    }, []);

    // Cleanup listeners on unmount
    useEffect(() => {
        return () => {
            window.removeEventListener('scroll', updateRect, { capture: true } as any);
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
            }
        };
    }, [updateRect]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;

        const clientX = e.clientX;
        const clientY = e.clientY;

        if (frameRef.current) {
            cancelAnimationFrame(frameRef.current);
        }

        frameRef.current = requestAnimationFrame(() => {
            if (!containerRef.current) return;
            // Bolt Optimization: Use cached rect to avoid reflow on every frame
            const rect = rectRef.current || containerRef.current.getBoundingClientRect();

            const { left, top, width, height } = rect;
            const x = (clientX - left - width / 2) / 25;
            const y = (clientY - top - height / 2) / 25;
            containerRef.current.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
        });
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
        setIsMouseEntered(true);
        if (!containerRef.current) return;
        updateRect();
        // Bolt Optimization: Update rect on scroll to handle scrolling while hovering
        window.addEventListener('scroll', updateRect, { capture: true, passive: true });
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        setIsMouseEntered(false);
        window.removeEventListener('scroll', updateRect, { capture: true } as any);
        if (frameRef.current) {
            cancelAnimationFrame(frameRef.current);
        }
        containerRef.current.style.transform = `rotateY(0deg) rotateX(0deg)`;
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
        }
    };

    return (
        <MouseEnterContext.Provider value={[isMouseEntered, setIsMouseEntered]}>
            <div
                className={cn(
                    "flex items-center justify-center",
                    containerClassName
                )}
                style={{
                    perspective: "1000px",
                }}
            >
                <div
                    ref={containerRef}
                    onMouseEnter={handleMouseEnter}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    onClick={onClick}
                    role={onClick ? "button" : undefined}
                    tabIndex={onClick ? 0 : undefined}
                    onKeyDown={handleKeyDown}
                    className={cn(
                        "flex items-center justify-center relative transition-all duration-200 ease-linear",
                        onClick && "cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-xl",
                        className
                    )}
                    style={{
                        transformStyle: "preserve-3d",
                    }}
                >
                    {children}
                </div>
            </div>
        </MouseEnterContext.Provider>
    );
};

export const useMouseEnter = () => {
    const context = React.useContext(MouseEnterContext);
    if (context === undefined) {
        throw new Error("useMouseEnter must be used within a MouseEnterProvider");
    }
    return context;
};
