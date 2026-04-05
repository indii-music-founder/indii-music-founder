import React, { ReactNode } from 'react';

interface StudioToolbarProps {
    children?: ReactNode;
    className?: string;
    left?: ReactNode;
    right?: ReactNode;
}

export function StudioToolbar({ children, className = "", left, right }: StudioToolbarProps) {
    return (
        <div className={`h-12 border-b border-[--border] bg-[--background]/80 backdrop-blur-md flex items-center px-4 gap-4 flex-shrink-0 z-10 sticky top-0 ${className}`}>
            {left && <div className="flex items-center gap-2 mr-auto">{left}</div>}
            <div className="flex items-center gap-2 flex-1 justify-center md:justify-start">
                {children}
            </div>
            {right && <div className="flex items-center gap-2 ml-auto">{right}</div>}
        </div>
    );
}
