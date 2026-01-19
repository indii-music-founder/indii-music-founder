import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ThreeDCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    containerClassName?: string;
    onClick?: () => void;
}

export const ThreeDCard = ({ children, className, containerClassName, onClick, ...rest }: ThreeDCardProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const frameRef = useRef<number>(0);

    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseX = useSpring(x, { stiffness: 500, damping: 100 });
    const mouseY = useSpring(y, { stiffness: 500, damping: 100 });

    const [hovered, setHovered] = useState(false);

    const rotateX = useTransform(mouseY, [-0.5, 0.5], ["17.5deg", "-17.5deg"]);
    const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-17.5deg", "17.5deg"]);

    useEffect(() => {
        return () => {
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
            }
        };
    }, []);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!ref.current) return;

        const clientX = e.clientX;
        const clientY = e.clientY;

        if (frameRef.current) {
            cancelAnimationFrame(frameRef.current);
        }

        frameRef.current = requestAnimationFrame(() => {
            if (!ref.current) return;
            const rect = ref.current.getBoundingClientRect();

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
    };

    const handleMouseLeave = () => {
        setHovered(false);
        if (frameRef.current) {
            cancelAnimationFrame(frameRef.current);
        }
        x.set(0);
        y.set(0);
    };

    const isInteractive = !!onClick;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (isInteractive && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onClick?.();
        }
        rest.onKeyDown?.(e);
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
        }
    };

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
                role={isInteractive ? "button" : rest.role}
                tabIndex={isInteractive ? 0 : rest.tabIndex}
                onKeyDown={isInteractive ? handleKeyDown : rest.onKeyDown}
                {...rest}
                role={onClick ? "button" : undefined}
                tabIndex={onClick ? 0 : undefined}
                onKeyDown={onClick ? handleKeyDown : undefined}
                style={{
                    rotateX,
                    rotateY,
                    transformStyle: "preserve-3d",
                    ...rest.style
                }}
                className={cn(
                    "relative transition-all duration-200 ease-linear",
                    onClick && "cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-xl",
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
    const [isMouseEntered, setIsMouseEntered] = useState(false);

    useEffect(() => {
        return () => {
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
            }
        };
    }, []);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;

        const clientX = e.clientX;
        const clientY = e.clientY;

        if (frameRef.current) {
            cancelAnimationFrame(frameRef.current);
        }

        frameRef.current = requestAnimationFrame(() => {
            if (!containerRef.current) return;
            const { left, top, width, height } = containerRef.current.getBoundingClientRect();
            const x = (clientX - left - width / 2) / 25;
            const y = (clientY - top - height / 2) / 25;
            containerRef.current.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
        });
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
        setIsMouseEntered(true);
        if (!containerRef.current) return;
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        setIsMouseEntered(false);
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
                    onKeyDown={onClick ? handleKeyDown : undefined}
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
