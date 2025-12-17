'use client';

import { motion } from 'framer-motion';

export default function BreathingText({
    children,
    className,
    invert = false
}: {
    children: React.ReactNode;
    className?: string;
    invert?: boolean;
}) {
    // Standard: Blur -> Focus -> Blur
    // Starts blurred/transparent (0.5 opacity) -> Focus (1 opacity) -> Blur
    // Keyframes with "dwell" time for perfect focus
    // Sequence: Start Blur -> Fade In -> Hold Focus -> Fade Out -> End Blur

    // Keyframes for "Hero Swap" Teeter-Totter
    // Designed so that when one is sharp, the other is completely ghosted.
    // Transition window is 15% of the cycle.

    // Sharp State Definition: Opacity 1, Blur 0px, Tight Shadow (Pixel Perfect)
    // Ghost State Definition: Opacity 0.1, Blur 12px, No Shadow

    // Standard (Your Rules): Starts Ghost -> Becomes Sharp -> Becomes Ghost
    // 0-35%: Ghost (Wait for partner)
    // 35-50%: Transition to Sharp
    // 50-85%: Sharp (Hero Moment - PURE PIXELS, NO GLOW)
    // 85-100%: Transition to Ghost
    const standardOpacity = [0.1, 0.1, 1, 1, 0.1];
    const standardBlur = ["blur(12px)", "blur(12px)", "blur(0px)", "blur(0px)", "blur(12px)"];
    const standardShadow = [
        "0 0 0px rgba(255,255,255,0)",
        "0 0 0px rgba(255,255,255,0)",
        "0 0 0px rgba(255,255,255,0)", // Removed glow for max clarity
        "0 0 0px rgba(255,255,255,0)",
        "0 0 0px rgba(255,255,255,0)"
    ];

    // Inverted (Your Music): Starts Sharp -> Becomes Ghost -> Becomes Sharp
    // 0-35%: Sharp (Hero Moment)
    // 35-50%: Transition to Ghost
    // 50-85%: Ghost (Wait for partner)
    // 85-100%: Transition to Sharp
    const invertedOpacity = [1, 1, 0.1, 0.1, 1];
    const invertedBlur = ["blur(0px)", "blur(0px)", "blur(12px)", "blur(12px)", "blur(0px)"];
    const invertedShadow = [
        "0 0 0px rgba(255,255,255,0)", // Removed glow for max clarity
        "0 0 0px rgba(255,255,255,0)",
        "0 0 0px rgba(255,255,255,0)",
        "0 0 0px rgba(255,255,255,0)",
        "0 0 0px rgba(255,255,255,0)"
    ];

    return (
        <motion.span
            className={className}
            animate={{
                opacity: invert ? invertedOpacity : standardOpacity,
                filter: invert ? invertedBlur : standardBlur,
                textShadow: invert ? invertedShadow : standardShadow
            }}
            transition={{
                duration: 7, // Slow, deliberate breathing
                repeat: Infinity,
                ease: "easeInOut",
                times: [0, 0.35, 0.5, 0.85, 1] // The choreography
            }}
        >
            {children}
        </motion.span>
    );
}
