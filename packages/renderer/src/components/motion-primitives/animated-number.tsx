'use client';
import { useEffect } from 'react';
import { useMotionValue, useSpring, motion, useTransform, useReducedMotion } from 'motion/react';

export function AnimatedNumber({
    value,
    className,
    precision = 0,
}: {
    value: number;
    className?: string;
    precision?: number;
}) {
    const reducedMotion = useReducedMotion();
    const safePrecision = Number.isFinite(precision) ? Math.max(0, Math.min(6, Math.trunc(precision))) : 0;
    const finiteValue = Number.isFinite(value) ? value : null;
    const accessibleValue = finiteValue === null ? '—' : finiteValue.toFixed(safePrecision);
    const motionValue = useMotionValue(0);
    const springValue = useSpring(motionValue, {
        damping: 30,
        stiffness: 100,
    });

    const displayValue = useTransform(springValue, (latest) =>
        latest.toFixed(safePrecision)
    );

    useEffect(() => {
        if (finiteValue !== null) motionValue.set(finiteValue);
    }, [finiteValue, motionValue]);

    if (reducedMotion || finiteValue === null) {
        return <span className={className}>{accessibleValue}</span>;
    }

    return <span className={className}>
        <span className="sr-only">{accessibleValue}</span>
        <motion.span aria-hidden="true">{displayValue}</motion.span>
    </span>;
}
