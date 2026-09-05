/**
 * WebRTCPresenceMesh.ts
 *
 * Real-time peer-to-peer WebRTC DataChannel presence mesh for Project Canvas.
 * Delivers sub-20ms cursor and selection synchronization directly between
 * connected collaborator browsers with ZERO Firestore write operations per cursor frame.
 *
 * Architecture:
 * - Signaling: Uses Firestore ephemeral signals collection
 *   `projects/{projectId}/canvases/{canvasId}/signals/{signalId}` to negotiate
 *   SDP offers, answers, and ICE candidates.
 * - Transport: Unreliable, unordered WebRTC DataChannels ('indii-canvas-presence')
 *   for 60fps cursor streaming without head-of-line blocking.
 * - Glare Resolution: Deterministic initiator hierarchy (higher userId initiates)
 *   to eliminate race conditions when both peers discover each other simultaneously.
 * - Hybrid Resilience: Exposes `hasActiveDataChannels()` so hooks can seamlessly
 *   fall back to throttled Firestore writes when WebRTC is unavailable.
 */

import { db } from '@/services/firebase';
import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
} from 'firebase/firestore';
import type {
    CanvasPresenceState,
    WebRTCSignalMessage,
    WebRTCSignalType,
    WebRTCPeerStatus,
} from '../types';
import { WebRTCSignalMessageSchema } from '../types';
import { logger } from '@/utils/logger';

export const RTC_ICE_CONFIG: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

export interface WebRTCPresenceMeshOptions {
    projectId: string;
    canvasId: string;
    userId: string;
    userName: string;
    userColor: string;
    avatarUrl?: string;
    onCursorReceived?: (peerId: string, cursor: { x: number; y: number }, state: Partial<CanvasPresenceState>) => void;
    onSelectionReceived?: (peerId: string, selectedBlockIds: string[]) => void;
    onPeerStatusChange?: (statuses: WebRTCPeerStatus[]) => void;
}

export class WebRTCPresenceMesh {
    private projectId: string;
    private canvasId: string;
    private userId: string;
    private userName: string;
    private userColor: string;
    private avatarUrl?: string;

    private peerConnections: Map<string, RTCPeerConnection> = new Map();
    private dataChannels: Map<string, RTCDataChannel> = new Map();
    private peerStats: Map<string, { bytesSent: number; bytesReceived: number; latencyMs?: number }> = new Map();
    private unsubscribeSignals?: () => void;
    private isDestroyed = false;

    private onCursorReceived?: (peerId: string, cursor: { x: number; y: number }, state: Partial<CanvasPresenceState>) => void;
    private onSelectionReceived?: (peerId: string, selectedBlockIds: string[]) => void;
    private onPeerStatusChange?: (statuses: WebRTCPeerStatus[]) => void;

    constructor(options: WebRTCPresenceMeshOptions) {
        this.projectId = options.projectId;
        this.canvasId = options.canvasId;
        this.userId = options.userId;
        this.userName = options.userName;
        this.userColor = options.userColor;
        this.avatarUrl = options.avatarUrl;
        this.onCursorReceived = options.onCursorReceived;
        this.onSelectionReceived = options.onSelectionReceived;
        this.onPeerStatusChange = options.onPeerStatusChange;

        this.initSignaling();
    }

    /**
     * Start listening for incoming WebRTC signaling messages in Firestore.
     */
    private initSignaling(): void {
        if (typeof RTCPeerConnection === 'undefined') return;
        if (!db || !this.projectId || !this.canvasId || !this.userId) return;

        try {
            const signalsCol = collection(
                db,
                'projects',
                this.projectId,
                'canvases',
                this.canvasId,
                'signals'
            );

            const signalsQuery = query(signalsCol, where('toUserId', '==', this.userId));

            this.unsubscribeSignals = onSnapshot(
                signalsQuery,
                (snapshot) => {
                    if (this.isDestroyed) return;
                    snapshot.docChanges().forEach((change) => {
                        if (change.type === 'added') {
                            const data = change.doc.data();
                            const parsed = WebRTCSignalMessageSchema.safeParse(data);
                            if (parsed.success) {
                                this.handleIncomingSignal(parsed.data);
                            }
                            // Delete transient signal document after consumption
                            deleteDoc(change.doc.ref).catch(() => {});
                        }
                    });
                },
                (err) => {
                    logger.warn('[WebRTCPresenceMesh] Signaling listener warning:', err);
                }
            );
        } catch (err) {
            logger.warn('[WebRTCPresenceMesh] Signaling initialization error:', err);
        }
    }

    /**
     * Reconcile known active peers from Firestore presence list.
     * Initiates WebRTC connections to newly discovered peers.
     */
    public syncPeers(activePeerUserIds: string[]): void {
        if (this.isDestroyed || typeof RTCPeerConnection === 'undefined') return;

        const currentKnownPeers = new Set(activePeerUserIds.filter((id) => id !== this.userId));

        // Connect to new peers
        for (const peerId of currentKnownPeers) {
            if (!this.peerConnections.has(peerId)) {
                // Deterministic initiator: peer with alphabetically higher userId creates offer
                const isInitiator = this.userId > peerId;
                const pc = this.setupPeerConnection(peerId, isInitiator);
                if (!pc) return;
            }
        }

        // Prune peers that are no longer active
        for (const [peerId, pc] of this.peerConnections.entries()) {
            if (!currentKnownPeers.has(peerId)) {
                pc.close();
                this.peerConnections.delete(peerId);
                const dc = this.dataChannels.get(peerId);
                if (dc) {
                    dc.close();
                    this.dataChannels.delete(peerId);
                }
                this.peerStats.delete(peerId);
            }
        }

        this.emitStatuses();
    }

    private setupPeerConnection(peerId: string, isInitiator: boolean): RTCPeerConnection | null {
        if (typeof RTCPeerConnection === 'undefined') {
            return null;
        }

        const pc = new RTCPeerConnection(RTC_ICE_CONFIG);
        this.peerConnections.set(peerId, pc);
        this.peerStats.set(peerId, { bytesSent: 0, bytesReceived: 0 });

        pc.onicecandidate = (event) => {
            if (event.candidate && !this.isDestroyed) {
                this.sendSignal(peerId, 'candidate', event.candidate.toJSON() as Record<string, unknown>);
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                this.dataChannels.delete(peerId);
            }
            this.emitStatuses();
        };

        if (isInitiator) {
            // Unreliable, unordered channel is ideal for high-frequency cursor updates
            const dc = pc.createDataChannel('indii-canvas-presence', {
                ordered: false,
                maxRetransmits: 0,
            });
            this.attachDataChannelEvents(peerId, dc);
            this.dataChannels.set(peerId, dc);

            pc.createOffer()
                .then((offer) => pc.setLocalDescription(offer))
                .then(() => {
                    if (pc.localDescription) {
                        this.sendSignal(peerId, 'offer', {
                            type: pc.localDescription.type,
                            sdp: pc.localDescription.sdp,
                        });
                    }
                })
                .catch((err) => {
                    logger.warn(`[WebRTCPresenceMesh] Offer creation failed for peer ${peerId}:`, err);
                });
        } else {
            pc.ondatachannel = (event) => {
                this.attachDataChannelEvents(peerId, event.channel);
                this.dataChannels.set(peerId, event.channel);
                this.emitStatuses();
            };
        }

        return pc;
    }

    private attachDataChannelEvents(peerId: string, dc: RTCDataChannel): void {
        dc.onopen = () => {
            this.emitStatuses();
        };

        dc.onclose = () => {
            this.dataChannels.delete(peerId);
            this.emitStatuses();
        };

        dc.onerror = (err) => {
            logger.warn(`[WebRTCPresenceMesh] DataChannel error with ${peerId}:`, err);
        };

        dc.onmessage = (event) => {
            if (typeof event.data !== 'string') return;

            const stats = this.peerStats.get(peerId);
            if (stats) {
                stats.bytesReceived += event.data.length;
            }

            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'cursor' && msg.cursor) {
                    this.onCursorReceived?.(peerId, msg.cursor, {
                        userId: peerId,
                        userName: msg.userName || 'Collaborator',
                        userColor: msg.userColor || '#06b6d4',
                        avatarUrl: msg.avatarUrl,
                        lastSeen: Date.now(),
                    });
                } else if (msg.type === 'selection' && Array.isArray(msg.selectedBlockIds)) {
                    this.onSelectionReceived?.(peerId, msg.selectedBlockIds);
                }
            } catch (_err) {
                // Ignore malformed packets
            }
        };
    }

    private async handleIncomingSignal(signal: WebRTCSignalMessage): Promise<void> {
        const peerId = signal.fromUserId;
        let pc = this.peerConnections.get(peerId);

        if (!pc && signal.type === 'offer') {
            pc = this.setupPeerConnection(peerId, false);
        }

        if (!pc) return;

        try {
            if (signal.type === 'offer') {
                const desc = new RTCSessionDescription(signal.payload as unknown as RTCSessionDescriptionInit);
                await pc.setRemoteDescription(desc);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await this.sendSignal(peerId, 'answer', {
                    type: answer.type,
                    sdp: answer.sdp,
                });
            } else if (signal.type === 'answer') {
                const desc = new RTCSessionDescription(signal.payload as unknown as RTCSessionDescriptionInit);
                await pc.setRemoteDescription(desc);
            } else if (signal.type === 'candidate') {
                if (signal.payload && pc.remoteDescription) {
                    await pc.addIceCandidate(new RTCIceCandidate(signal.payload as unknown as RTCIceCandidateInit));
                }
            }
        } catch (err) {
            logger.warn(`[WebRTCPresenceMesh] Failed handling signal ${signal.type} from ${peerId}:`, err);
        }
    }

    private async sendSignal(
        toUserId: string,
        type: WebRTCSignalType,
        payload: Record<string, unknown>
    ): Promise<void> {
        if (!db || this.isDestroyed) return;

        const signalId = `${this.userId}_${toUserId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const signalDoc = doc(
            db,
            'projects',
            this.projectId,
            'canvases',
            this.canvasId,
            'signals',
            signalId
        );

        const msg: WebRTCSignalMessage = {
            id: signalId,
            canvasId: this.canvasId,
            projectId: this.projectId,
            fromUserId: this.userId,
            toUserId,
            type,
            payload,
            createdAt: Date.now(),
        };

        try {
            await setDoc(signalDoc, msg);
        } catch (err) {
            logger.warn(`[WebRTCPresenceMesh] Signal send failed to ${toUserId}:`, err);
        }
    }

    /**
     * Broadcast cursor coordinates over all open DataChannels in 60fps real-time.
     * Returns true if at least one peer received the message via WebRTC.
     */
    public broadcastCursor(cursor: { x: number; y: number } | null): boolean {
        if (this.isDestroyed) return false;

        let sentCount = 0;
        const payload = JSON.stringify({
            type: 'cursor',
            cursor,
            userId: this.userId,
            userName: this.userName,
            userColor: this.userColor,
            avatarUrl: this.avatarUrl,
            timestamp: Date.now(),
        });

        for (const [peerId, dc] of this.dataChannels.entries()) {
            if (dc.readyState === 'open') {
                try {
                    dc.send(payload);
                    sentCount++;
                    const stats = this.peerStats.get(peerId);
                    if (stats) stats.bytesSent += payload.length;
                } catch (_err) {
                    // Ignore transient packet drops
                }
            }
        }

        return sentCount > 0;
    }

    /**
     * Broadcast selection changes over open WebRTC DataChannels.
     */
    public broadcastSelection(selectedBlockIds: string[]): boolean {
        if (this.isDestroyed) return false;

        let sentCount = 0;
        const payload = JSON.stringify({
            type: 'selection',
            userId: this.userId,
            selectedBlockIds,
            timestamp: Date.now(),
        });

        for (const dc of this.dataChannels.values()) {
            if (dc.readyState === 'open') {
                try {
                    dc.send(payload);
                    sentCount++;
                } catch (_err) {
                    // Ignore transient drops
                }
            }
        }

        return sentCount > 0;
    }

    /**
     * Check if at least one WebRTC DataChannel is actively open.
     */
    public hasActiveDataChannels(): boolean {
        for (const dc of this.dataChannels.values()) {
            if (dc.readyState === 'open') return true;
        }
        return false;
    }

    private emitStatuses(): void {
        if (!this.onPeerStatusChange || this.isDestroyed) return;

        const statuses: WebRTCPeerStatus[] = [];
        for (const [peerId, pc] of this.peerConnections.entries()) {
            const dc = this.dataChannels.get(peerId);
            const stats = this.peerStats.get(peerId) || { bytesSent: 0, bytesReceived: 0 };

            statuses.push({
                peerId,
                connectionState: (pc.connectionState as WebRTCPeerStatus['connectionState']) || 'new',
                dataChannelState: (dc?.readyState as WebRTCPeerStatus['dataChannelState']) || 'closed',
                latencyMs: stats.latencyMs,
                bytesSent: stats.bytesSent,
                bytesReceived: stats.bytesReceived,
            });
        }

        this.onPeerStatusChange(statuses);
    }

    /**
     * Cleanly close all WebRTC connections, DataChannels, and Firestore signaling subscriptions.
     */
    public destroy(): void {
        this.isDestroyed = true;

        if (this.unsubscribeSignals) {
            this.unsubscribeSignals();
            this.unsubscribeSignals = undefined;
        }

        for (const dc of this.dataChannels.values()) {
            try {
                dc.close();
            } catch (_err) {
                // Ignore close error during teardown
            }
        }
        this.dataChannels.clear();

        for (const pc of this.peerConnections.values()) {
            try {
                pc.close();
            } catch (_err) {
                // Ignore close error during teardown
            }
        }
        this.peerConnections.clear();
        this.peerStats.clear();
    }
}
