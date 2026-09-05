/**
 * CanvasPresenceLayer.tsx
 *
 * Visual layer rendering live multiplayer collaborator cursors, names,
 * avatars, and selection focus halos in the Project Canvas spatial plane.
 *
 * Guarantees:
 * 1. Hardware accelerated translation via CSS translate3d.
 * 2. Non-blocking: Completely pointer-events-none; never intercepts clicks/drags.
 * 3. Selection visibility: Outlines blocks currently selected by remote collaborators.
 * 4. Distinct color identity: Each collaborator renders with their distinct theme color.
 */

import React from 'react';
import type { CanvasPresenceState, ProjectCanvasBlock } from '../../types';

interface CanvasPresenceLayerProps {
    collaborators: CanvasPresenceState[];
    blocks?: ProjectCanvasBlock[];
}

export const CanvasPresenceLayer: React.FC<CanvasPresenceLayerProps> = ({
    collaborators,
    blocks = [],
}) => {
    // Map blocks for fast lookup of selection halos
    const blockMap = React.useMemo(() => {
        const map = new Map<string, ProjectCanvasBlock>();
        for (const b of blocks) {
            map.set(b.id, b);
        }
        return map;
    }, [blocks]);

    return (
        <div
            className="absolute inset-0 pointer-events-none z-30 overflow-visible"
            aria-label="Collaborator Presence Layer"
            role="region"
            data-testid="canvas-presence-layer"
        >
            {/* Remote Selection Halos */}
            {collaborators.map((collab) => {
                if (!collab.selectedBlockIds || collab.selectedBlockIds.length === 0) return null;

                return (
                    <React.Fragment key={`selection-${collab.userId}`}>
                        {collab.selectedBlockIds.map((blockId) => {
                            const block = blockMap.get(blockId);
                            if (!block) return null;

                            return (
                                <div
                                    key={`halo-${collab.userId}-${blockId}`}
                                    className="absolute rounded-xl border-2 pointer-events-none transition-all duration-150"
                                    style={{
                                        transform: `translate3d(${block.position.x - 4}px, ${block.position.y - 4}px, 0)`,
                                        width: `${block.size.width + 8}px`,
                                        height: `${block.size.height + 8}px`,
                                        borderColor: collab.userColor,
                                        boxShadow: `0 0 12px ${collab.userColor}33`,
                                    }}
                                    data-testid="collaborator-selection-halo"
                                    data-collaborator-id={collab.userId}
                                >
                                    <span
                                        className="absolute -top-3 left-2 px-1.5 py-0.2 text-[9px] font-semibold text-black rounded shadow-sm tracking-wide flex items-center gap-1"
                                        style={{ backgroundColor: collab.userColor }}
                                    >
                                        {collab.userName}
                                    </span>
                                </div>
                            );
                        })}
                    </React.Fragment>
                );
            })}

            {/* Remote Cursors */}
            {collaborators.map((collab) => {
                if (!collab.cursor) return null;

                return (
                    <div
                        key={`cursor-${collab.userId}`}
                        className="absolute top-0 left-0 pointer-events-none transition-transform duration-75 ease-out will-change-transform"
                        style={{
                            transform: `translate3d(${collab.cursor.x}px, ${collab.cursor.y}px, 0)`,
                        }}
                        data-testid="collaborator-cursor"
                        data-collaborator-id={collab.userId}
                        aria-label={`Cursor of ${collab.userName}`}
                    >
                        {/* Custom SVG Mouse Pointer */}
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="drop-shadow-md -translate-x-0.5 -translate-y-0.5"
                        >
                            <path
                                d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
                                fill={collab.userColor}
                                stroke="white"
                                strokeWidth="1.5"
                            />
                        </svg>

                        {/* Collaborator Name Badge */}
                        <div
                            className="absolute left-4 top-3 px-2 py-0.5 rounded-full text-[11px] font-medium text-white shadow-lg whitespace-nowrap flex items-center gap-1.5"
                            style={{
                                backgroundColor: collab.userColor,
                                border: '1px solid rgba(255, 255, 255, 0.4)',
                            }}
                        >
                            {collab.avatarUrl ? (
                                <img
                                    src={collab.avatarUrl}
                                    alt={collab.userName}
                                    className="w-3.5 h-3.5 rounded-full object-cover"
                                />
                            ) : (
                                <span className="w-3.5 h-3.5 rounded-full bg-black/30 flex items-center justify-center text-[8px] font-bold">
                                    {collab.userName.charAt(0).toUpperCase()}
                                </span>
                            )}
                            <span className="font-semibold text-zinc-950 text-[10px]">
                                {collab.userName}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

/**
 * CollaboratorPills
 *
 * Compact presence indicator displaying active collaborator avatars
 * suitable for embedding in toolbars or HUDs.
 */
export const CollaboratorPills: React.FC<{
    collaborators: CanvasPresenceState[];
    className?: string;
}> = ({ collaborators, className = '' }) => {
    if (collaborators.length === 0) return null;

    return (
        <div
            className={`flex items-center -space-x-1.5 overflow-hidden ${className}`}
            data-testid="collaborator-pills"
            aria-label={`${collaborators.length} active collaborator${collaborators.length > 1 ? 's' : ''}`}
        >
            {collaborators.map((c) => (
                <div
                    key={c.userId}
                    className="relative group w-6 h-6 rounded-full border-2 border-zinc-900 overflow-hidden flex items-center justify-center text-[10px] font-bold text-black"
                    style={{ backgroundColor: c.userColor }}
                    title={`${c.userName} (online)`}
                >
                    {c.avatarUrl ? (
                        <img src={c.avatarUrl} alt={c.userName} className="w-full h-full object-cover" />
                    ) : (
                        c.userName.charAt(0).toUpperCase()
                    )}
                </div>
            ))}
        </div>
    );
};
