import React from 'react';

interface IndiiFaviconProps {
    size?: number;
    className?: string;
}

/**
 * Inline SVG of the indiiOS favicon — the stylized "ii" with yellow dots.
 * Mirrors the design from `/public/favicon.svg` for use as a React component.
 */
export function IndiiFavicon({ size = 40, className = '' }: IndiiFaviconProps) {
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
            <rect width="512" height="512" rx="128" fill="#0f0f0f" />
            <path d="M192 352V224" stroke="white" strokeWidth="48" strokeLinecap="round" />
            <path d="M320 352V224" stroke="white" strokeWidth="48" strokeLinecap="round" />
            <circle cx="192" cy="160" r="24" fill="#FACC15" />
            <circle cx="320" cy="160" r="24" fill="#FACC15" />
        </svg>
    );
}
