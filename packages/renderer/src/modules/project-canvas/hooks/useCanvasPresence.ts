/**
 * useCanvasPresence.ts
 *
 * Real-time multi-user cursor, selection, and collaborator presence hook
 * for indii.music Project Canvas using Firestore ephemeral presence documents
 * at `projects/{projectId}/canvases/{canvasId}/presence/{userId}`.
 *
 * Capabilities:
 * - Ephemeral presence lifecycle: registers on mount, maintains heartbeat, unregisters on unmount.
 * - Disconnect & crash handling: cleans up on beforeunload/pagehide; filters out stale peers (>35s).
 * - Real-time cursors: converts screen mouse coordinates to spatial canvas coordinates and broadcasts throttled.
 * - Selection presence: broadcasts active selected block IDs to show collaborator focus halos.
 * - Resilient fail-soft: network or permission glitches are caught safely without disrupting local canvas editing.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { db, auth } from '@/services/firebase';
import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
} from 'firebase/firestore';
import type {
    CanvasPresenceState,
    CanvasViewport,
    WebRTCPeerStatus,
} from '../types';
import { CanvasPresenceSchema } from '../types';
import { WebRTCPresenceMesh } from '../services/WebRTCPresenceMesh';
import { logger } from '@/utils/logger';

export const COLLABORATOR_PALETTE = [
    '#06b6d4', // Cyan
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#3b82f6', // Blue
    '#f97316', // Orange
    '#a855f7', // Purple
    '#14b8a6', // Teal
] as const;

export function getCollaboratorColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = (hash << 5) - hash + userId.charCodeAt(i);
        hash |= 0;
    }
    const index = Math.abs(hash) % COLLABORATOR_PALETTE.length;
    return COLLABORATOR_PALETTE[index];
}

export interface UseCanvasPresenceOptions {
    projectId: string;
    canvasId: string;
    viewport: CanvasViewport;
    selectedBlockIds?: string[];
    containerRef?: React.RefObject<HTMLElement | null>;
    customUser?: {
        uid: string;
        displayName?: string | null;
        photoURL?: string | null;
    } | null;
    enabled?: boolean;
    heartbeatIntervalMs?: number;
    staleTimeoutMs?: number;
    cursorThrottleMs?: number;
}

export interface UseCanvasPresenceReturn {
    collaborators: CanvasPresenceState[];
    activeCollaboratorCount: number;
    selfPresence: CanvasPresenceState | null;
    selfColor: string;
    peerStatuses: WebRTCPeerStatus[];
    isWebRTCActive: boolean;
    updateCursor: (clientPos: { clientX: number; clientY: number } | null) => void;
    clearCursor: () => void;
}

export function useCanvasPresence({
    projectId,
    canvasId,
    viewport,
    selectedBlockIds = [],
    containerRef,
    customUser,
    enabled = true,
    heartbeatIntervalMs = 10000,
    staleTimeoutMs = 35000,
    cursorThrottleMs = 60,
}: UseCanvasPresenceOptions): UseCanvasPresenceReturn {
    const [collaborators, setCollaborators] = useState<CanvasPresenceState[]>([]);
    const [peerStatuses, setPeerStatuses] = useState<WebRTCPeerStatus[]>([]);
    const webrtcMeshRef = useRef<WebRTCPresenceMesh | null>(null);
    const lastCursorSentRef = useRef<number>(0);
    const pendingCursorRef = useRef<{ x: number; y: number } | null>(null);
    const cursorThrottleTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
    const isMountedRef = useRef(true);

    // Current user resolution
    const currentUserId = customUser?.uid || auth?.currentUser?.uid || 'anonymous_artist';
    const currentUserName =
        customUser?.displayName ||
        auth?.currentUser?.displayName ||
        (auth?.currentUser?.email ? auth.currentUser.email.split('@')[0] : 'Collaborator');
    const currentUserAvatar = customUser?.photoURL || auth?.currentUser?.photoURL || undefined;
    const selfColor = getCollaboratorColor(currentUserId);

    const selfPresenceRef = useRef<CanvasPresenceState>({
        userId: currentUserId,
        userName: currentUserName,
        userColor: selfColor,
        avatarUrl: currentUserAvatar,
        cursor: null,
        selectedBlockIds,
        lastSeen: 0,
    });

    useEffect(() => {
        selfPresenceRef.current.userName = currentUserName;
        selfPresenceRef.current.avatarUrl = currentUserAvatar;
        selfPresenceRef.current.selectedBlockIds = selectedBlockIds;
    }, [currentUserName, currentUserAvatar, selectedBlockIds]);

    const selfPresence: CanvasPresenceState = useMemo(() => ({
        userId: currentUserId,
        userName: currentUserName,
        userColor: selfColor,
        avatarUrl: currentUserAvatar,
        cursor: null,
        selectedBlockIds,
        lastSeen: 0,
    }), [currentUserId, currentUserName, selfColor, currentUserAvatar, selectedBlockIds]);

    const presenceDocRef = useRef(
        projectId && canvasId && currentUserId && db
            ? doc(db, 'projects', projectId, 'canvases', canvasId, 'presence', currentUserId)
            : null
    );

    useEffect(() => {
        if (projectId && canvasId && currentUserId && db) {
            presenceDocRef.current = doc(db, 'projects', projectId, 'canvases', canvasId, 'presence', currentUserId);
        } else {
            presenceDocRef.current = null;
        }
    }, [projectId, canvasId, currentUserId]);

    // Initialize WebRTC Presence Mesh for sub-20ms peer-to-peer cursor presence
    useEffect(() => {
        if (!enabled || !projectId || !canvasId || !currentUserId) {
            if (webrtcMeshRef.current) {
                webrtcMeshRef.current.destroy();
                webrtcMeshRef.current = null;
            }
            return;
        }

        try {
            const mesh = new WebRTCPresenceMesh({
                projectId,
                canvasId,
                userId: currentUserId,
                userName: currentUserName,
                userColor: selfColor,
                avatarUrl: currentUserAvatar,
                onCursorReceived: (peerId, cursor, state) => {
                    setCollaborators((prev) => {
                        const idx = prev.findIndex((p) => p.userId === peerId);
                        if (idx >= 0) {
                            const updated = [...prev];
                            updated[idx] = {
                                ...updated[idx],
                                cursor,
                                lastSeen: Date.now(),
                            };
                            return updated;
                        }
                        return [
                            ...prev,
                            {
                                userId: peerId,
                                userName: state.userName || 'Collaborator',
                                userColor: state.userColor || getCollaboratorColor(peerId),
                                avatarUrl: state.avatarUrl,
                                cursor,
                                selectedBlockIds: state.selectedBlockIds || [],
                                lastSeen: Date.now(),
                            },
                        ];
                    });
                },
                onSelectionReceived: (peerId, remoteSelectedBlockIds) => {
                    setCollaborators((prev) => {
                        const idx = prev.findIndex((p) => p.userId === peerId);
                        if (idx >= 0) {
                            const updated = [...prev];
                            updated[idx] = {
                                ...updated[idx],
                                selectedBlockIds: remoteSelectedBlockIds,
                                lastSeen: Date.now(),
                            };
                            return updated;
                        }
                        return prev;
                    });
                },
                onPeerStatusChange: (statuses) => {
                    setPeerStatuses(statuses);
                },
            });

            webrtcMeshRef.current = mesh;
        } catch (err) {
            logger.warn('[useCanvasPresence] WebRTC initialization skipped or failed:', err);
        }

        return () => {
            if (webrtcMeshRef.current) {
                webrtcMeshRef.current.destroy();
                webrtcMeshRef.current = null;
            }
        };
    }, [enabled, projectId, canvasId, currentUserId, currentUserName, selfColor, currentUserAvatar]);

    // Send presence payload helper (Firestore)
    const sendPresence = useCallback(
        async (payload: Partial<CanvasPresenceState>) => {
            if (!enabled || !presenceDocRef.current || !db) return;

            const updated: CanvasPresenceState = {
                ...selfPresenceRef.current,
                ...payload,
                lastSeen: Date.now(),
            };
            selfPresenceRef.current = updated;

            try {
                await setDoc(presenceDocRef.current, updated, { merge: true });
            } catch (err) {
                logger.warn('[useCanvasPresence] Failed to publish presence heartbeat', err);
            }
        },
        [enabled]
    );

    // Update cursor position from client coordinates (hybrid: WebRTC P2P first, Firestore fallback)
    const updateCursor = useCallback(
        (clientPos: { clientX: number; clientY: number } | null) => {
            if (!enabled || !presenceDocRef.current) return;

            if (!clientPos) {
                pendingCursorRef.current = null;
                webrtcMeshRef.current?.broadcastCursor(null);
                sendPresence({ cursor: null });
                return;
            }

            let canvasX = clientPos.clientX;
            let canvasY = clientPos.clientY;

            if (containerRef?.current) {
                const rect = containerRef.current.getBoundingClientRect();
                canvasX = (clientPos.clientX - rect.left - viewport.x) / viewport.zoom;
                canvasY = (clientPos.clientY - rect.top - viewport.y) / viewport.zoom;
            } else {
                canvasX = (clientPos.clientX - viewport.x) / viewport.zoom;
                canvasY = (clientPos.clientY - viewport.y) / viewport.zoom;
            }

            const newCursor = { x: Math.round(canvasX), y: Math.round(canvasY) };
            pendingCursorRef.current = newCursor;

            // Instantaneous WebRTC DataChannel dispatch (0 Firestore writes)
            const sentViaWebRTC = webrtcMeshRef.current?.broadcastCursor(newCursor);
            if (sentViaWebRTC) {
                return;
            }

            // Fallback to throttled Firestore writes when WebRTC has no open channels
            const now = Date.now();
            if (now - lastCursorSentRef.current >= cursorThrottleMs) {
                lastCursorSentRef.current = now;
                sendPresence({ cursor: newCursor });
            } else if (!cursorThrottleTimerRef.current) {
                cursorThrottleTimerRef.current = setTimeout(() => {
                    cursorThrottleTimerRef.current = null;
                    if (isMountedRef.current && pendingCursorRef.current) {
                        lastCursorSentRef.current = Date.now();
                        sendPresence({ cursor: pendingCursorRef.current });
                    }
                }, cursorThrottleMs);
            }
        },
        [enabled, viewport, containerRef, cursorThrottleMs, sendPresence]
    );

    const clearCursor = useCallback(() => {
        updateCursor(null);
    }, [updateCursor]);

    // Broadcast selection changes
    const isFirstSelectionRender = useRef(true);
    useEffect(() => {
        if (!enabled) return;
        if (isFirstSelectionRender.current) {
            isFirstSelectionRender.current = false;
            return;
        }
        webrtcMeshRef.current?.broadcastSelection(selectedBlockIds);
        sendPresence({ selectedBlockIds });
    }, [selectedBlockIds, enabled, sendPresence]);

    // Heartbeat loop & unmount cleanup
    useEffect(() => {
        if (!enabled || !projectId || !canvasId || !db) return;

        isMountedRef.current = true;

        // Register initial presence
        sendPresence({
            cursor: null,
            selectedBlockIds,
        });

        // Periodic heartbeat
        const heartbeatTimer = setInterval(() => {
            sendPresence({});
        }, heartbeatIntervalMs);

        // Cleanup on browser exit
        const handleUnload = () => {
            if (presenceDocRef.current) {
                deleteDoc(presenceDocRef.current).catch(() => {});
            }
        };

        window.addEventListener('beforeunload', handleUnload);
        window.addEventListener('pagehide', handleUnload);

        return () => {
            isMountedRef.current = false;
            clearInterval(heartbeatTimer);
            if (cursorThrottleTimerRef.current) {
                clearTimeout(cursorThrottleTimerRef.current);
            }
            window.removeEventListener('beforeunload', handleUnload);
            window.removeEventListener('pagehide', handleUnload);

            // Best-effort delete on component unmount
            if (presenceDocRef.current) {
                deleteDoc(presenceDocRef.current).catch(() => {});
            }
        };
    }, [enabled, projectId, canvasId, heartbeatIntervalMs, sendPresence, selectedBlockIds]);

    useEffect(() => {
        if (!enabled || !projectId || !canvasId || !db) {
            return;
        }

        const presenceCollectionRef = collection(
            db,
            'projects',
            projectId,
            'canvases',
            canvasId,
            'presence'
        );

        const unsubscribe = onSnapshot(
            presenceCollectionRef,
            (snapshot) => {
                const now = Date.now();
                const peers: CanvasPresenceState[] = [];

                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const parsed = CanvasPresenceSchema.safeParse(data);

                    if (!parsed.success) return;

                    const presence = parsed.data;

                    // Omit current user's own presence
                    if (presence.userId === currentUserId) return;

                    // Omit stale presence records
                    if (now - presence.lastSeen > staleTimeoutMs) return;

                    peers.push(presence);
                });

                setCollaborators(peers);

                // Reconcile active peers with WebRTC mesh
                webrtcMeshRef.current?.syncPeers(peers.map((p) => p.userId));
            },
            (error) => {
                logger.warn('[useCanvasPresence] Presence subscription error', error);
            }
        );

        return () => {
            unsubscribe();
        };
    }, [enabled, projectId, canvasId, currentUserId, staleTimeoutMs]);

    const isWebRTCActive = useMemo(
        () => peerStatuses.some((s) => s.dataChannelState === 'open'),
        [peerStatuses]
    );

    return {
        collaborators,
        activeCollaboratorCount: collaborators.length,
        selfPresence,
        selfColor,
        peerStatuses,
        isWebRTCActive,
        updateCursor,
        clearCursor,
    };
}
