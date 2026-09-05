/**
 * canvasPresence.test.tsx
 *
 * Comprehensive tests for Project Canvas multiplayer presence:
 * - Ephemeral presence lifecycle (registration, heartbeat, unmount cleanup)
 * - Real-time throttled cursor positioning in spatial coordinates
 * - Selection presence and focus halos
 * - Stale and self-presence filtering
 * - Visual CanvasPresenceLayer and CollaboratorPills rendering
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, screen, act } from '@testing-library/react';
import {
    useCanvasPresence,
    getCollaboratorColor,
    COLLABORATOR_PALETTE,
} from '../hooks/useCanvasPresence';
import {
    CanvasPresenceLayer,
    CollaboratorPills,
} from '../components/presence/CanvasPresenceLayer';
import type { CanvasPresenceState, ProjectCanvasBlock } from '../types';
import { setDoc, deleteDoc } from 'firebase/firestore';

// Mock Firebase
vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'alice_123', displayName: 'Alice Artist' } },
    db: { type: 'firestore' },
}));

vi.mock('firebase/firestore', () => {
    let snapshotCallback: ((snapshot: any) => void) | null = null;

    return {
        collection: vi.fn((_db, ...paths) => ({ path: paths.join('/') })),
        doc: vi.fn((_db, ...paths) => ({ path: paths.join('/') })),
        setDoc: vi.fn().mockResolvedValue(undefined),
        deleteDoc: vi.fn().mockResolvedValue(undefined),
        onSnapshot: vi.fn((_ref, cb) => {
            snapshotCallback = cb;
            return vi.fn(); // unsubscribe
        }),
        __triggerSnapshot: (docs: any[]) => {
            if (snapshotCallback) {
                snapshotCallback({
                    forEach: (fn: (doc: any) => void) => {
                        docs.forEach((data) => {
                            fn({ data: () => data });
                        });
                    },
                });
            }
        },
    };
});

describe('Project Canvas Multiplayer Presence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('getCollaboratorColor', () => {
        it('returns a valid color from COLLABORATOR_PALETTE deterministically', () => {
            const color1 = getCollaboratorColor('user_abc');
            const color2 = getCollaboratorColor('user_abc');
            const color3 = getCollaboratorColor('user_xyz');

            expect(color1).toBe(color2);
            expect(COLLABORATOR_PALETTE).toContain(color1);
            expect(COLLABORATOR_PALETTE).toContain(color3);
        });
    });

    describe('useCanvasPresence Hook', () => {
        const defaultProps = {
            projectId: 'proj_presence',
            canvasId: 'canvas_presence',
            viewport: { x: 100, y: 50, zoom: 1.0 },
            selectedBlockIds: ['block_1'],
        };

        it('registers presence on mount with initial state and heartbeat', async () => {
            renderHook(() => useCanvasPresence(defaultProps));

            // Initial registration
            expect(setDoc).toHaveBeenCalledWith(
                expect.objectContaining({ path: 'projects/proj_presence/canvases/canvas_presence/presence/alice_123' }),
                expect.objectContaining({
                    userId: 'alice_123',
                    userName: 'Alice Artist',
                    cursor: null,
                    selectedBlockIds: ['block_1'],
                }),
                { merge: true }
            );

            // Fast forward 10 seconds for heartbeat
            act(() => {
                vi.advanceTimersByTime(10000);
            });

            expect(setDoc).toHaveBeenCalledTimes(2);
        });

        it('deletes presence record on unmount', () => {
            const { unmount } = renderHook(() => useCanvasPresence(defaultProps));

            unmount();

            expect(deleteDoc).toHaveBeenCalledWith(
                expect.objectContaining({ path: 'projects/proj_presence/canvases/canvas_presence/presence/alice_123' }),
            );
        });

        it('calculates spatial canvas coordinates on cursor update', async () => {
            const { result } = renderHook(() =>
                useCanvasPresence({
                    ...defaultProps,
                    viewport: { x: 100, y: 50, zoom: 2.0 },
                }),
            );

            // Cursor moved to clientX: 300, clientY: 250
            // spatialX = (300 - 100) / 2 = 100
            // spatialY = (250 - 50) / 2 = 100
            act(() => {
                result.current.updateCursor({ clientX: 300, clientY: 250 });
            });

            expect(setDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    cursor: { x: 100, y: 100 },
                }),
                { merge: true },
            );
        });

        it('clears cursor on clearCursor', () => {
            const { result } = renderHook(() => useCanvasPresence(defaultProps));

            act(() => {
                result.current.clearCursor();
            });

            expect(setDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    cursor: null,
                }),
                { merge: true },
            );
        });

        it('filters out self presence and stale presence records from peer list', async () => {
            const { result } = renderHook(() => useCanvasPresence(defaultProps));

            const now = Date.now();
            const { __triggerSnapshot } = (await import('firebase/firestore')) as any;

            act(() => {
                __triggerSnapshot([
                    // Self: should be filtered out
                    {
                        userId: 'alice_123',
                        userName: 'Alice',
                        userColor: '#06b6d4',
                        cursor: { x: 10, y: 10 },
                        selectedBlockIds: [],
                        lastSeen: now,
                    },
                    // Stale peer (> 35s): should be filtered out
                    {
                        userId: 'stale_bob',
                        userName: 'Bob Stale',
                        userColor: '#ec4899',
                        cursor: { x: 50, y: 50 },
                        selectedBlockIds: [],
                        lastSeen: now - 45000,
                    },
                    // Active collaborator: should be retained
                    {
                        userId: 'active_carol',
                        userName: 'Carol Producer',
                        userColor: '#8b5cf6',
                        cursor: { x: 200, y: 300 },
                        selectedBlockIds: ['block_music_1'],
                        lastSeen: now - 2000,
                    },
                ]);
            });

            expect(result.current.collaborators.length).toBe(1);
            expect(result.current.collaborators[0].userId).toBe('active_carol');
            expect(result.current.collaborators[0].userName).toBe('Carol Producer');
        });
    });

    describe('CanvasPresenceLayer Component', () => {
        const mockBlocks: ProjectCanvasBlock[] = [
            {
                id: 'block_asset_1',
                canvasId: 'c1',
                projectId: 'p1',
                type: 'asset',
                position: { x: 200, y: 150 },
                size: { width: 300, height: 200 },
                zIndex: 1,
                createdAt: 1700000000000,
                updatedAt: 1700000000000,
            },
        ];

        const mockCollaborators: CanvasPresenceState[] = [
            {
                userId: 'collab_1',
                userName: 'Maya Director',
                userColor: '#ec4899',
                avatarUrl: 'https://example.com/maya.png',
                cursor: { x: 250, y: 180 },
                selectedBlockIds: ['block_asset_1'],
                lastSeen: Date.now(),
            },
            {
                userId: 'collab_2',
                userName: 'Devin Mixer',
                userColor: '#10b981',
                cursor: null, // Mouse off-screen
                selectedBlockIds: [],
                lastSeen: Date.now(),
            },
        ];

        it('renders collaborator cursor with pointer and name badge', () => {
            render(<CanvasPresenceLayer collaborators={mockCollaborators} blocks={mockBlocks} />);

            expect(screen.getByTestId('canvas-presence-layer')).toBeInTheDocument();
            expect(screen.getByTestId('collaborator-cursor')).toBeInTheDocument();
            expect(screen.getAllByText('Maya Director').length).toBeGreaterThanOrEqual(1);
            expect(screen.getByAltText('Maya Director')).toHaveAttribute('src', 'https://example.com/maya.png');

            // Collab 2 has cursor: null, so only 1 cursor element rendered
            expect(screen.getAllByTestId('collaborator-cursor').length).toBe(1);
        });

        it('renders collaborator selection halo around targeted block', () => {
            render(<CanvasPresenceLayer collaborators={mockCollaborators} blocks={mockBlocks} />);

            const halo = screen.getByTestId('collaborator-selection-halo');
            expect(halo).toBeInTheDocument();
            expect(halo).toHaveAttribute('data-collaborator-id', 'collab_1');
        });

        it('has pointer-events-none to prevent blocking interaction', () => {
            render(<CanvasPresenceLayer collaborators={mockCollaborators} blocks={mockBlocks} />);

            const layer = screen.getByTestId('canvas-presence-layer');
            expect(layer).toHaveClass('pointer-events-none');
        });
    });

    describe('CollaboratorPills Component', () => {
        const mockCollaborators: CanvasPresenceState[] = [
            {
                userId: 'u1',
                userName: 'Liam',
                userColor: '#06b6d4',
                cursor: null,
                selectedBlockIds: [],
                lastSeen: Date.now(),
            },
            {
                userId: 'u2',
                userName: 'Zoe',
                userColor: '#8b5cf6',
                cursor: null,
                selectedBlockIds: [],
                lastSeen: Date.now(),
            },
        ];

        it('renders active collaborator avatar circles with initials and tooltips', () => {
            render(<CollaboratorPills collaborators={mockCollaborators} />);

            const pills = screen.getByTestId('collaborator-pills');
            expect(pills).toBeInTheDocument();
            expect(screen.getByText('L')).toBeInTheDocument();
            expect(screen.getByText('Z')).toBeInTheDocument();
        });

        it('returns null when no collaborators are present', () => {
            const { container } = render(<CollaboratorPills collaborators={[]} />);
            expect(container.firstChild).toBeNull();
        });
    });
});
