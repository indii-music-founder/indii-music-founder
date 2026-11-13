import type { ReactNode } from 'react';

/** Keep workspace state mounted while an overlapping workspace owns interaction. */
export function WorkspaceBackground({ inactive, children, className }: {
    inactive: boolean;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={className}
            aria-hidden={inactive || undefined}
            ref={element => {
                if (element) element.inert = inactive;
            }}
        >
            {children}
        </div>
    );
}
