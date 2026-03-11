import React from 'react';

interface IndiiFaviconProps {
    size?: number;
    className?: string;
}

/**
 * Inline SVG of the indiiOS favicon — the stylized "ii" mark.
 * Cyan/teal gradient rounded square with two lowercase "i" characters (bars + dots).
 * Mirrors the design from `/public/favicon.svg` and `docs/assets/indiios-logo.svg`.
 */
export function IndiiFavicon({ size = 40, className = '' }: IndiiFaviconProps) {
    // Unique gradient ID to avoid collisions when multiple instances render
    const gradientId = `indii-bg-${size}`;

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
                <linearGradient id={gradientId} x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#00E5CC" />
                    <stop offset="100%" stopColor="#00B8D4" />
                </linearGradient>
            </defs>
            <rect width="512" height="512" rx="128" fill={`url(#${gradientId})`} />
            {/* Left "i" bar */}
            <rect x="161" y="200" width="60" height="176" rx="30" fill="white" />
            {/* Right "i" bar */}
            <rect x="291" y="200" width="60" height="176" rx="30" fill="white" />
            {/* Left "i" dot */}
            <circle cx="191" cy="148" r="30" fill="white" />
            {/* Right "i" dot */}
            <circle cx="321" cy="148" r="30" fill="white" />
        </svg>
    );
}
