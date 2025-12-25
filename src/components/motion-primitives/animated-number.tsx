'use client';
import { useEffect, useRef } from 'react';
import { useMotionValue, useSpring, motion, useTransform } from 'framer-motion';

export function AnimatedNumber({
    value,
    className,
    precision = 0,
}: {
    value: number;
    className?: string;
    precision?: number;
}) {
    const motionValue = useMotionValue(0);
    const springValue = useSpring(motionValue, {
        damping: 30,
        stiffness: 100,
    });

    const displayValue = useTransform(springValue, (latest) =>
        latest.toFixed(precision)
    );

    useEffect(() => {
        motionValue.set(value);
    }, [value, motionValue]);

    return <motion.span className={className}>{displayValue}</motion.span>;
}
