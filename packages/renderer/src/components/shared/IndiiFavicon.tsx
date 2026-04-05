import React from 'react';

interface IndiiFaviconProps {
    size?: number;
    className?: string;
}

/**
 * Inline SVG of the indiiOS favicon — the stylized "ii" mark.
 * Cyan/teal gradient outer rounded square with a dark inset inner panel
 * and teal-colored lowercase "i" characters (bars + dots).
 * Matches the brand mark from the README banner and `/public/favicon.svg`.
 */
export function IndiiFavicon({ size = 40, className = '' }: IndiiFaviconProps) {
    const id = `indii-${size}`;

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 512 512"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-label="indiiOS logo"
        >
            <defs>
                <linearGradient id={`${id}-outer`} x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#00E5CC" />
                    <stop offset="100%" stopColor="#00B8D4" />
                </linearGradient>
                <linearGradient id={`${id}-ii`} x1="180" y1="120" x2="340" y2="400" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#00E5CC" />
                    <stop offset="100%" stopColor="#00B8D4" />
                </linearGradient>
            </defs>
            {/* Outer rounded square: cyan/teal gradient */}
            <rect width="512" height="512" rx="128" fill={`url(#${id}-outer)`} />
            {/* Inner dark inset panel */}
            <rect x="48" y="48" width="416" height="416" rx="96" fill="#0C0C1A" />
            {/* Left "i" dot */}
            <circle cx="200" cy="155" r="28" fill={`url(#${id}-ii)`} />
            {/* Right "i" dot */}
            <circle cx="312" cy="155" r="28" fill={`url(#${id}-ii)`} />
            {/* Left "i" bar */}
            <rect x="174" y="210" width="52" height="160" rx="26" fill={`url(#${id}-ii)`} />
            {/* Right "i" bar */}
            <rect x="286" y="210" width="52" height="160" rx="26" fill={`url(#${id}-ii)`} />
        </svg>
    );
}
