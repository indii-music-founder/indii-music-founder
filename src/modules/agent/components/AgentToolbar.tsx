import React, { ReactNode } from 'react';

interface AgentToolbarProps {
    children?: ReactNode;
    left?: ReactNode;
    right?: ReactNode;
    className?: string;
}

export const AgentToolbar: React.FC<AgentToolbarProps> = ({ children, left, right, className = '' }) => {
    return (
        <div className={`h-14 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center px-6 gap-6 flex-shrink-0 z-10 sticky top-0 ${className}`}>
            {left && <div className="flex items-center gap-4 mr-auto">{left}</div>}
            <div className="flex items-center gap-4 flex-1 justify-center">
                {children}
            </div>
            {right && <div className="flex items-center gap-4 ml-auto">{right}</div>}
        </div>
    );
};
